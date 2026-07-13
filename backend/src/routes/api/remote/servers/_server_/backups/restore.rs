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
            server_backup::{ServerBackup, ServerBackupEvent},
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
        truncate_directory: bool,
        #[garde(skip)]
        #[serde(default)]
        restore_startup: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        adapter: wings_api::BackupAdapter,
        uuid: uuid::Uuid,
        download_url: Option<compact_str::CompactString>,
    }

    #[utoipa::path(post, path = "/", responses(
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
                ServerBackup::latest_completed_by_server_uuid(
                    &state.database,
                    server.uuid,
                    data.backup_name.as_deref(),
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

        let mut server = server.0;
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

        if data.restore_startup
            && let Err(err) = backup
                .restore_startup(&state, &mut transaction, &mut server)
                .await
        {
            transaction.rollback().await?;
            tracing::error!(
                server = %server.uuid,
                backup = %backup.uuid,
                "failed to restore server startup from backup: {:?}",
                err
            );

            return ApiResponse::error("failed to restore server startup from backup")
                .with_status(StatusCode::INTERNAL_SERVER_ERROR)
                .ok();
        }

        let download_url = match backup.wings_restore_download_url(&state, server.uuid).await {
            Ok(download_url) => download_url,
            Err(err) => {
                transaction.rollback().await?;
                tracing::error!(
                    server = %server.uuid,
                    backup = %backup.uuid,
                    "failed to generate backup download url: {:?}",
                    err
                );

                return ApiResponse::error("failed to generate backup download url")
                    .with_status(StatusCode::INTERNAL_SERVER_ERROR)
                    .ok();
            }
        };

        transaction.commit().await?;

        if let Err(err) = ServerActivity::create(
            &state,
            shared::models::server_activity::CreateServerActivityOptions {
                server_uuid: server.uuid,
                user_uuid: None,
                impersonator_uuid: None,
                api_key_uuid: None,
                schedule_uuid: data.schedule_uuid,
                event: "server:backup.restore".into(),
                ip: None,
                data: serde_json::json!({
                    "uuid": backup.uuid,
                    "name": backup.name,
                    "truncate_directory": data.truncate_directory,
                    "restore_startup": data.restore_startup,
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

        let response = Response {
            adapter: backup.disk.to_wings_adapter(),
            uuid: backup.uuid,
            download_url,
        };

        ServerBackup::get_event_emitter().emit(
            state.0.clone(),
            ServerBackupEvent::RestoreStarted {
                backup: Box::new(backup),
                server: Box::new(server),
            },
        );

        ApiResponse::new_serialized(response).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
