use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use axum::{extract::Query, http::StatusCode};
    use garde::Validate;
    use serde::Deserialize;
    use shared::{
        ApiError, GetState,
        models::{server::GetServer, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    fn default_lines() -> u64 {
        1000
    }

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Params {
        #[garde(range(min = 1))]
        #[serde(default = "default_lines")]
        pub lines: u64,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = String),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "lines" = u64, Query,
            description = "The amount of server install log lines to tail",
            example = "1000",
            minimum = 1,
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("servers.read")?;

        let logs = match server
            .node
            .fetch_cached(&state.database)
            .await?
            .api_client(&state.database)
            .await?
            .get_servers_server_logs_install(server.uuid, params.lines)
            .await
        {
            Ok(logs) => logs,
            Err(wings_api::client::ApiHttpError::Http(StatusCode::NOT_FOUND, _)) => {
                return ApiResponse::error("no install log found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        };

        ApiResponse::new_stream(logs)
            .with_header("Content-Type", "text/plain")
            .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
