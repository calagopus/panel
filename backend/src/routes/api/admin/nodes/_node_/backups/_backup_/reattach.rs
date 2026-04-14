use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::admin::nodes::_node_::backups::_backup_::GetServerBackup;
    use axum::http::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            ByUuid, admin_activity::GetAdminActivityLogger, node::GetNode, server::Server,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        server_uuid: uuid::Uuid,
    }

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
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        node: GetNode,
        backup: GetServerBackup,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("nodes.backups")?;

        if backup.completed.is_none() {
            return ApiResponse::error("backup has not been completed yet")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        if !backup.successful {
            return ApiResponse::error("backup has failed and cannot be attached to a server")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let server =
            match Server::by_uuid_optional_cached(&state.database, data.server_uuid).await? {
                Some(server) => server,
                None => {
                    return ApiResponse::error("server not found")
                        .with_status(StatusCode::NOT_FOUND)
                        .ok();
                }
            };

        if server.node.uuid != node.uuid && !backup.is_remote() {
            return ApiResponse::error("server does not belong to the same node as the backup")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        sqlx::query!(
            "UPDATE server_backups SET server_uuid = $1 WHERE uuid = $2",
            server.uuid,
            backup.uuid
        )
        .execute(state.database.write())
        .await?;

        activity_logger
            .log(
                "node:backup.attach",
                serde_json::json!({
                    "uuid": backup.uuid,
                    "node_uuid": node.uuid,
                    "server_uuid": data.server_uuid,

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
