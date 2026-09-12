use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod delete {
    use crate::routes::api::admin::system_backup_policies::_system_backup_policy_::GetSystemBackupPolicy;
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel, admin_activity::GetAdminActivityLogger,
            system_backup_policy_database_agent_host::SystemBackupPolicyDatabaseAgentHost,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "system_backup_policy" = uuid::Uuid,
            description = "The system backup policy ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "database_agent_host" = uuid::Uuid,
            description = "The database agent host ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        system_backup_policy: GetSystemBackupPolicy,
        activity_logger: GetAdminActivityLogger,
        Path((_system_backup_policy, database_agent_host)): Path<(uuid::Uuid, uuid::Uuid)>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("system-backup-policies.update")?;

        let policy_database_agent_host = match SystemBackupPolicyDatabaseAgentHost::by_system_backup_policy_uuid_database_agent_host_uuid(
            &state.database,
            system_backup_policy.uuid,
            database_agent_host,
        )
        .await?
        {
            Some(policy_database_agent_host) => policy_database_agent_host,
            None => {
                return ApiResponse::error("database agent host not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        };

        policy_database_agent_host.delete(&state, ()).await?;

        activity_logger
            .log(
                "system-backup-policy:database-agent-host.delete",
                serde_json::json!({
                    "system_backup_policy_uuid": system_backup_policy.uuid,
                    "database_agent_host_uuid": policy_database_agent_host.database_agent_host.uuid,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(delete::route))
        .with_state(state.clone())
}
