use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::client::servers::_server_::backups::_backup_::GetServerBackup;
    use axum::http::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            server::{GetServer, GetServerActivityLogger},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
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
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
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
        mut server: GetServer,
        activity_logger: GetServerActivityLogger,
        backup: GetServerBackup,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_server_permission("backups.download")?;
        permissions.has_server_permission("files.create")?;

        if backup.deleting.is_some() {
            return ApiResponse::error("backup is being deleted")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

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

        if server.is_ignored(&data.path, false) {
            return ApiResponse::error("destination path is not accessible")
                .with_status(StatusCode::EXPECTATION_FAILED)
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
                "server:backup.export",
                serde_json::json!({
                    "uuid": backup_uuid,
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
