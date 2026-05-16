use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::remote::backups::_backup_::GetBackup;
    use axum::http::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            ByUuid, CreatableModel, EventEmittingModel,
            node::GetNode,
            server::Server,
            server_activity::ServerActivity,
            server_backup::{ServerBackup, ServerBackupEvent},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        server_uuid: Option<uuid::Uuid>,

        successful: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
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
        let server_uuid = match data.server_uuid {
            Some(server_uuid) => server_uuid,
            None => {
                if let Some(server) = &backup.server {
                    server.uuid
                } else {
                    return ApiResponse::error("server uuid not found")
                        .with_status(StatusCode::NOT_FOUND)
                        .ok();
                }
            }
        };

        if sqlx::query!(
            "UPDATE servers
            SET status = NULL
            WHERE servers.uuid = $1 AND servers.node_uuid = $2 AND servers.status = 'RESTORING_BACKUP'",
            server_uuid,
            node.uuid
        )
        .execute(state.database.write())
        .await?
        .rows_affected()
            == 0
        {
            return ApiResponse::error("server is not restoring a backup")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        if let Err(err) = ServerActivity::create(
            &state,
            shared::models::server_activity::CreateServerActivityOptions {
                server_uuid,
                user_uuid: None,
                impersonator_uuid: None,
                api_key_uuid: None,
                schedule_uuid: None,
                event: if data.successful {
                    "server:backup.restore-completed"
                } else {
                    "server:backup.restore-failed"
                }
                .into(),
                ip: None,
                data: serde_json::json!({
                    "uuid": backup.0.uuid,
                    "name": backup.0.name,
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

        match Server::by_uuid(&state.database, server_uuid).await {
            Ok(server) => {
                ServerBackup::get_event_emitter().emit(
                    state.0.clone(),
                    ServerBackupEvent::RestoreCompleted {
                        backup: Box::new(backup.0),
                        server: Box::new(server),
                        successful: data.successful,
                    },
                );
            }
            Err(err) => {
                tracing::warn!(backup = %backup.uuid, "failed to fetch server for RestoreCompleted event: {:#?}", err);
            }
        }

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
