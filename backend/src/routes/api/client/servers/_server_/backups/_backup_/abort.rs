use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::client::servers::_server_::backups::_backup_::GetServerBackup;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            server::{GetServer, GetServerActivityLogger},
            server_backup::ServerBackupKind,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = ACCEPTED, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
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
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        activity_logger: GetServerActivityLogger,
        backup: GetServerBackup,
    ) -> ApiResponseResult {
        permissions.has_server_permission("backups.create")?;

        if backup.completed.is_some() {
            return ApiResponse::error("backup has already been completed")
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        if !backup.disk.is_abortable() {
            return ApiResponse::error("backups on this disk cannot be aborted")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        tokio::spawn(async move {
            match backup
                .node
                .fetch_cached(&state.database)
                .await?
                .api_client(&state.database)
                .await?
                .post_servers_server_backup_backup_abort(server.uuid, backup.uuid)
                .await
            {
                Ok(_) => {}
                Err(wings_api::client::ApiHttpError::Http(StatusCode::CONFLICT, _)) => {
                    return ApiResponse::error("backup is not being created")
                        .with_status(StatusCode::CONFLICT)
                        .ok();
                }
                Err(err) => return Err(err.into()),
            };

            activity_logger
                .log(
                    match backup.kind {
                        ServerBackupKind::Server => "server:backup.abort",
                        ServerBackupKind::DatabaseInstance => "server:database-backup.abort",
                    },
                    serde_json::json!({
                        "uuid": backup.uuid,
                        "name": backup.name,
                        "database_instance_uuid": backup.database_instance_uuid,
                    }),
                )
                .await;

            ApiResponse::new_serialized(Response {})
                .with_status(StatusCode::ACCEPTED)
                .ok()
        })
        .await?
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
