use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            user::{GetPermissionManager, GetUser},
            user_activity::GetUserActivityLogger,
            user_email_verification::UserEmailVerification,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        email: compact_str::CompactString,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = FORBIDDEN, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ))]
    pub async fn route(
        state: GetState,
        ip: shared::GetIp,
        permissions: GetPermissionManager,
        user: GetUser,
        activity_logger: GetUserActivityLogger,
    ) -> ApiResponseResult {
        permissions.has_user_permission("account.email")?;

        if user.frozen {
            return ApiResponse::error("account is frozen")
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        let ratelimit = state
            .settings
            .get_as(|s| s.ratelimits.client_account_email_resend_verification)
            .await?;
        state
            .cache
            .ratelimit(
                "client/account/email/resend-verification",
                ratelimit.hits,
                ratelimit.window_seconds,
                ip.to_string(),
            )
            .await?;
        state
            .cache
            .ratelimit(
                "client/account/email/resend-verification:user",
                ratelimit.hits,
                ratelimit.window_seconds,
                user.uuid.to_string(),
            )
            .await?;

        let pending =
            UserEmailVerification::pending_email_by_user_uuid(&state.database, user.uuid).await?;

        let email = match pending {
            Some(email) => email,
            None if !user.email_verified => user.email.clone(),
            None => {
                return ApiResponse::error("email is already verified")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
        };

        if !state
            .mail
            .template_deliverable(&state, "email_verification")
            .await?
        {
            return ApiResponse::error("email verification is not available")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let token = match UserEmailVerification::create(&state.database, user.uuid, &email).await {
            Ok(token) => token,
            Err(err) => {
                tracing::warn!(
                    user = %user.uuid,
                    "failed to create email verification: {:#?}",
                    err
                );

                return ApiResponse::error("a verification email was already sent recently")
                    .with_status(StatusCode::TOO_MANY_REQUESTS)
                    .ok();
            }
        };

        if let Err(err) = UserEmailVerification::send(&state, &user, &email, &token).await {
            tracing::error!(
                user = %user.uuid,
                "failed to send email verification: {:#?}",
                err
            );

            return ApiResponse::error("failed to send the verification email")
                .with_status(StatusCode::INTERNAL_SERVER_ERROR)
                .ok();
        }

        activity_logger
            .log(
                "account:email-verification.resend",
                serde_json::json!({
                    "email": email,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response { email }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
