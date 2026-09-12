use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::admin::nodes::_node_::backups::_backup_::GetServerBackup;
    use axum::http::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            ByUuid,
            admin_activity::GetAdminActivityLogger,
            node::GetNode,
            server_backup::{BackupDisk, ServerBackupKind},
            server_database_instance::ServerDatabaseInstance,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        database_instance_uuid: uuid::Uuid,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
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

        if backup.kind != ServerBackupKind::DatabaseInstance {
            return ApiResponse::error("only database backups can be reassigned")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

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
            return ApiResponse::error(
                "backup has failed and cannot be assigned to a database instance",
            )
            .with_status(StatusCode::EXPECTATION_FAILED)
            .ok();
        }

        if backup.disk == BackupDisk::S3 && backup.upload_path.is_none() {
            return ApiResponse::error("backup has no upload path and cannot be reassigned")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let database_instance = match ServerDatabaseInstance::by_uuid_optional(
            &state.database,
            data.database_instance_uuid,
        )
        .await?
        {
            Some(database_instance) => database_instance,
            None => {
                return ApiResponse::error("database instance not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        };

        if backup.database_type != Some(database_instance.r#type) {
            return ApiResponse::error(
                "database instance does not use the same database type as the backup",
            )
            .with_status(StatusCode::EXPECTATION_FAILED)
            .ok();
        }

        let server = database_instance
            .server
            .fetch_cached(&state.database)
            .await?;

        if server.node.uuid != node.uuid && !backup.shared {
            return ApiResponse::error(
                "database instance does not belong to the same node as the backup",
            )
            .with_status(StatusCode::BAD_REQUEST)
            .ok();
        }

        // Backup groups are scoped to a server, so a group only survives a move within one.
        let backup_group_uuid =
            if backup.server.as_ref().map(|server| server.uuid) == Some(server.uuid) {
                backup.backup_group_uuid
            } else {
                None
            };

        let result = sqlx::query!(
            "UPDATE server_backups
            SET
                database_instance_uuid = $2,
                server_uuid = $3,
                node_uuid = $4,
                backup_group_uuid = $5,
                metadata = jsonb_set(server_backups.metadata, '{source_instance}', $6)
            WHERE
                server_backups.uuid = $1
                AND server_backups.deleted IS NULL
                AND server_backups.deleting IS NULL",
            backup.uuid,
            database_instance.uuid,
            server.uuid,
            server.node.uuid,
            backup_group_uuid,
            serde_json::json!({
                "uuid": database_instance.uuid,
                "name": database_instance.name,
            }),
        )
        .execute(state.database.write())
        .await?;

        if result.rows_affected() == 0 {
            return ApiResponse::error("backup is no longer available")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        activity_logger
            .log(
                "node:backup.reassign",
                serde_json::json!({
                    "uuid": backup.uuid,
                    "node_uuid": node.uuid,
                    "server_uuid": server.uuid,
                    "database_instance_uuid": database_instance.uuid,
                    "old_server_uuid": backup.server.as_ref().map(|server| server.uuid),
                    "old_database_instance_uuid": backup.database_instance_uuid,

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
