use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use crate::routes::api::admin::database_agent_hosts::_database_agent_host_::GetDatabaseAgentHost;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize, Deserialize)]
    struct ResponseStats {
        instances: i64,
        cpu: i64,
        memory: i64,
        disk: i64,
    }

    #[derive(ToSchema, Serialize)]
    struct ResponseLimits {
        memory: i64,
        disk: i64,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        limits: ResponseLimits,
        #[schema(inline)]
        allocated: ResponseStats,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "database_agent_host" = uuid::Uuid,
            description = "The database agent host ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        database_agent_host: GetDatabaseAgentHost,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("database-agent-hosts.read")?;

        let allocated = sqlx::query_as_unchecked!(
            ResponseStats,
            "SELECT
                COUNT(*) as instances,
                COALESCE(SUM(COALESCE(server_database_instances.cpu, t.cpu)), 0)::int8 as cpu,
                COALESCE(SUM(COALESCE(server_database_instances.memory, t.memory)), 0)::int8 as memory,
                COALESCE(SUM(COALESCE(server_database_instances.disk, t.disk)), 0)::int8 as disk
            FROM server_database_instances
            LEFT JOIN database_agent_templates t ON t.uuid = server_database_instances.database_agent_template_uuid
            WHERE server_database_instances.database_agent_host_uuid = $1",
            database_agent_host.uuid
        )
        .fetch_one(state.database.read())
        .await?;

        ApiResponse::new_serialized(Response {
            limits: ResponseLimits {
                memory: database_agent_host.memory,
                disk: database_agent_host.disk,
            },
            allocated,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
