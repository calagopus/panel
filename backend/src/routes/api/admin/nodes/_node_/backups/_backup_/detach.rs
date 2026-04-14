use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::admin::nodes::_node_::backups::_backup_::GetServerBackup;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            admin_activity::GetAdminActivityLogger, node::GetNode, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = BAD_REQUEST, body = ApiError),
    ), params(
        (
            "node" = uuid::Uuid,
            description = "The node ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "backup" = uuid::Uuid,
            description = "The backup ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        node: GetNode,
        backup: GetServerBackup,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("nodes.backups")?;

        if backup.completed.is_none() {
            return ApiResponse::error("backup has not been completed yet")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        sqlx::query!(
            "UPDATE server_backups SET server_uuid = NULL WHERE uuid = $1",
            backup.uuid
        )
        .execute(state.database.write())
        .await?;

        activity_logger
            .log(
                "node:backup.detach",
                serde_json::json!({
                    "uuid": backup.uuid,
                    "node_uuid": node.uuid,

                    "name": backup.name,
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
