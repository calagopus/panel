use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _backup_;
mod groups;
mod system;
mod unlock;
mod usage;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            IntoApiObject, Pagination, PaginationParamsWithSearch,
            server::GetServer,
            server_backup::{ServerBackup, ServerBackupFilter, ServerBackupKind},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Params {
        #[serde(default)]
        ungrouped: bool,
        kind: Option<ServerBackupKind>,
        database_instance_uuid: Option<uuid::Uuid>,
        database_type: Option<db_agent_api::DatabaseAgentType>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        backups: Pagination<shared::models::server_backup::ApiServerBackup>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "page" = i64, Query,
            description = "The page number",
            example = "1",
        ),
        (
            "per_page" = i64, Query,
            description = "The number of items per page",
            example = "10",
        ),
        (
            "search" = Option<String>, Query,
            description = "Search term for items",
        ),
        (
            "ungrouped" = bool, Query,
            description = "Only show backups that are not assigned to a backup group",
            example = "false",
        ),
        (
            "kind" = Option<shared::models::server_backup::ServerBackupKind>, Query,
            description = "Only show backups of this kind",
        ),
        (
            "database_instance_uuid" = Option<uuid::Uuid>, Query,
            description = "Only show backups taken from this database instance",
        ),
        (
            "database_type" = Option<db_agent_api::DatabaseAgentType>, Query,
            description = "Only show database backups taken from this database engine",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        Query(pagination): Query<PaginationParamsWithSearch>,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&pagination) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("backups.read")?;

        let filter = ServerBackupFilter {
            kind: params.kind,
            database_instance_uuid: params.database_instance_uuid,
            database_type: params.database_type,
        };

        let backups = if params.ungrouped {
            ServerBackup::by_ungrouped_server_uuid_node_uuid_with_pagination(
                &state.database,
                server.uuid,
                server.node.uuid,
                pagination.page,
                pagination.per_page,
                pagination.search.as_deref(),
                &filter,
            )
            .await
        } else {
            ServerBackup::by_server_uuid_node_uuid_with_pagination(
                &state.database,
                server.uuid,
                server.node.uuid,
                pagination.page,
                pagination.per_page,
                pagination.search.as_deref(),
                &filter,
            )
            .await
        }?;

        ApiResponse::new_serialized(Response {
            backups: backups
                .try_async_map(|backup| backup.into_api_object(&state, ()))
                .await?,
        })
        .ok()
    }
}

mod post {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel, IntoApiObject,
            server::{GetServer, GetServerActivityLogger},
            server_backup::{BackupDisk, GroupRotationOutcome, ServerBackup, ServerBackupKind},
            server_backup_group::ServerBackupGroup,
            server_database_instance::ServerDatabaseInstance,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
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
        backup: shared::models::server_backup::ApiServerBackup,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
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
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        activity_logger: GetServerActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("backups.create")?;
        if data.database_instance_uuid.is_some() {
            permissions.has_server_permission("database-instances.read")?;
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

        let backup_group = if let Some(group_uuid) = data.backup_group_uuid {
            match ServerBackupGroup::by_server_uuid_uuid(&state.database, server.uuid, group_uuid)
                .await?
            {
                Some(group) => Some(group),
                None => {
                    return ApiResponse::error("backup group not found")
                        .with_status(StatusCode::NOT_FOUND)
                        .ok();
                }
            }
        } else {
            None
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

        if let Some(group) = &backup_group
            && ServerBackup::rotate_group_for_create(&state, group, kind).await?
                == GroupRotationOutcome::BlockedAllLocked
        {
            return ApiResponse::error("backup group is full and all of its backups are locked")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let backups = ServerBackup::count_by_server_uuid(&state.database, server.uuid).await?;
        if backups >= server.backup_limit as i64 {
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
        let backup = ServerBackup::create(&state, options).await?;

        drop(backups_lock);

        match &database_instance {
            Some(database_instance) => {
                activity_logger
                    .log(
                        "server:database-backup.create",
                        serde_json::json!({
                            "uuid": backup.uuid,
                            "name": backup.name,
                            "backup_group_uuid": backup.backup_group_uuid,
                            "database_instance_uuid": database_instance.uuid,
                            "database_instance_name": database_instance.name,
                        }),
                    )
                    .await;
            }
            None => {
                activity_logger
                    .log(
                        "server:backup.create",
                        serde_json::json!({
                            "uuid": backup.uuid,
                            "name": backup.name,
                            "backup_group_uuid": backup.backup_group_uuid,
                            "ignored_files": backup.ignored_files,
                        }),
                    )
                    .await;
            }
        }

        ApiResponse::new_serialized(Response {
            backup: backup.into_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/groups", groups::router(state))
        .nest("/system", system::router(state))
        .nest("/unlock", unlock::router(state))
        .nest("/usage", usage::router(state))
        .nest("/{backup}", _backup_::router(state))
        .with_state(state.clone())
}
