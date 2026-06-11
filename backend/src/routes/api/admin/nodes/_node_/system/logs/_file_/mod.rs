use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod ws;

mod get {
    use axum::{
        extract::{Path, Query},
        http::StatusCode,
    };
    use garde::Validate;
    use serde::Deserialize;
    use shared::{
        ApiError, GetState,
        models::{node::GetNode, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };

    fn default_lines() -> u64 {
        1000
    }

    #[derive(Validate, Deserialize)]
    pub struct Params {
        #[garde(range(min = 1))]
        #[serde(default = "default_lines")]
        pub lines: u64,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = String),
    ), params(
        (
            "node" = uuid::Uuid,
            description = "The node ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "file" = String,
            description = "The log file name",
            example = "wings.log",
        ),
        (
            "lines" = u64, Query,
            description = "The amount of log lines to tail",
            example = "100",
            minimum = 1,
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        node: GetNode,
        Path((_node, file)): Path<(uuid::Uuid, String)>,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("nodes.read")?;

        let logs = node
            .api_client(&state.database)
            .await?
            .get_system_logs_file(&file, params.lines)
            .await?;

        ApiResponse::new_stream(logs)
            .with_header("Content-Type", "text/plain")
            .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .nest("/ws", ws::router(state))
        .with_state(state.clone())
}
