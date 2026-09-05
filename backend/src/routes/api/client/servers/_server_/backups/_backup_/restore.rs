use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::client::servers::_server_::backups::_backup_::GetServerBackup;
    use axum::http::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            ByUuid,
            server::{GetServer, GetServerActivityLogger, Server, ServerStatus},
            server_backup::{ServerBackupKind, ServerBackupRestoreOptions},
            server_database_instance::{ServerDatabaseInstance, ServerDatabaseInstanceStatus},
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
        #[serde(default)]
        database_instance_uuid: Option<uuid::Uuid>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = BAD_REQUEST, body = ApiError),
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
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        mut server: GetServer,
        activity_logger: GetServerActivityLogger,
        backup: GetServerBackup,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_server_permission("backups.restore")?;

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
            return ApiResponse::error("backup has failed and cannot be restored")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        match (backup.kind, data.database_instance_uuid) {
            (ServerBackupKind::Server, Some(_)) => {
                return ApiResponse::error(
                    "server backups cannot be restored into a database instance",
                )
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
            }
            (ServerBackupKind::DatabaseInstance, None) => {
                return ApiResponse::error(
                    "a database instance must be selected to restore a database backup",
                )
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
            }
            _ => {}
        }

        if let Some(database_instance_uuid) = data.database_instance_uuid {
            permissions.has_server_permission("database-instances.read")?;

            let database_instance = match ServerDatabaseInstance::by_server_uuid_uuid(
                &state.database,
                server.uuid,
                database_instance_uuid,
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

            if database_instance.database_agent_host.maintenance_enabled {
                return ApiResponse::error(
                    "cannot restore backup while database agent host is in maintenance mode",
                )
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
            }

            let utilization = match database_instance
                .database_agent_host
                .api_client(&state.database)
                .await?
                .get_instances_instance_utilization(database_instance.uuid)
                .await
            {
                Ok(utilization) => utilization,
                Err(db_agent_api::client::ApiHttpError::Http(
                    status @ (StatusCode::NOT_FOUND
                    | StatusCode::BAD_REQUEST
                    | StatusCode::CONFLICT
                    | StatusCode::EXPECTATION_FAILED),
                    err,
                )) => {
                    return ApiResponse::new_serialized(ApiError::new_database_agent_value(err))
                        .with_status(status)
                        .ok();
                }
                Err(err) => return Err(err.into()),
            };

            if !matches!(
                utilization.utilization.state,
                db_agent_api::ContainerState::Running
            ) {
                return ApiResponse::error("database instance must be running to restore a backup")
                    .with_status(StatusCode::EXPECTATION_FAILED)
                    .ok();
            }

            if !ServerDatabaseInstance::try_set_status_by_uuid(
                state.database.write(),
                database_instance.uuid,
                None,
                Some(ServerDatabaseInstanceStatus::RestoringBackup),
            )
            .await?
            {
                return ApiResponse::error(
                    "a backup is already being restored into the database instance",
                )
                .with_status(StatusCode::CONFLICT)
                .ok();
            }

            return tokio::spawn(async move {
                let backup_uuid = backup.uuid;
                let backup_name = backup.name.clone();

                if let Err(err) = backup
                    .0
                    .restore_database(&state, server.0, &database_instance, None)
                    .await
                {
                    if let Err(err) = ServerDatabaseInstance::try_set_status_by_uuid(
                        state.database.write(),
                        database_instance.uuid,
                        Some(ServerDatabaseInstanceStatus::RestoringBackup),
                        None,
                    )
                    .await
                    {
                        tracing::error!(
                            database_instance = %database_instance.uuid,
                            "failed to clear database instance restore status: {:#?}",
                            err
                        );
                    }

                    if err
                        .downcast_ref::<shared::response::DisplayError>()
                        .is_some()
                    {
                        return ApiResponse::from(err).ok();
                    }

                    tracing::error!(backup = %backup_uuid, "failed to restore database backup: {:?}", err);

                    return ApiResponse::error("failed to restore backup")
                        .with_status(StatusCode::INTERNAL_SERVER_ERROR)
                        .ok();
                }

                activity_logger
                    .log(
                        "server:database-backup.restore",
                        serde_json::json!({
                            "uuid": backup_uuid,
                            "name": backup_name,
                            "database_instance_uuid": database_instance.uuid,
                            "database_instance_name": database_instance.name,
                        }),
                    )
                    .await;

                ApiResponse::new_serialized(Response {}).ok()
            })
            .await?;
        }

        tokio::spawn(async move {
            let mut transaction = state.database.write().begin().await?;

            if !server
                .try_set_status(&mut *transaction, None, Some(ServerStatus::RestoringBackup))
                .await?
            {
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

            Server::invalidate_cached(&state.database, uuid).await;

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
        })
        .await?
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
