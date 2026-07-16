use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod restore;

mod post {
    use garde::Validate;
    use reqwest::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel, server::GetServer, server_activity::ServerActivity,
            server_backup::ServerBackup, server_backup_group::ServerBackupGroup,
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
        ignored_files: Vec<compact_str::CompactString>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        adapter: wings_api::BackupAdapter,
        uuid: uuid::Uuid,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
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
                                data: serde_json::json!({ "backup_group_uuid": group_uuid }),
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

        let backups_lock = state
            .cache
            .lock(
                format!("servers::{}::backups", server.uuid),
                Some(30),
                Some(5),
            )
            .await?;

        if let Some(group) = &backup_group {
            ServerBackup::rotate_group_for_create(&state, group).await?;
        }

        let backups = ServerBackup::count_by_server_uuid(&state.database, server.uuid).await?;
        if backups >= server.backup_limit as i64
            && let Err(err) = ServerBackup::evict_one_by_server_uuid(&state, &server).await
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

        let options = shared::models::server_backup::CreateServerBackupOptions {
            server: &server,
            name: data.name.unwrap_or_else(ServerBackup::default_name),
            backup_group_uuid: backup_group.as_ref().map(|group| group.uuid),
            ignored_files: data.ignored_files,
            metadata: ServerBackup::generate_metadata(&state, &server).await?,
        };
        let backup = ServerBackup::create_raw(&state, options).await?;

        drop(backups_lock);

        if let Err(err) = ServerActivity::create(
            &state,
            shared::models::server_activity::CreateServerActivityOptions {
                server_uuid: server.uuid,
                user_uuid: None,
                impersonator_uuid: None,
                api_key_uuid: None,
                schedule_uuid: data.schedule_uuid,
                event: "server:backup.create".into(),
                ip: None,
                data: serde_json::json!({
                    "uuid": backup.uuid,
                    "name": backup.name,
                    "ignored_files": backup.ignored_files,
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

        ApiResponse::new_serialized(Response {
            adapter: backup.disk.to_wings_adapter(),
            uuid: backup.uuid,
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
            server_backup::{DeleteServerBackupOptions, ServerBackup},
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

        let backup = match data.backup_uuid {
            Some(uuid) => ServerBackup::by_server_uuid_uuid(&state.database, server.uuid, uuid)
                .await?
                .filter(|backup| backup.deleted.is_none()),
            None => {
                ServerBackup::select_completed_by_server_uuid(
                    &state.database,
                    server.uuid,
                    data.backup_name.as_deref(),
                    data.backup_group_uuid,
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

        if backup.locked {
            return ApiResponse::error("backup is locked and cannot be deleted")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let uuid = backup.uuid;
        let name = backup.name.clone();

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
                event: "server:backup.delete".into(),
                ip: None,
                data: serde_json::json!({
                    "uuid": uuid,
                    "name": name,
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
            server_backup::{ServerBackup, UpdateServerBackupOptions},
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

        let backup = match data.backup_uuid {
            Some(uuid) => ServerBackup::by_server_uuid_uuid(&state.database, server.uuid, uuid)
                .await?
                .filter(|backup| backup.deleted.is_none()),
            None => {
                ServerBackup::select_completed_by_server_uuid(
                    &state.database,
                    server.uuid,
                    data.backup_name.as_deref(),
                    data.backup_group_uuid,
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

        if let Some(group) = &target_group {
            ServerBackup::rotate_group_for_create(&state, group).await?;
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
                event: "server:backup.update".into(),
                ip: None,
                data: serde_json::json!({
                    "uuid": uuid,
                    "name": backup.name,
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
        .routes(routes!(post::route, delete::route, patch::route))
        .nest("/restore", restore::router(state))
        .with_state(state.clone())
}
