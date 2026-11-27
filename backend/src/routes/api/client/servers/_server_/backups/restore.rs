use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod delete {
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            ByUuid,
            server::{GetServer, GetServerActivityLogger, Server, ServerStatus},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = ACCEPTED, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        mut server: GetServer,
        activity_logger: GetServerActivityLogger,
    ) -> ApiResponseResult {
        permissions.has_server_permission("backups.restore")?;

        if server.fetch_status(&state.database).await? != Some(ServerStatus::RestoringBackup) {
            return ApiResponse::error("server is not restoring a backup")
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        tokio::spawn(async move {
            match server
                .node
                .fetch_cached(&state.database)
                .await?
                .api_client(&state.database)
                .await?
                .delete_servers_server_backup_restore(server.uuid)
                .await
            {
                Ok(_) => {}
                Err(wings_api::client::ApiHttpError::Http(StatusCode::CONFLICT, _)) => {
                    if !server
                        .try_set_status(
                            state.database.write(),
                            Some(ServerStatus::RestoringBackup),
                            Some(ServerStatus::BackupRestoreFailed),
                        )
                        .await?
                    {
                        return ApiResponse::error("server is not restoring a backup")
                            .with_status(StatusCode::CONFLICT)
                            .ok();
                    }

                    Server::invalidate_cached(&state.database, server.uuid).await;

                    return ApiResponse::new_serialized(Response {}).ok();
                }
                Err(err) => return Err(err.into()),
            };

            activity_logger
                .log("server:backup.abort-restore", serde_json::json!({}))
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
        .routes(routes!(delete::route))
        .with_state(state.clone())
}
