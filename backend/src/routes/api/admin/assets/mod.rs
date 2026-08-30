use super::State;
use axum::extract::DefaultBodyLimit;
use utoipa_axum::{
    router::{OpenApiRouter, UtoipaMethodRouterExt},
    routes,
};

mod delete;
mod search;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{Pagination, PaginationParams, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        assets: Pagination<shared::storage::StorageAsset>,
    }

    #[derive(ToSchema, Deserialize)]
    pub struct Params {
        #[serde(default)]
        directory: compact_str::CompactString,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
    ), params(
        (
            "page" = i64, Query,
            description = "The page number",
            example = "1",
        ),
        (
            "per_page" = i64, Query,
            description = "The number of items per page",
            example = "10",
        ),
        (
            "directory" = Option<String>, Query,
            description = "Directory path to list (relative to assets root)",
            example = "images",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        Query(pagination): Query<PaginationParams>,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("assets.read")?;

        if let Err(errors) = shared::utils::validate_data(&pagination) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let directory = params.directory.trim_matches('/');
        if directory.contains("..") {
            return ApiResponse::error("invalid directory path")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let assets = state
            .storage
            .list(
                "assets",
                directory,
                pagination.page as usize,
                pagination.per_page as usize,
            )
            .await?;

        ApiResponse::new_serialized(Response { assets }).ok()
    }
}

mod put {
    use axum::{extract::Query, http::StatusCode};
    use compact_str::ToCompactString;
    use futures_util::TryStreamExt;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{admin_activity::GetAdminActivityLogger, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        assets: Vec<shared::storage::StorageAsset>,
    }

    #[derive(Deserialize)]
    pub struct Params {
        #[serde(default)]
        directory: compact_str::CompactString,
    }

    #[utoipa::path(put, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
    ), params(
        (
            "directory" = Option<String>, Query,
            description = "Directory path to upload to (relative to assets root)",
            example = "images",
        ),
    ), request_body = String)]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        Query(query): Query<Params>,
        mut multipart: axum::extract::Multipart,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("assets.upload")?;

        let directory = query.directory.trim_matches('/');
        if directory.contains("..") {
            return ApiResponse::error("invalid directory path")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let mut assets = Vec::new();
        let url_retriever = state.storage.retrieve_urls().await?;

        while let Some(field) = multipart.next_field().await? {
            let raw_name = match field.file_name() {
                Some(name) => name,
                None => {
                    return ApiResponse::error("file name not found")
                        .with_status(StatusCode::EXPECTATION_FAILED)
                        .ok();
                }
            };

            let filename = std::path::Path::new(raw_name)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(raw_name)
                .to_compact_string();

            if filename.is_empty() || filename.contains("..") {
                return ApiResponse::error("invalid file name")
                    .with_status(StatusCode::BAD_REQUEST)
                    .ok();
            }
            let content_type = shared::storage::content_type(&filename);

            let reader = tokio_util::io::StreamReader::new(field.into_stream().map_err(|err| {
                std::io::Error::other(format!("failed to read multipart field: {err}"))
            }));

            let asset_name = if directory.is_empty() {
                filename.clone()
            } else {
                format!("{directory}/{filename}").to_compact_string()
            };

            let asset_path = format!("assets/{asset_name}");

            let size = state
                .storage
                .store(&asset_path, reader, content_type)
                .await?;

            activity_logger
                .log(
                    "asset:upload",
                    serde_json::json!({
                        "name": asset_name,
                        "size": size,
                    }),
                )
                .await;

            assets.push(shared::storage::StorageAsset {
                url: url_retriever.get_url(&asset_path),
                name: asset_name,
                size,
                is_directory: false,
                created: chrono::Utc::now(),
            });
        }

        ApiResponse::new_serialized(Response { assets }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(put::route).layer(DefaultBodyLimit::disable()))
        .nest("/delete", delete::router(state))
        .nest("/search", search::router(state))
        .with_state(state.clone())
}
