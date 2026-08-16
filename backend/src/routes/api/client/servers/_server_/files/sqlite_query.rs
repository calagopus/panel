use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            server::{GetServer, GetServerActivityLogger},
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
        #[garde(length(chars, min = 1, max = 512))]
        #[schema(min_length = 1, max_length = 512)]
        file: compact_str::CompactString,

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
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        mut server: GetServer,
        activity_logger: GetServerActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("files.read-content")?;
        permissions.has_server_permission("files.query-raw")?;
        if !data.read_only {
            permissions.has_server_permission("files.update")?;
        }

        if server.is_ignored(&data.file, false) {
            return ApiResponse::error("file not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        }

        let results = match server
            .node
            .fetch_cached(&state.database)
            .await?
            .api_client(&state.database)
            .await?
            .post_servers_server_files_sqlite_query(
                server.uuid,
                &wings_api::servers_server_files_sqlite_query::post::RequestBody {
                    file: data.file.clone(),
                    query: data.query.clone().into(),
                    read_only: data.read_only,
                    rows: data.rows,
                },
            )
            .await
        {
            Ok(response) => response.results,
            Err(wings_api::client::ApiHttpError::Http(StatusCode::BAD_REQUEST, err)) => {
                return ApiResponse::new_serialized(ApiError::new_wings_value(err))
                    .with_status(StatusCode::BAD_REQUEST)
                    .ok();
            }
            Err(wings_api::client::ApiHttpError::Http(StatusCode::NOT_FOUND, err)) => {
                return ApiResponse::new_serialized(ApiError::new_wings_value(err))
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
            Err(wings_api::client::ApiHttpError::Http(StatusCode::REQUEST_TIMEOUT, err)) => {
                return ApiResponse::new_serialized(ApiError::new_wings_value(err))
                    .with_status(StatusCode::REQUEST_TIMEOUT)
                    .ok();
            }
            Err(wings_api::client::ApiHttpError::Http(StatusCode::EXPECTATION_FAILED, err)) => {
                return ApiResponse::new_serialized(ApiError::new_wings_value(err))
                    .with_status(StatusCode::EXPECTATION_FAILED)
                    .ok();
            }
            Err(err) => return Err(err.into()),
        };

        activity_logger
            .log(
                "server:file.sqlite-query",
                serde_json::json!({
                    "file": data.file,
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
