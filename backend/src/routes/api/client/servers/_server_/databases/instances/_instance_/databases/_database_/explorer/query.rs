use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::client::servers::_server_::databases::instances::_instance_::GetServerDatabaseInstance;
    use axum::{extract::Path, http::StatusCode};
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
        (status = CONFLICT, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
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
            "database" = uuid::Uuid,
            description = "The database ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        database_instance: GetServerDatabaseInstance,
        activity_logger: GetServerActivityLogger,
        Path((_server, _database_instance, database)): Path<(String, uuid::Uuid, uuid::Uuid)>,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("database-instances.query-raw")?;

        let client = database_instance
            .database_agent_host
            .api_client(&state.database)
            .await?;

        let results = match client
            .post_instances_instance_databases_database_explorer_query(
                database_instance.uuid,
                database,
                &db_agent_api::instances_instance_databases_database_explorer_query::post::RequestBody {
                    query: data.query.clone().into(),
                    rows: data.rows,
                    read_only: data.read_only,
                },
            )
            .await
        {
            Ok(response) => response.results,
            Err(db_agent_api::client::ApiHttpError::Http(StatusCode::BAD_REQUEST, err)) => {
                return ApiResponse::new_serialized(ApiError::new_database_agent_value(err))
                    .with_status(StatusCode::BAD_REQUEST)
                    .ok();
            }
            Err(db_agent_api::client::ApiHttpError::Http(StatusCode::NOT_FOUND, err)) => {
                return ApiResponse::new_serialized(ApiError::new_database_agent_value(err))
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
            Err(db_agent_api::client::ApiHttpError::Http(StatusCode::REQUEST_TIMEOUT, err)) => {
                return ApiResponse::new_serialized(ApiError::new_database_agent_value(err))
                    .with_status(StatusCode::REQUEST_TIMEOUT)
                    .ok();
            }
            Err(db_agent_api::client::ApiHttpError::Http(StatusCode::CONFLICT, err)) => {
                return ApiResponse::new_serialized(ApiError::new_database_agent_value(err))
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(db_agent_api::client::ApiHttpError::Http(StatusCode::EXPECTATION_FAILED, err)) => {
                return ApiResponse::new_serialized(ApiError::new_database_agent_value(err))
                    .with_status(StatusCode::EXPECTATION_FAILED)
                    .ok();
            }
            Err(err) => return Err(err.into()),
        };

        activity_logger
            .log(
                "server:database-instance.database.query",
                serde_json::json!({
                    "uuid": database_instance.uuid,
                    "name": database_instance.name,
                    "database_uuid": database,
                    "read_only": data.read_only,
                    "query": data.query.chars().take(QUERY_ACTIVITY_LENGTH).collect::<String>(),
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            results: results.into_iter().map(Into::into).collect(),
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
