use super::State;
use serde::{Deserialize, Serialize};
use shared::{jwt::BasePayload, models::user::User, settings::app::TwoFactorMethod};
use utoipa_axum::{router::OpenApiRouter, routes};

mod email;

#[derive(Deserialize, Serialize)]
pub struct TwoFactorRequiredJwt {
    #[serde(flatten)]
    pub base: BasePayload,

    pub user_uuid: uuid::Uuid,
}

/// Every factor the user can prove here, which excludes security keys: they have no checkpoint
/// step, only a login of their own.
pub fn available_methods(
    user: &User,
    settings: &shared::settings::AppSettings,
) -> Vec<TwoFactorMethod> {
    user.two_factor_methods(settings)
        .into_iter()
        .filter(|method| matches!(method, TwoFactorMethod::Totp | TwoFactorMethod::Email))
        .collect()
}

/// Whether the user meets an enforced two-factor requirement solely through factors that cannot be
/// proven at this checkpoint, in which case handing them a session would let them past
/// `check_account_gates` without ever presenting a second factor.
pub fn two_factor_unprovable(user: &User, settings: &shared::settings::AppSettings) -> bool {
    user.require_two_factor(settings)
        && user.satisfies_two_factor(settings)
        && !available_methods(user, settings)
            .iter()
            .any(|method| settings.app.two_factor_accepted_methods.contains(method))
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
            user_two_factor_code::UserTwoFactorCode,
        },
        response::{ApiResponse, ApiResponseResult},
        settings::app::TwoFactorMethod,
    };
    use tower_cookies::Cookies;
    use utoipa::ToSchema;

    use crate::routes::api::auth::login::checkpoint::{TwoFactorRequiredJwt, available_methods};

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(chars, min = 6, max = 10))]
        #[schema(min_length = 6, max_length = 10)]
        code: String,

        #[garde(skip)]
        method: Option<TwoFactorMethod>,

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

        if !payload.base.validate(Some("two-factor-checkpoint")) {
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

        let settings = state.settings.get().await?;
        let methods = available_methods(&user, &settings);
        let any_two_factor = !user.two_factor_methods(&settings).is_empty();
        drop(settings);

        if !any_two_factor {
            return ApiResponse::error("invalid confirmation code")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let method = if data.code.len() == 10 {
            None
        } else {
            Some(data.method.unwrap_or(TwoFactorMethod::Totp))
        };

        if let Some(method) = method
            && !methods.contains(&method)
        {
            return ApiResponse::error("invalid confirmation code")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let using = match method {
            Some(TwoFactorMethod::Totp) => {
                if data.code.len() != 6 {
                    return ApiResponse::error("invalid confirmation code")
                        .with_status(StatusCode::BAD_REQUEST)
                        .ok();
                }

                let user_totp_secret = match &user.totp_secret {
                    Some(secret) => secret.clone(),
                    None => {
                        return ApiResponse::error("invalid confirmation code")
                            .with_status(StatusCode::BAD_REQUEST)
                            .ok();
                    }
                };

                let totp = totp_rs::Builder::new()
                    .with_algorithm(totp_rs::Algorithm::SHA1)
                    .with_digits(6)
                    .with_skew(1)
                    .with_step_duration(30)
                    .with_secret(totp_rs::Secret::try_from_base32(user_totp_secret)?)
                    .build()?;

                let matched_step_idx = match totp.check_current(&data.code) {
                    Some(idx) => idx,
                    None => {
                        return ApiResponse::error("invalid confirmation code")
                            .with_status(StatusCode::BAD_REQUEST)
                            .ok();
                    }
                };

                if let Some(totp_last_used) = &user.totp_last_used {
                    let last_used_step_idx =
                        totp_last_used.and_utc().timestamp() as u64 / totp.step();

                    if matched_step_idx <= last_used_step_idx {
                        return ApiResponse::error("this code has already been used")
                            .with_status(StatusCode::BAD_REQUEST)
                            .ok();
                    }
                }

                sqlx::query!(
                    "UPDATE users
                    SET totp_last_used = NOW()
                    WHERE users.uuid = $1",
                    user.uuid
                )
                .execute(state.database.write())
                .await?;

                User::invalidate_cached(&state.database, user.uuid).await;

                "two-factor"
            }
            Some(TwoFactorMethod::Email) => {
                if data.code.len() != 6 {
                    return ApiResponse::error("invalid confirmation code")
                        .with_status(StatusCode::BAD_REQUEST)
                        .ok();
                }

                if !UserTwoFactorCode::consume(&state.database, user.uuid, &data.code).await? {
                    return ApiResponse::error("invalid confirmation code")
                        .with_status(StatusCode::BAD_REQUEST)
                        .ok();
                }

                "email"
            }
            Some(TwoFactorMethod::SecurityKey) => {
                return ApiResponse::error("invalid confirmation code")
                    .with_status(StatusCode::BAD_REQUEST)
                    .ok();
            }
            None => {
                if UserRecoveryCode::delete_by_user_uuid_code(
                    &state.database,
                    payload.user_uuid,
                    &data.code,
                )
                .await?
                .is_none()
                {
                    return ApiResponse::error("invalid recovery code")
                        .with_status(StatusCode::BAD_REQUEST)
                        .ok();
                }

                "recovery-code"
            }
        };

        if let Err(err) = UserActivity::create(
            &state,
            shared::models::user_activity::CreateUserActivityOptions {
                user_uuid: user.uuid,
                impersonator_uuid: None,
                api_key_uuid: None,
                event: "auth:success".into(),
                ip: Some(ip.0.into()),
                data: serde_json::json!({
                    "using": using,

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
        .nest("/email", email::router(state))
        .with_state(state.clone())
}
