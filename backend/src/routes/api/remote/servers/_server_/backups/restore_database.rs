use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use garde::Validate;
    use reqwest::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel, EventEmittingModel,
            server::GetServer,
            server_activity::ServerActivity,
            server_backup::{
                ServerBackup, ServerBackupEvent, ServerBackupFilter, ServerBackupKind,
            },
            server_database_instance::{ServerDatabaseInstance, ServerDatabaseInstanceStatus},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(skip)]
        schedule_uuid: Option<uuid::Uuid>,
        #[garde(skip)]
        request_uuid: Option<uuid::Uuid>,

        #[garde(skip)]
        backup_uuid: Option<uuid::Uuid>,
        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        backup_name: Option<compact_str::CompactString>,
        #[garde(skip)]
        #[serde(default)]
        backup_group_uuid: Option<uuid::Uuid>,
        #[garde(skip)]
        #[serde(default)]
        oldest: bool,

        #[garde(skip)]
        #[serde(default)]
        source_database_instance_uuid: Option<uuid::Uuid>,
        #[garde(skip)]
        #[serde(default)]
        database_instance_uuid: Option<uuid::Uuid>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        uuid: uuid::Uuid,
        database_instance_uuid: uuid::Uuid,
        request_uuid: Option<uuid::Uuid>,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
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
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        server: GetServer,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        if data.backup_uuid.is_some() && data.backup_name.is_some() {
            return ApiResponse::error("backup_uuid and backup_name are mutually exclusive")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        if server.destination_node.is_some() {
            return ApiResponse::error("server is transferring")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let backup = match data.backup_uuid {
            Some(uuid) => ServerBackup::by_server_uuid_uuid(&state.database, server.uuid, uuid)
                .await?
                .filter(|backup| {
                    backup.deleted.is_none()
                        && backup.deleting.is_none()
                        && backup.kind == ServerBackupKind::DatabaseInstance
                        && (data.source_database_instance_uuid.is_none()
                            || backup.database_instance_uuid == data.source_database_instance_uuid)
                }),
            None => {
                ServerBackup::select_completed_by_server_uuid(
                    &state.database,
                    server.uuid,
                    data.backup_name.as_deref(),
                    data.backup_group_uuid,
                    &ServerBackupFilter {
                        kind: Some(ServerBackupKind::DatabaseInstance),
                        database_instance_uuid: data.source_database_instance_uuid,
                        database_type: None,
                    },
                    data.oldest,
                )
                .await?
            }
        };

        let backup = match backup {
            Some(backup) => backup,
            None => {
                return ApiResponse::error("backup not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        };

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

        let database_instance_uuid = match data
            .database_instance_uuid
            .or(backup.database_instance_uuid)
        {
            Some(database_instance_uuid) => database_instance_uuid,
            None => {
                return ApiResponse::error(
                    "the database instance this backup was taken from has been deleted, set a target database instance on this step",
                )
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
            }
        };

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

        if backup.database_type != Some(database_instance.r#type) {
            return ApiResponse::error("backup was taken from a different database engine")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let backup_configuration = match &backup.backup_configuration {
            Some(backup_configuration) => {
                backup_configuration.fetch_cached(&state.database).await?
            }
            None => {
                return ApiResponse::error(
                    "no backup configuration available, unable to restore backup",
                )
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
            }
        };

        if backup_configuration.maintenance_enabled {
            return ApiResponse::error(
                "cannot restore backup while backup configuration is in maintenance mode",
            )
            .with_status(StatusCode::EXPECTATION_FAILED)
            .ok();
        }

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

        let server_uuid = server.uuid;
        let backup_uuid = backup.uuid;
        let backup_name = backup.name.clone();
        let database_instance_uuid = database_instance.uuid;
        let schedule_uuid = data.schedule_uuid;
        let request_uuid = data.request_uuid;

        tokio::spawn(async move {
            let server = server.0;
            let backup_for_event = backup.clone();

            if let Err(err) = backup
                .restore_database(&state, server.clone(), &database_instance, request_uuid)
                .await
            {
                tracing::error!(backup = %backup_uuid, "failed to restore database backup: {:?}", err);

                match ServerDatabaseInstance::try_set_status_by_uuid(
                    state.database.write(),
                    database_instance_uuid,
                    Some(ServerDatabaseInstanceStatus::RestoringBackup),
                    None,
                )
                .await
                {
                    Ok(true) => {}
                    Ok(false) => return,
                    Err(err) => {
                        tracing::error!(
                            database_instance = %database_instance_uuid,
                            "failed to clear database instance restore status: {:#?}",
                            err
                        );

                        return;
                    }
                }

                if let Err(err) = ServerActivity::create(
                    &state,
                    shared::models::server_activity::CreateServerActivityOptions {
                        server_uuid,
                        user_uuid: None,
                        impersonator_uuid: None,
                        api_key_uuid: None,
                        schedule_uuid,
                        event: "server:database-backup.restore-failed".into(),
                        ip: None,
                        data: serde_json::json!({
                            "uuid": backup_uuid,
                            "name": backup_name,
                            "database_instance_uuid": database_instance.uuid,
                            "database_instance_name": database_instance.name,
                        }),
                        created: None,
                    },
                )
                .await
                {
                    tracing::warn!(
                        server = %server_uuid,
                        "failed to log remote activity for server: {:#?}",
                        err
                    );
                }

                ServerBackup::get_event_emitter().emit(
                    state.0.clone(),
                    ServerBackupEvent::RestoreCompleted {
                        backup: Box::new(backup_for_event),
                        server: Box::new(server),
                        successful: false,
                    },
                );

                return;
            }

            if let Err(err) = ServerActivity::create(
                &state,
                shared::models::server_activity::CreateServerActivityOptions {
                    server_uuid,
                    user_uuid: None,
                    impersonator_uuid: None,
                    api_key_uuid: None,
                    schedule_uuid,
                    event: "server:database-backup.restore".into(),
                    ip: None,
                    data: serde_json::json!({
                        "uuid": backup_uuid,
                        "name": backup_name,
                        "database_instance_uuid": database_instance.uuid,
                        "database_instance_name": database_instance.name,
                    }),
                    created: None,
                },
            )
            .await
            {
                tracing::warn!(
                    server = %server_uuid,
                    "failed to log remote activity for server: {:#?}",
                    err
                );
            }
        });

        ApiResponse::new_serialized(Response {
            uuid: backup_uuid,
            database_instance_uuid,
            request_uuid,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
