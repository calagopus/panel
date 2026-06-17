use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use crate::routes::api::remote::backups::_backup_::GetBackup;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::server_backup::BackupDisk,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        url: compact_str::CompactString,
        datastore: compact_str::CompactString,
        namespace: Option<compact_str::CompactString>,
        token_id: compact_str::CompactString,
        token_secret: compact_str::CompactString,
        fingerprint: compact_str::CompactString,
        backup_id_prefix: Option<compact_str::CompactString>,

        server_uuid: Option<uuid::Uuid>,
        backup_created: chrono::DateTime<chrono::Utc>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "backup" = uuid::Uuid,
            description = "The backup ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(state: GetState, backup: GetBackup) -> ApiResponseResult {
        if backup.disk != BackupDisk::ProxmoxBackupServer {
            return ApiResponse::error("backup is not stored on Proxmox Backup Server")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let backup_configuration = match backup.0.backup_configuration {
            Some(backup_configuration) => {
                backup_configuration.fetch_cached(&state.database).await?
            }
            None => {
                return ApiResponse::error("backup does not have a backup configuration assigned")
                    .with_status(StatusCode::EXPECTATION_FAILED)
                    .ok();
            }
        };

        let mut pbs_configuration = match backup_configuration.backup_configs.pbs {
            Some(config) => config,
            None => {
                return ApiResponse::error("Proxmox Backup Server configuration not found")
                    .with_status(StatusCode::EXPECTATION_FAILED)
                    .ok();
            }
        };
        pbs_configuration.decrypt(&state.database).await?;

        ApiResponse::new_serialized(Response {
            url: pbs_configuration.url,
            datastore: pbs_configuration.datastore,
            namespace: pbs_configuration.namespace,
            token_id: pbs_configuration.token_id,
            token_secret: pbs_configuration.token_secret,
            fingerprint: pbs_configuration.fingerprint,
            backup_id_prefix: pbs_configuration.backup_id_prefix,
            server_uuid: backup.0.server.map(|server| server.uuid),
            backup_created: backup.0.created.and_utc(),
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
