use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use crate::routes::api::client::servers::_server_::databases::instances::_instance_::GetServerDatabaseInstance;
    use axum::{extract::Query, http::StatusCode};
    use garde::Validate;
    use serde::Deserialize;
    use shared::{
        ApiError, GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    fn default_lines() -> u64 {
        100
    }

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Params {
        #[garde(range(min = 1, max = 1000))]
        #[serde(default = "default_lines")]
        pub lines: u64,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = String),
        (status = BAD_REQUEST, body = ApiError),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "database_instance" = uuid::Uuid,
            description = "The database instance ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "lines" = i64, Query,
            description = "The amount of database log lines to tail",
            example = "100",
            minimum = 1,
            maximum = 1000,
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        database_instance: GetServerDatabaseInstance,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("database-instances.logs")?;

        let logs = database_instance
            .database_agent_host
            .api_client(&state.database)
            .await?
            .get_instances_instance_logs(
                database_instance.uuid,
                &db_agent_api::instances_instance_logs::get::Query {
                    lines: Some(params.lines),
                    ..Default::default()
                },
            )
            .await?;

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
