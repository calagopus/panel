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
            user_email_verification::UserEmailVerification, user_password_reset::UserPasswordReset,
        },
        prelude::SqlxErrorExt,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(chars, min = 96, max = 96))]
        #[schema(min_length = 96, max_length = 96)]
        token: String,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        user_uuid: uuid::Uuid,
        email: compact_str::CompactString,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        ip: shared::GetIp,
        headers: HeaderMap,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let ratelimit = state
            .settings
            .get_as(|s| s.ratelimits.auth_email_verification)
            .await?;
        state
            .cache
            .ratelimit(
                "auth/email/verify",
                ratelimit.hits,
                ratelimit.window_seconds,
                ip.to_string(),
            )
            .await?;

        let verification =
            match UserEmailVerification::delete_by_token(&state.database, &data.token).await? {
                Some(verification) => verification,
                None => {
                    return ApiResponse::error("invalid or expired token")
                        .with_status(StatusCode::BAD_REQUEST)
                        .ok();
                }
            };

        match sqlx::query!(
            "UPDATE users
            SET email = $1, email_verified = true
            WHERE users.uuid = $2",
            verification.email.as_str(),
            verification.user.uuid
        )
        .execute(state.database.write())
        .await
        {
            Ok(_) => {
                User::invalidate_cached(&state.database, verification.user.uuid).await;
            }
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("email already in use")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return Err(err.into()),
        }

        if verification.email != verification.user.email {
            UserPasswordReset::delete_by_user_uuid(&state.database, verification.user.uuid).await?;
        }

        if let Err(err) = UserActivity::create(
            &state,
            shared::models::user_activity::CreateUserActivityOptions {
                user_uuid: verification.user.uuid,
                impersonator_uuid: None,
                api_key_uuid: None,
                event: "auth:email-verified".into(),
                ip: Some(ip.0.into()),
                data: serde_json::json!({
                    "email": verification.email,

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
                user = %verification.user.uuid,
                "failed to log user activity: {:#?}",
                err
            );
        }

        ApiResponse::new_serialized(Response {
            user_uuid: verification.user.uuid,
            email: verification.email,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
