use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod restore;
mod restore_database;

mod post {
    use garde::Validate;
    use reqwest::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel,
            server::GetServer,
            server_activity::ServerActivity,
            server_backup::{BackupDisk, ServerBackup, ServerBackupKind},
            server_backup_group::ServerBackupGroup,
            server_database_instance::ServerDatabaseInstance,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(skip)]
        schedule_uuid: Option<uuid::Uuid>,

        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        name: Option<compact_str::CompactString>,

        #[garde(skip)]
        backup_group_uuid: Option<uuid::Uuid>,
        #[garde(skip)]
        database_instance_uuid: Option<uuid::Uuid>,

        #[garde(skip)]
        ignored_files: Vec<compact_str::CompactString>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        adapter: wings_api::BackupAdapter,
        uuid: uuid::Uuid,
        extension: Option<compact_str::CompactString>,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
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

        if server.destination_node.is_some() {
            return ApiResponse::error("server is transferring")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let database_instance = match data.database_instance_uuid {
            Some(database_instance_uuid) => {
                match ServerDatabaseInstance::by_server_uuid_uuid(
                    &state.database,
                    server.uuid,
                    database_instance_uuid,
                )
                .await?
                {
                    Some(database_instance) => Some(database_instance),
                    None => {
                        return ApiResponse::error("database instance not found")
                            .with_status(StatusCode::NOT_FOUND)
                            .ok();
                    }
                }
            }
            None => None,
        };

        let backup_group = match data.backup_group_uuid {
            Some(group_uuid) => {
                match ServerBackupGroup::by_server_uuid_uuid(
                    &state.database,
                    server.uuid,
                    group_uuid,
                )
                .await?
                {
                    Some(group) => Some(group),
                    None => {
                        tracing::warn!(
                            server = %server.uuid,
                            group = %group_uuid,
                            "scheduled backup referenced a deleted backup group, creating ungrouped"
                        );

                        if let Err(err) = ServerActivity::create(
                            &state,
                            shared::models::server_activity::CreateServerActivityOptions {
                                server_uuid: server.uuid,
                                user_uuid: None,
                                impersonator_uuid: None,
                                api_key_uuid: None,
                                schedule_uuid: data.schedule_uuid,
                                event: "server:backup-group.stale".into(),
                                ip: None,
                                data: serde_json::json!({
                                    "backup_group_uuid": group_uuid,
                                    "database_instance_uuid": database_instance
                                        .as_ref()
                                        .map(|database_instance| database_instance.uuid),
                                }),
                                created: None,
                            },
                        )
                        .await
                        {
                            tracing::warn!(
                                server = %server.uuid,
                                "failed to log stale backup group activity: {:#?}",
                                err
                            );
                        }

                        None
                    }
                }
            }
            None => None,
        };

        let backup_configuration = match &database_instance {
            Some(database_instance) => {
                let backup_configuration = match server.backup_configuration(&state.database).await
                {
                    Some(backup_configuration) => backup_configuration,
                    None => {
                        return ApiResponse::error(
                            "no backup configuration available, unable to create backup",
                        )
                        .with_status(StatusCode::EXPECTATION_FAILED)
                        .ok();
                    }
                };

                if matches!(
                    backup_configuration.backup_disk,
                    BackupDisk::Btrfs | BackupDisk::Zfs
                ) {
                    return ApiResponse::error(
                        "database backups cannot be created on a btrfs or zfs backup configuration",
                    )
                    .with_status(StatusCode::EXPECTATION_FAILED)
                    .ok();
                }

                if database_instance.database_agent_host.maintenance_enabled {
                    return ApiResponse::error(
                        "cannot create backup while database agent host is in maintenance mode",
                    )
                    .with_status(StatusCode::EXPECTATION_FAILED)
                    .ok();
                }

                if database_instance.is_restoring() {
                    return ApiResponse::error(
                        "a backup is being restored into the database instance",
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
                        return ApiResponse::new_serialized(ApiError::new_database_agent_value(
                            err,
                        ))
                        .with_status(status)
                        .ok();
                    }
                    Err(err) => return Err(err.into()),
                };

                if !matches!(
                    utilization.utilization.state,
                    db_agent_api::ContainerState::Running
                ) {
                    return ApiResponse::error(
                        "database instance must be running to create a backup",
                    )
                    .with_status(StatusCode::EXPECTATION_FAILED)
                    .ok();
                }

                Some(backup_configuration)
            }
            None => None,
        };

        let backups_lock = state
            .cache
            .lock(
                format!("servers::{}::backups", server.uuid),
                Some(30),
                Some(5),
            )
            .await?;

        let kind = if database_instance.is_some() {
            ServerBackupKind::DatabaseInstance
        } else {
            ServerBackupKind::Server
        };

        if let Some(group) = &backup_group {
            ServerBackup::rotate_group_for_create(&state, group, kind).await?;
        }

        let backups = ServerBackup::count_by_server_uuid(&state.database, server.uuid).await?;
        if backups >= server.backup_limit as i64
            && let Err(err) =
                ServerBackup::evict_one_by_server_uuid_kind(&state, &server, kind).await
        {
            tracing::error!(server = %server.uuid, "failed to delete old backup: {:?}", err);

            return ApiResponse::error("maximum number of backups reached")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let ratelimit = state
            .settings
            .get_as(|s| s.ratelimits.client_servers_backups_create)
            .await?;
        state
            .cache
            .ratelimit(
                "client/servers/backups/create",
                ratelimit.hits,
                ratelimit.window_seconds,
                server.uuid.to_string(),
            )
            .await?;

        let (ignored_files, metadata) = match &database_instance {
            Some(database_instance) => (
                Vec::new(),
                ServerBackup::generate_database_metadata(database_instance),
            ),
            None => (
                data.ignored_files,
                ServerBackup::generate_metadata(&state, &server).await?,
            ),
        };

        let options = shared::models::server_backup::CreateServerBackupOptions {
            server: &server,
            name: data.name.unwrap_or_else(ServerBackup::default_name),
            backup_group_uuid: backup_group.as_ref().map(|group| group.uuid),
            system_backup_policy_uuid: None,
            database_instance: database_instance.as_ref(),
            backup_configuration,
            ignored_files,
            metadata,
        };
        let backup = ServerBackup::create_raw(&state, options).await?;

        drop(backups_lock);

        let (event, activity_data) = match &database_instance {
            Some(database_instance) => (
                "server:database-backup.create",
                serde_json::json!({
                    "uuid": backup.uuid,
                    "name": backup.name,
                    "backup_group_uuid": backup.backup_group_uuid,
                    "database_instance_uuid": database_instance.uuid,
                    "database_instance_name": database_instance.name,
                }),
            ),
            None => (
                "server:backup.create",
                serde_json::json!({
                    "uuid": backup.uuid,
                    "name": backup.name,
                    "ignored_files": backup.ignored_files,
                }),
            ),
        };

        if let Err(err) = ServerActivity::create(
            &state,
            shared::models::server_activity::CreateServerActivityOptions {
                server_uuid: server.uuid,
                user_uuid: None,
                impersonator_uuid: None,
                api_key_uuid: None,
                schedule_uuid: data.schedule_uuid,
                event: event.into(),
                ip: None,
                data: activity_data,
                created: None,
            },
        )
        .await
        {
            tracing::warn!(
                server = %server.uuid,
                "failed to log remote activity for server: {:#?}",
                err
            );
        }

        ApiResponse::new_serialized(Response {
            adapter: backup.disk.to_wings_adapter(),
            uuid: backup.uuid,
            extension: database_instance
                .as_ref()
                .map(|database_instance| database_instance.r#type.dump_extension().into()),
        })
        .ok()
    }
}

mod delete {
    use garde::Validate;
    use reqwest::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel, DeletableModel,
            server::GetServer,
            server_activity::ServerActivity,
            server_backup::{
                DeleteServerBackupOptions, ServerBackup, ServerBackupFilter, ServerBackupKind,
            },
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(skip)]
        schedule_uuid: Option<uuid::Uuid>,

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
        kind: Option<ServerBackupKind>,
        #[garde(skip)]
        #[serde(default)]
        database_instance_uuid: Option<uuid::Uuid>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        uuid: uuid::Uuid,
    }

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
        (status = BAD_REQUEST, body = ApiError),
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

        let kind = data.kind.unwrap_or(ServerBackupKind::Server);

        let backup = match data.backup_uuid {
            Some(uuid) => ServerBackup::by_server_uuid_uuid(&state.database, server.uuid, uuid)
                .await?
                .filter(|backup| {
                    backup.deleted.is_none()
                        && backup.deleting.is_none()
                        && backup.kind == kind
                        && (data.database_instance_uuid.is_none()
                            || backup.database_instance_uuid == data.database_instance_uuid)
                }),
            None => {
                ServerBackup::select_completed_by_server_uuid(
                    &state.database,
                    server.uuid,
                    data.backup_name.as_deref(),
                    data.backup_group_uuid,
                    &ServerBackupFilter {
                        kind: Some(kind),
                        database_instance_uuid: data.database_instance_uuid,
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

        if backup.system_backup_policy_uuid.is_some() {
            return ApiResponse::error("system backups cannot be deleted")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        if backup.locked {
            return ApiResponse::error("backup is locked and cannot be deleted")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let uuid = backup.uuid;
        let name = backup.name.clone();
        let event = match backup.kind {
            ServerBackupKind::Server => "server:backup.delete",
            ServerBackupKind::DatabaseInstance => "server:database-backup.delete",
        };

        if let Err(err) = backup
            .delete(&state, DeleteServerBackupOptions::default())
            .await
        {
            tracing::error!(
                server = %server.uuid,
                backup = %uuid,
                "failed to delete backup: {:?}",
                err
            );

            return ApiResponse::error("failed to delete backup")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        if let Err(err) = ServerActivity::create(
            &state,
            shared::models::server_activity::CreateServerActivityOptions {
                server_uuid: server.uuid,
                user_uuid: None,
                impersonator_uuid: None,
                api_key_uuid: None,
                schedule_uuid: data.schedule_uuid,
                event: event.into(),
                ip: None,
                data: serde_json::json!({
                    "uuid": uuid,
                    "name": name,
                    "database_instance_uuid": backup.database_instance_uuid,
                }),
                created: None,
            },
        )
        .await
        {
            tracing::warn!(
                server = %server.uuid,
                "failed to log remote activity for server: {:#?}",
                err
            );
        }

        ApiResponse::new_serialized(Response { uuid }).ok()
    }
}

mod patch {
    use garde::Validate;
    use reqwest::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel, UpdatableModel,
            server::GetServer,
            server_activity::ServerActivity,
            server_backup::{
                ServerBackup, ServerBackupFilter, ServerBackupKind, UpdateServerBackupOptions,
            },
            server_backup_group::ServerBackupGroup,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(skip)]
        schedule_uuid: Option<uuid::Uuid>,

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
        kind: Option<ServerBackupKind>,
        #[garde(skip)]
        #[serde(default)]
        database_instance_uuid: Option<uuid::Uuid>,

        #[garde(skip)]
        #[serde(default)]
        target_backup_group_uuid: Option<uuid::Uuid>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        uuid: uuid::Uuid,
    }

    #[utoipa::path(patch, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
        (status = BAD_REQUEST, body = ApiError),
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

        let target_group = match data.target_backup_group_uuid {
            Some(group_uuid) => {
                match ServerBackupGroup::by_server_uuid_uuid(
                    &state.database,
                    server.uuid,
                    group_uuid,
                )
                .await?
                {
                    Some(group) => Some(group),
                    None => {
                        return ApiResponse::error("target backup group not found")
                            .with_status(StatusCode::NOT_FOUND)
                            .ok();
                    }
                }
            }
            None => None,
        };

        let kind = data.kind.unwrap_or(ServerBackupKind::Server);

        let backup = match data.backup_uuid {
            Some(uuid) => ServerBackup::by_server_uuid_uuid(&state.database, server.uuid, uuid)
                .await?
                .filter(|backup| {
                    backup.deleted.is_none()
                        && backup.deleting.is_none()
                        && backup.kind == kind
                        && (data.database_instance_uuid.is_none()
                            || backup.database_instance_uuid == data.database_instance_uuid)
                }),
            None => {
                ServerBackup::select_completed_by_server_uuid(
                    &state.database,
                    server.uuid,
                    data.backup_name.as_deref(),
                    data.backup_group_uuid,
                    &ServerBackupFilter {
                        kind: Some(kind),
                        database_instance_uuid: data.database_instance_uuid,
                        database_type: None,
                    },
                    data.oldest,
                )
                .await?
            }
        };

        let mut backup = match backup {
            Some(backup) => backup,
            None => {
                return ApiResponse::error("backup not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        };

        if backup.system_backup_policy_uuid.is_some() {
            return ApiResponse::error("system backups cannot be modified")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        if let Some(group) = &target_group {
            ServerBackup::rotate_group_for_create(&state, group, backup.kind).await?;
        }

        let uuid = backup.uuid;

        backup
            .update(
                &state,
                UpdateServerBackupOptions {
                    name: None,
                    backup_group_uuid: Some(target_group.as_ref().map(|group| group.uuid)),
                    locked: None,
                },
            )
            .await?;

        if let Err(err) = ServerActivity::create(
            &state,
            shared::models::server_activity::CreateServerActivityOptions {
                server_uuid: server.uuid,
                user_uuid: None,
                impersonator_uuid: None,
                api_key_uuid: None,
                schedule_uuid: data.schedule_uuid,
                event: match backup.kind {
                    ServerBackupKind::Server => "server:backup.update",
                    ServerBackupKind::DatabaseInstance => "server:database-backup.update",
                }
                .into(),
                ip: None,
                data: serde_json::json!({
                    "uuid": uuid,
                    "name": backup.name,
                    "database_instance_uuid": backup.database_instance_uuid,
                    "backup_group_uuid": target_group.as_ref().map(|group| group.uuid),
                }),
                created: None,
            },
        )
        .await
        {
            tracing::warn!(
                server = %server.uuid,
                "failed to log remote activity for server: {:#?}",
                err
            );
        }

        ApiResponse::new_serialized(Response { uuid }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .routes(routes!(delete::route))
        .routes(routes!(patch::route))
        .nest("/restore", restore::router(state))
        .nest("/restore-database", restore_database::router(state))
        .with_state(state.clone())
}
