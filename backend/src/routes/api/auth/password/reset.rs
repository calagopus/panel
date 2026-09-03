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
            user_password_reset::UserPasswordReset, user_session::UserSession,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(chars, min = 96, max = 96))]
        #[schema(min_length = 96, max_length = 96)]
        token: String,
        #[garde(length(chars, min = 8, max = 512))]
        #[schema(min_length = 8, max_length = 512)]
        new_password: String,
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
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let ratelimit = state
            .settings
            .get_as(|s| s.ratelimits.auth_password_reset)
            .await?;
        state
            .cache
            .ratelimit(
                "auth/password/reset",
                ratelimit.hits,
                ratelimit.window_seconds,
                ip.to_string(),
            )
            .await?;

        let mut token =
            match UserPasswordReset::delete_by_token(&state.database, &data.token).await? {
                Some(token) => token,
                None => {
                    return ApiResponse::error("invalid or expired token")
                        .with_status(StatusCode::BAD_REQUEST)
                        .ok();
                }
            };

        if let Err(err) = UserActivity::create(
            &state,
            shared::models::user_activity::CreateUserActivityOptions {
                user_uuid: token.user.uuid,
                impersonator_uuid: None,
                api_key_uuid: None,
                event: "auth:reset-password".into(),
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
                user = %token.user.uuid,
                "failed to log user activity: {:#?}",
                err
            );
        }

        token
            .user
            .update_password(&state.database, Some(&data.new_password))
            .await?;

        UserSession::delete_by_user_uuid_except(&state.database, token.user.uuid, None).await?;

        sqlx::query!(
            "UPDATE users
            SET email_verified = true
            WHERE users.uuid = $1",
            token.user.uuid
        )
        .execute(state.database.write())
        .await?;

        User::invalidate_cached(&state.database, token.user.uuid).await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
