use super::State;
use serde::{Deserialize, Serialize};
use shared::jwt::BasePayload;
use utoipa_axum::{router::OpenApiRouter, routes};

#[derive(Deserialize, Serialize)]
pub struct TwoFactorRequiredJwt {
    #[serde(flatten)]
    pub base: BasePayload,

    pub user_uuid: uuid::Uuid,
}

mod post {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            ByUuid, CreatableModel, user::User, user_activity::UserActivity,
            user_recovery_code::UserRecoveryCode, user_session::UserSession,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use tower_cookies::Cookies;
    use utoipa::ToSchema;

    use crate::routes::api::auth::login::checkpoint::TwoFactorRequiredJwt;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(chars, min = 6, max = 10))]
        #[schema(min_length = 6, max_length = 10)]
        code: String,

        #[garde(skip)]
        confirmation_token: String,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        user: shared::models::user::ApiFullUser,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        ip: shared::GetIp,
        headers: axum::http::HeaderMap,
        cookies: Cookies,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        let payload: TwoFactorRequiredJwt = match state.jwt.verify(&data.confirmation_token) {
            Ok(payload) => payload,
            Err(_) => {
                return ApiResponse::error("invalid confirmation token")
                    .with_status(StatusCode::BAD_REQUEST)
                    .ok();
            }
        };

        if !payload.base.validate() {
            return ApiResponse::error("invalid confirmation token")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let ratelimit = state
            .settings
            .get_as(|s| s.ratelimits.auth_login_checkpoint)
            .await?;
        state
            .cache
            .ratelimit(
                "auth/login/checkpoint",
                ratelimit.hits,
                ratelimit.window_seconds,
                ip.to_string(),
            )
            .await?;

        let user = User::by_uuid(&state.database, payload.user_uuid).await?;

        match data.code.len() {
            6 => {
                let user_totp_secret = match &user.totp_secret {
                    Some(secret) => secret.clone(),
                    None => {
                        return ApiResponse::error("invalid confirmation code")
                            .with_status(StatusCode::BAD_REQUEST)
                            .ok();
                    }
                };

                let totp = totp_rs::TOTP::new(
                    totp_rs::Algorithm::SHA1,
                    6,
                    1,
                    30,
                    totp_rs::Secret::Encoded(user_totp_secret).to_bytes()?,
                )?;

                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();
                let current_step_idx = now / totp.step;
                let mut matched_step_idx = None;

                for offset in -(totp.skew as i64)..=(totp.skew as i64) {
                    let check_step_idx = (current_step_idx as i64 + offset) as u64;
                    let check_time = check_step_idx * totp.step;

                    if totp.generate(check_time) == data.code {
                        matched_step_idx = Some(check_step_idx);
                        break;
                    }
                }

                let matched_step_idx = match matched_step_idx {
                    Some(idx) => idx,
                    None => {
                        return ApiResponse::error("invalid confirmation code")
                            .with_status(StatusCode::BAD_REQUEST)
                            .ok();
                    }
                };

                if let Some(totp_last_used) = &user.totp_last_used {
                    let last_used_step_idx =
                        totp_last_used.and_utc().timestamp() as u64 / totp.step;

                    if matched_step_idx <= last_used_step_idx {
                        return ApiResponse::error("this code has already been used")
                            .with_status(StatusCode::BAD_REQUEST)
                            .ok();
                    }
                }

                if let Err(err) = UserActivity::create(
                    &state,
                    shared::models::user_activity::CreateUserActivityOptions {
                        user_uuid: user.uuid,
                        impersonator_uuid: None,
                        api_key_uuid: None,
                        event: "auth:success".into(),
                        ip: Some(ip.0.into()),
                        data: serde_json::json!({
                            "using": "two-factor",

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
            }
            10 => {
                if UserRecoveryCode::delete_by_user_uuid_code(
                    &state.database,
                    payload.user_uuid,
                    &data.code,
                )
                .await?
                .is_some()
                {
                    if let Err(err) = UserActivity::create(
                        &state,
                        shared::models::user_activity::CreateUserActivityOptions {
                            user_uuid: user.uuid,
                            impersonator_uuid: None,
                            api_key_uuid: None,
                            event: "auth:success".into(),
                            ip: Some(ip.0.into()),
                            data: serde_json::json!({
                                "using": "recovery-code",

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
                } else {
                    return ApiResponse::error("invalid recovery code")
                        .with_status(StatusCode::BAD_REQUEST)
                        .ok();
                }
            }
            _ => {
                return ApiResponse::error("invalid confirmation code")
                    .with_status(StatusCode::BAD_REQUEST)
                    .ok();
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

        sqlx::query!(
            "UPDATE users
            SET totp_last_used = NOW()
            WHERE users.uuid = $1",
            user.uuid
        )
        .execute(state.database.write())
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
