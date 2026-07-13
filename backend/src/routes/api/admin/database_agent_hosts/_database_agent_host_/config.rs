use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use crate::routes::api::admin::database_agent_hosts::_database_agent_host_::GetDatabaseAgentHost;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        config: db_agent_api::system_config::get::Response,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        database_agent_host: GetDatabaseAgentHost,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("database-agent-hosts.read")?;

        let mut config = database_agent_host
            .fetch_configuration(&state.database)
            .await?;

        if permissions
            .has_admin_permission("database-agent-hosts.read-token")
            .is_err()
        {
            config.api.token = "redacted".into();
        }

        ApiResponse::new_serialized(Response { config }).ok()
    }
}

mod patch {
    use crate::routes::api::admin::database_agent_hosts::_database_agent_host_::GetDatabaseAgentHost;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{admin_activity::GetAdminActivityLogger, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        applied: bool,
    }

    #[utoipa::path(patch, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
    ), request_body = serde_json::Value)]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        database_agent_host: GetDatabaseAgentHost,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(mut data): shared::Payload<serde_json::Value>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("database-agent-hosts.update")?;

        db_agent_api::strip_config_paths(&mut data);

        let applied = database_agent_host
            .update_configuration(&state.database, &data)
            .await?;

        activity_logger
            .log(
                "database-agent-host:update-config",
                serde_json::json!({
                    "uuid": database_agent_host.uuid,
                    "config": data,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response { applied }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(patch::route))
        .with_state(state.clone())
}
