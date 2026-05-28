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
            server_backup::ServerBackupRestoreOptions,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        #[serde(default)]
        truncate_directory: bool,
        #[serde(default)]
        restore_startup: bool,
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
        server: GetServer,
        activity_logger: GetServerActivityLogger,
        backup: GetServerBackup,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_server_permission("backups.restore")?;

        if backup.completed.is_none() {
            return ApiResponse::error("backup has not been completed yet")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        if !backup.successful {
            return ApiResponse::error("backup has failed and cannot be restored")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let mut transaction = state.database.write().begin().await?;

        let rows_affected = sqlx::query!(
            "UPDATE servers
            SET status = 'RESTORING_BACKUP'
            WHERE servers.uuid = $1 AND servers.status IS NULL",
            server.uuid
        )
        .execute(&mut *transaction)
        .await?
        .rows_affected();

        if rows_affected == 0 {
            transaction.rollback().await?;

            return ApiResponse::error("server is not in a valid state to restore backup.")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let backup_uuid = backup.uuid;
        let backup_name = backup.name.clone();

        let uuid = server.uuid;
        if let Err(err) = backup
            .0
            .restore(
                &state,
                &mut transaction,
                server.0,
                ServerBackupRestoreOptions {
                    truncate_directory: data.truncate_directory,
                    restore_startup: data.restore_startup,
                },
            )
            .await
        {
            transaction.rollback().await?;
            tracing::error!(server = %uuid, backup = %backup_uuid, "failed to restore backup: {:?}", err);

            return ApiResponse::error("failed to restore backup")
                .with_status(StatusCode::INTERNAL_SERVER_ERROR)
                .ok();
        }

        transaction.commit().await?;

        activity_logger
            .log(
                "server:backup.restore",
                serde_json::json!({
                    "uuid": backup_uuid,
                    "name": backup_name,
                    "truncate_directory": data.truncate_directory,
                    "restore_startup": data.restore_startup,
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
