use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use axum::{extract::Query, http::StatusCode};
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{Pagination, server::GetServer, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Params {
        #[garde(range(min = 1))]
        #[serde(default = "Pagination::default_page")]
        page: i64,
        #[garde(range(min = 1, max = 100))]
        #[serde(default = "Pagination::default_per_page")]
        per_page: i64,

        #[garde(skip)]
        #[serde(default)]
        directory: String,

        #[garde(skip)]
        #[serde(default)]
        sort: wings_api::DirectorySortingMode,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        is_filesystem_primary: bool,
        is_filesystem_writable: bool,
        is_filesystem_fast: bool,

        #[schema(inline)]
        entries: Pagination<wings_api::DirectoryEntry>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
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
            "page" = i64, Query,
            description = "The page number for pagination",
            example = "1",
        ),
        (
            "per_page" = i64, Query,
            description = "The number of items per page",
            example = "10",
        ),
        (
            "directory" = String, Query,
            description = "The directory to list files from",
            example = "/",
        ),
        (
            "sort" = wings_api::DirectorySortingMode, Query,
            description = "The sorting mode to use for the files",
            example = "name_asc"
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        mut server: GetServer,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("files.read")?;

        if server.is_ignored(&params.directory, true) {
            return ApiResponse::error("directory not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        }

        let entries = match server
            .node
            .fetch_cached(&state.database)
            .await?
            .api_client(&state.database)
            .await?
            .get_servers_server_files_list(
                server.uuid,
                &params.directory,
                server.0.subuser_ignored_files.unwrap_or_default(),
                params.per_page as u64,
                params.page as u64,
                params.sort,
            )
            .await
        {
            Ok(data) => data,
            Err(wings_api::client::ApiHttpError::Http(StatusCode::NOT_FOUND, err)) => {
                return ApiResponse::new_serialized(ApiError::new_wings_value(err))
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
            Err(err) => return Err(err.into()),
        };

        ApiResponse::new_serialized(Response {
            is_filesystem_primary: entries.filesystem_primary,
            is_filesystem_writable: entries.filesystem_writable,
            is_filesystem_fast: entries.filesystem_fast,
            entries: Pagination {
                total: entries.total as i64,
                per_page: params.per_page,
                page: params.page,
                data: entries.entries,
            },
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
