use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            ByUuid, CreatableModel, user::User, user_email_verification::UserEmailVerification,
            user_session::UserSession,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use tower_cookies::Cookies;
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(chars, min = 3, max = 15), pattern("^[a-zA-Z0-9_]+$"))]
        #[schema(min_length = 3, max_length = 15)]
        #[schema(pattern = "^[a-zA-Z0-9_]+$")]
        username: compact_str::CompactString,
        #[garde(email)]
        #[schema(format = "email")]
        email: compact_str::CompactString,
        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        name_first: Option<compact_str::CompactString>,
        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        name_last: Option<compact_str::CompactString>,
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

        let mut user = match User::create_automatic_admin(
            &state.database,
            &data.username,
            &data.email,
            data.name_first.as_deref(),
            data.name_last.as_deref(),
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

        if user.admin {
            sqlx::query!(
                "UPDATE users
                SET email_verified = true
                WHERE users.uuid = $1",
                user.uuid
            )
            .execute(state.database.write())
            .await?;

            User::invalidate_cached(&state.database, user.uuid).await;

            user.email_verified = true;
        } else if state
            .settings
            .get_as(|s| s.app.email_verification_required)
            .await?
        {
            match UserEmailVerification::create(&state.database, user.uuid, &user.email).await {
                Ok(token) => {
                    if let Err(err) =
                        UserEmailVerification::send(&state, &user, &user.email, &token).await
                    {
                        tracing::error!(
                            user = %user.uuid,
                            "failed to send email verification: {:#?}",
                            err
                        );
                    }
                }
                Err(err) => {
                    tracing::error!(
                        user = %user.uuid,
                        "failed to create email verification: {:#?}",
                        err
                    );
                }
            }
        }

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

        cookies.add(UserSession::get_cookie(&state, key).await?);

        ApiResponse::new_serialized(Response {
            user: user
                .into_api_full_object(&state, &state.storage.retrieve_urls().await?)
                .await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
