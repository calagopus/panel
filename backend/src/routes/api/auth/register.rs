use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{ByUuid, CreatableModel, user::User, user_session::UserSession},
        response::{ApiResponse, ApiResponseResult},
    };
    use tower_cookies::{Cookie, Cookies};
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(chars, min = 3, max = 15), pattern("^[a-zA-Z0-9_]+$"))]
        #[schema(min_length = 3, max_length = 15)]
        #[schema(pattern = "^[a-zA-Z0-9_]+$")]
        username: String,
        #[garde(email)]
        #[schema(format = "email")]
        email: String,
        #[garde(length(chars, min = 2, max = 255))]
        #[schema(min_length = 2, max_length = 255)]
        name_first: String,
        #[garde(length(chars, min = 2, max = 255))]
        #[schema(min_length = 2, max_length = 255)]
        name_last: String,
        #[garde(length(chars, min = 8, max = 512))]
        #[schema(min_length = 8, max_length = 512)]
        password: String,

        #[garde(skip)]
        captcha: Option<String>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        user: shared::models::user::ApiFullUser,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        ip: shared::GetIp,
        headers: axum::http::HeaderMap,
        cookies: Cookies,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let settings = state.settings.get().await?;
        if !settings.app.registration_enabled {
            return ApiResponse::error("registration is disabled")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }
        let secure = settings.app.url.starts_with("https://");
        let ratelimit = settings.ratelimits.auth_register;
        drop(settings);

        state
            .cache
            .ratelimit(
                "auth/register",
                ratelimit.hits,
                ratelimit.window_seconds,
                ip.to_string(),
            )
            .await?;

        if let Err(error) = state.captcha.verify(ip, data.captcha).await {
            return ApiResponse::error(&error)
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let user = match User::create_automatic_admin(
            &state.database,
            &data.username,
            &data.email,
            &data.name_first,
            &data.name_last,
            &data.password,
        )
        .await
        {
            Ok(user_uuid) => User::by_uuid(&state.database, user_uuid).await?,
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("user with username or email already exists")
                    .with_status(StatusCode::BAD_REQUEST)
                    .ok();
            }
            Err(err) => {
                tracing::error!("failed to create user: {:?}", err);

                return ApiResponse::error("failed to create user")
                    .with_status(StatusCode::INTERNAL_SERVER_ERROR)
                    .ok();
            }
        };

        let key = UserSession::create(
            &state,
            shared::models::user_session::CreateUserSessionOptions {
                user_uuid: user.uuid,
                ip: ip.0.into(),
                user_agent: headers
                    .get("User-Agent")
                    .map(|ua| shared::utils::slice_up_to(ua.to_str().unwrap_or("unknown"), 255))
                    .unwrap_or("unknown")
                    .into(),
            },
        )
        .await?;

        cookies.add(
            Cookie::build(("session", key))
                .http_only(true)
                .same_site(tower_cookies::cookie::SameSite::Strict)
                .secure(secure)
                .path("/")
                .expires(
                    tower_cookies::cookie::time::OffsetDateTime::now_utc()
                        + tower_cookies::cookie::time::Duration::days(30),
                )
                .build(),
        );

        ApiResponse::new_serialized(Response {
            user: user.into_api_full_object(&state.storage.retrieve_urls().await?),
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
