use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::remote::backups::_backup_::GetBackup;
    use axum::http::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel, EventEmittingModel,
            node::GetNode,
            server::Server,
            server_activity::ServerActivity,
            server_backup::{ServerBackup, ServerBackupEvent, ServerBackupKind},
            server_database_instance::{ServerDatabaseInstance, ServerDatabaseInstanceStatus},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        database_instance: Option<uuid::Uuid>,

        successful: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "backup" = uuid::Uuid,
            description = "The backup ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        node: GetNode,
        backup: GetBackup,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if backup.kind != ServerBackupKind::DatabaseInstance {
            return ApiResponse::error("backup is not a database instance backup")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let server_uuid = match &backup.server {
            Some(server) => server.uuid,
            None => {
                return ApiResponse::error("server uuid not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        };

        let Some(database_instance_uuid) = data.database_instance.or(backup.database_instance_uuid)
        else {
            return ApiResponse::error("database instance not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        };

        if ServerDatabaseInstance::by_server_uuid_uuid(
            &state.database,
            server_uuid,
            database_instance_uuid,
        )
        .await?
        .is_none()
        {
            return ApiResponse::error("database instance not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        }

        if !ServerDatabaseInstance::try_set_status_by_uuid(
            state.database.write(),
            database_instance_uuid,
            Some(ServerDatabaseInstanceStatus::RestoringBackup),
            None,
        )
        .await?
        {
            return ApiResponse::error("database instance is not restoring a backup")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let server =
            match Server::by_node_uuid_uuid(&state.database, node.uuid, server_uuid).await? {
                Some(server) => server,
                None => {
                    return ApiResponse::error("server not found")
                        .with_status(StatusCode::NOT_FOUND)
                        .ok();
                }
            };

        if let Err(err) = ServerActivity::create(
            &state,
            shared::models::server_activity::CreateServerActivityOptions {
                server_uuid,
                user_uuid: None,
                impersonator_uuid: None,
                api_key_uuid: None,
                schedule_uuid: None,
                event: if data.successful {
                    "server:database-backup.restore-completed"
                } else {
                    "server:database-backup.restore-failed"
                }
                .into(),
                ip: None,
                data: serde_json::json!({
                    "uuid": backup.0.uuid,
                    "name": backup.0.name,
                    "database_instance_uuid": database_instance_uuid,
                }),
                created: None,
            },
        )
        .await
        {
            tracing::warn!(
                backup = %backup.uuid,
                "failed to log server activity: {:#?}",
                err
            );
        }

        ServerBackup::get_event_emitter().emit(
            state.0.clone(),
            ServerBackupEvent::RestoreCompleted {
                backup: Box::new(backup.0),
                server: Box::new(server),
                successful: data.successful,
            },
        );

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
