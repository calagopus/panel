use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use crate::routes::api::client::servers::_server_::backups::_backup_::GetServerBackup;
    use axum::{extract::Query, http::StatusCode};
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            server::{GetServer, GetServerActivityLogger},
            user::{GetPermissionManager, GetUser},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Params {
        #[serde(default)]
        archive_format: wings_api::StreamableArchiveFormat,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(format = "uri")]
        url: String,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
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
        (
            "archive_format" = wings_api::StreamableArchiveFormat, Query,
            description = "The format of the archive to download (only for is_streaming = true)",
            example = "tar_gz",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        server: GetServer,
        activity_logger: GetServerActivityLogger,
        backup: GetServerBackup,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        permissions.has_server_permission("backups.download")?;

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
            return ApiResponse::error("backup has failed and cannot be downloaded")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let node = server.node.fetch_cached(&state.database).await?;

        let url = backup
            .download_url(&state, &user, &node, params.archive_format)
            .await?;

        activity_logger
            .log(
                "server:backup.download",
                serde_json::json!({
                    "uuid": backup.uuid,
                    "name": backup.name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response { url }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
