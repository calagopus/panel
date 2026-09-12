use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::admin::database_agent_hosts::_database_agent_host_::GetDatabaseAgentHost;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            admin_activity::GetAdminActivityLogger,
            server_backup::{FailedServerBackupScope, ServerBackup},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        force: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        queued: i64,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "database_agent_host" = uuid::Uuid,
            description = "The database agent host ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        database_agent_host: GetDatabaseAgentHost,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("database-agent-hosts.backups")?;
        permissions.has_admin_permission("nodes.backups")?;

        let scope = FailedServerBackupScope::DatabaseAgentHost(database_agent_host.uuid);
        let queued = ServerBackup::count_failed(&state.database, scope).await?;

        if queued > 0 {
            let state = state.0.clone();
            let database_agent_host_uuid = database_agent_host.uuid;

            tokio::spawn(async move {
                if let Err(err) = ServerBackup::delete_failed(&state, scope, data.force).await {
                    tracing::error!(
                        database_agent_host = %database_agent_host_uuid,
                        "failed to delete failed database agent host backups: {:#?}",
                        err
                    );
                }
            });
        }

        activity_logger
            .log(
                "database-agent-host:backup.delete-failed",
                serde_json::json!({
                    "database_agent_host_uuid": database_agent_host.uuid,

                    "name": database_agent_host.name,
                    "force": data.force,
                    "queued": queued,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response { queued }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
