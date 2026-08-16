use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::client::servers::_server_::databases::_database_::GetServerDatabase;
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            server::GetServerActivityLogger,
            server_database::{
                QUERY_ACTIVITY_LENGTH, QUERY_DEFAULT_ROWS, QUERY_MAX_LENGTH, QUERY_MAX_ROWS,
                QueryResultSet,
            },
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    fn default_rows() -> u32 {
        QUERY_DEFAULT_ROWS
    }

    fn default_read_only() -> bool {
        true
    }

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(chars, min = 1, max = QUERY_MAX_LENGTH))]
        #[schema(min_length = 1, max_length = 65535)]
        query: String,

        #[garde(range(min = 1, max = QUERY_MAX_ROWS))]
        #[schema(minimum = 1, maximum = 1000)]
        #[serde(default = "default_rows")]
        rows: u32,

        #[garde(skip)]
        #[serde(default = "default_read_only")]
        read_only: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        results: Vec<QueryResultSet>,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = REQUEST_TIMEOUT, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "database" = uuid::Uuid,
            description = "The database ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        mut database: GetServerDatabase,
        activity_logger: GetServerActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("databases.query-raw")?;

        if database.database_host.maintenance_enabled {
            return ApiResponse::error(
                "cannot query database while database host is in maintenance mode",
            )
            .with_status(StatusCode::EXPECTATION_FAILED)
            .ok();
        }

        let results = match database
            .run_query(&state.database, &data.query, data.rows, data.read_only)
            .await
        {
            Ok(results) => results,
            Err(err) => return ApiResponse::from(err).ok(),
        };

        activity_logger
            .log(
                "server:database.query",
                serde_json::json!({
                    "uuid": database.uuid,
                    "name": database.name,
                    "read_only": data.read_only,
                    "query": data.query.chars().take(QUERY_ACTIVITY_LENGTH).collect::<String>(),
                }),
            )
            .await;

        ApiResponse::new_serialized(Response { results }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
