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

        #[schema(value_type = String)]
        path: compact_str::CompactString,

        #[serde(default)]
        archive_format: wings_api::StreamableArchiveFormat,

        #[serde(default)]
        foreground: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        entry: wings_api::DirectoryEntry,
    }

    #[derive(ToSchema, Serialize)]
    struct ResponseAccepted {
        identifier: uuid::Uuid,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = ACCEPTED, body = inline(ResponseAccepted)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = BAD_REQUEST, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
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
            return ApiResponse::error("backup has failed and cannot be exported")
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

        if server.node.uuid != node.uuid && !backup.shared {
            return ApiResponse::error("server does not belong to the same node as the backup")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let backup_uuid = backup.uuid;
        let backup_name = backup.name.clone();
        let path = data.path.clone();

        let response = match backup
            .0
            .export(
                &state,
                &server,
                data.path,
                data.archive_format,
                data.foreground,
            )
            .await?
        {
            wings_api::backups_backup_export::post::Response::Ok(entry) => {
                ApiResponse::new_serialized(Response { entry }).ok()
            }
            wings_api::backups_backup_export::post::Response::Accepted(data) => {
                ApiResponse::new_serialized(ResponseAccepted {
                    identifier: data.identifier,
                })
                .with_status(StatusCode::ACCEPTED)
                .ok()
            }
        };

        activity_logger
            .log(
                "node:backup.export",
                serde_json::json!({
                    "uuid": backup_uuid,
                    "node_uuid": node.uuid,
                    "server_uuid": data.server_uuid,

                    "name": backup_name,
                    "path": path,
                }),
            )
            .await;

        response
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
