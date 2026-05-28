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
            return ApiResponse::error("backup has failed and cannot be restored")
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

        if let Err(err) = backup
            .0
            .restore(
                &state,
                &mut transaction,
                server,
                shared::models::server_backup::ServerBackupRestoreOptions {
                    truncate_directory: data.truncate_directory,
                    restore_startup: data.restore_startup,
                },
            )
            .await
        {
            transaction.rollback().await?;

            return ApiResponse::from(err).ok();
        }

        transaction.commit().await?;

        activity_logger
            .log(
                "node:backup.restore",
                serde_json::json!({
                    "uuid": backup_uuid,
                    "node_uuid": node.uuid,
                    "server_uuid": data.server_uuid,

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
