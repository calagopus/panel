use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod delete {
    use crate::routes::api::admin::users::_user_::GetParamUser;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            admin_activity::GetAdminActivityLogger, user::GetPermissionManager,
            user_recovery_code::UserRecoveryCode, user_two_factor_code::UserTwoFactorCode,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = CONFLICT, body = ApiError),
    ), params(
        (
            "user" = uuid::Uuid,
            description = "The user ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetParamUser,
        activity_logger: GetAdminActivityLogger,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("users.disable-two-factor")?;

        if !user.totp_enabled && !user.email_two_factor_enabled {
            return ApiResponse::error("two-factor authentication is not enabled")
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        UserRecoveryCode::delete_by_user_uuid(&state.database, user.uuid).await?;

        UserTwoFactorCode::delete_by_user_uuid(&state.database, user.uuid).await?;

        sqlx::query!(
            "UPDATE users
            SET totp_enabled = false, totp_last_used = NULL, totp_secret = NULL,
                email_two_factor_enabled = false
            WHERE users.uuid = $1",
            user.uuid
        )
        .execute(state.database.write())
        .await?;

        activity_logger
            .log(
                "user:two-factor.disable",
                serde_json::json!({
                    "uuid": user.uuid
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(delete::route))
        .with_state(state.clone())
}
