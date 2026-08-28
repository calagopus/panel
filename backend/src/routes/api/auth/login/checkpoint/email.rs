use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::{HeaderMap, StatusCode};
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            ByUuid, CreatableModel, user::User, user_activity::UserActivity,
            user_two_factor_code::UserTwoFactorCode,
        },
        response::{ApiResponse, ApiResponseResult},
        settings::app::TwoFactorMethod,
    };
    use utoipa::ToSchema;

    use crate::routes::api::auth::login::checkpoint::{TwoFactorRequiredJwt, available_methods};

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(skip)]
        confirmation_token: String,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        ip: shared::GetIp,
        headers: HeaderMap,
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
            .get_as(|s| s.ratelimits.auth_login_checkpoint_email)
            .await?;
        state
            .cache
            .ratelimit(
                "auth/login/checkpoint/email",
                ratelimit.hits,
                ratelimit.window_seconds,
                ip.to_string(),
            )
            .await?;
        state
            .cache
            .ratelimit(
                "auth/login/checkpoint/email:user",
                ratelimit.hits,
                ratelimit.window_seconds,
                payload.user_uuid.to_string(),
            )
            .await?;

        let user = User::by_uuid(&state.database, payload.user_uuid).await?;

        let settings = state.settings.get().await?;
        let email_available = available_methods(&user, &settings).contains(&TwoFactorMethod::Email);
        drop(settings);

        if !email_available {
            return ApiResponse::error("email two-factor authentication is not enabled")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        if !state
            .mail
            .template_deliverable(&state, "two_factor_code")
            .await?
        {
            return ApiResponse::error("email two-factor authentication is not available")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let code = match UserTwoFactorCode::create(&state.database, user.uuid).await {
            Ok(code) => code,
            Err(err) => {
                tracing::warn!(
                    user = %user.uuid,
                    "failed to create two factor code: {:#?}",
                    err
                );

                return ApiResponse::error("a code was already sent recently")
                    .with_status(StatusCode::TOO_MANY_REQUESTS)
                    .ok();
            }
        };

        if let Err(err) = state
            .mail
            .send_template_foreground(
                &state,
                "two_factor_code",
                user.email.clone(),
                minijinja::context! {
                    user => user,
                    code => code,
                },
            )
            .await
        {
            tracing::error!(
                user = %user.uuid,
                "failed to send two factor code email: {:#?}",
                err
            );

            return ApiResponse::error("failed to send the login code")
                .with_status(StatusCode::INTERNAL_SERVER_ERROR)
                .ok();
        }

        if let Err(err) = UserActivity::create(
            &state,
            shared::models::user_activity::CreateUserActivityOptions {
                user_uuid: user.uuid,
                impersonator_uuid: None,
                api_key_uuid: None,
                event: "email:two-factor-code".into(),
                ip: Some(ip.0.into()),
                data: serde_json::json!({
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

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
