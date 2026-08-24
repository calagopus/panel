use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::admin::users::_user_::GetParamUser;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            admin_activity::GetAdminActivityLogger, user::GetPermissionManager,
            user_email_verification::UserEmailVerification,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
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
        permissions.has_admin_permission("users.email")?;

        if user.email_verified {
            return ApiResponse::error("email is already verified")
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        UserEmailVerification::delete_by_user_uuid(&state.database, user.uuid).await?;

        sqlx::query!(
            "UPDATE users
            SET email_verified = true
            WHERE users.uuid = $1",
            user.uuid
        )
        .execute(state.database.write())
        .await?;

        activity_logger
            .log(
                "user:email.verify",
                serde_json::json!({
                    "uuid": user.uuid,
                    "email": user.email,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
