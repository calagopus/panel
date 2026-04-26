use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

pub mod checkpoint;
mod security_key;

mod post {
    use crate::routes::api::auth::login::checkpoint::TwoFactorRequiredJwt;
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        jwt::BasePayload,
        models::{
            CreatableModel, IntoApiObject, user::User, user_activity::UserActivity,
            user_session::UserSession,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use tower_cookies::Cookies;
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(skip)]
        user: String,
        #[garde(length(max = 512))]
        #[schema(max_length = 512)]
        password: String,

        #[garde(skip)]
        captcha: Option<String>,
    }

    #[derive(ToSchema, Serialize)]
    #[serde(tag = "type", rename_all = "snake_case")]
    enum Response {
        Completed {
            user: Box<shared::models::user::ApiFullUser>,
        },
        TwoFactorRequired {
            user: Box<shared::models::user::ApiUser>,
            token: String,
        },
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

        let ratelimit = state.settings.get_as(|s| s.ratelimits.auth_login).await?;
        state
            .cache
            .ratelimit(
                "auth/login",
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

        let user = if data.user.contains('@') {
            match User::by_email_password(&state.database, &data.user, &data.password).await? {
                Some(user) => user,
                None => {
                    return ApiResponse::error("invalid username or password")
                        .with_status(StatusCode::BAD_REQUEST)
                        .ok();
                }
            }
        } else {
            match User::by_username_password(&state.database, &data.user, &data.password).await? {
                Some(user) => user,
                None => {
                    return ApiResponse::error("invalid username or password")
                        .with_status(StatusCode::BAD_REQUEST)
                        .ok();
                }
            }
        };

        if user.totp_enabled {
            let token = state.jwt.create(&TwoFactorRequiredJwt {
                base: BasePayload {
                    issuer: "panel".into(),
                    subject: None,
                    audience: Vec::new(),
                    expiration_time: Some(chrono::Utc::now().timestamp() + 300),
                    not_before: None,
                    issued_at: Some(chrono::Utc::now().timestamp()),
                    jwt_id: user.uuid.to_string(),
                },
                user_uuid: user.uuid,
            })?;

            if let Err(err) = UserActivity::create(
                &state,
                shared::models::user_activity::CreateUserActivityOptions {
                    user_uuid: user.uuid,
                    impersonator_uuid: None,
                    api_key_uuid: None,
                    event: "auth:checkpoint".into(),
                    ip: Some(ip.0.into()),
                    data: serde_json::json!({
                        "using": "password",

                        "user_agent": headers
                            .get("User-Agent")
                            .map(|ua| shared::utils::slice_up_to(ua.to_str().unwrap_or("unknown"), 255))
                            .unwrap_or("unknown"),
                    }),
                    created: None,
                },
            )
            .await
            {
                tracing::warn!(
                    user = %user.uuid,
                    "failed to log user activity: {:#?}",
                    err
                );
            }

            ApiResponse::new_serialized(Response::TwoFactorRequired {
                user: Box::new(
                    user.into_api_object(&state, &state.storage.retrieve_urls().await?)
                        .await?,
                ),
                token,
            })
            .ok()
        } else {
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

            if let Err(err) = UserActivity::create(
                &state,
                shared::models::user_activity::CreateUserActivityOptions {
                    user_uuid: user.uuid,
                    impersonator_uuid: None,
                    api_key_uuid: None,
                    event: "auth:success".into(),
                    ip: Some(ip.0.into()),
                    data: serde_json::json!({
                        "using": "password",

                        "user_agent": headers
                            .get("User-Agent")
                            .map(|ua| shared::utils::slice_up_to(ua.to_str().unwrap_or("unknown"), 255))
                            .unwrap_or("unknown"),
                    }),
                    created: None,
                },
            )
            .await
            {
                tracing::warn!(
                    user = %user.uuid,
                    "failed to log user activity: {:#?}",
                    err
                );
            }

            ApiResponse::new_serialized(Response::Completed {
                user: Box::new(
                    user.into_api_full_object(&state, &state.storage.retrieve_urls().await?)
                        .await?,
                ),
            })
            .ok()
        }
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .nest("/security-key", security_key::router(state))
        .nest("/checkpoint", checkpoint::router(state))
        .with_state(state.clone())
}
