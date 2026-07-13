use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::admin::database_agent_hosts::_database_agent_host_::GetDatabaseAgentHost;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
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
        permissions.has_admin_permission("database-agent-hosts.test")?;

        let client = match database_agent_host.api_client(&state.database).await {
            Ok(client) => client,
            Err(err) => {
                return ApiResponse::error(err.to_string())
                    .with_status(StatusCode::EXPECTATION_FAILED)
                    .ok();
            }
        };

        if let Err(err) = client.get_status().await {
            return ApiResponse::error(anyhow::Error::from(err).to_string())
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
