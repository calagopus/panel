use super::State;
use axum::extract::DefaultBodyLimit;
use utoipa_axum::{
    router::{OpenApiRouter, UtoipaMethodRouterExt},
    routes,
};

mod delete;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{Pagination, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        assets: Pagination<shared::storage::StorageAsset>,
    }

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
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
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

        permissions.has_admin_permission("assets.read")?;

        let assets = state
            .storage
            .list(
                "assets",
                directory,
                params.page as usize,
                params.per_page as usize,
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

        while let Some(field) = multipart.next_field().await? {
            let filename = match field.file_name() {
                Some(name) => name.to_compact_string(),
                None => {
                    return ApiResponse::error("file name not found")
                        .with_status(StatusCode::EXPECTATION_FAILED)
                        .ok();
                }
            };
            let content_type = field
                .content_type()
                .unwrap_or("application/octet-stream")
                .to_compact_string();

            let reader = tokio_util::io::StreamReader::new(field.into_stream().map_err(|err| {
                std::io::Error::other(format!("failed to read multipart field: {err}"))
            }));

            let asset_name = if directory.is_empty() {
                filename.clone()
            } else {
                format!("{directory}/{filename}").to_compact_string()
            };

            let size = state
                .storage
                .store(format!("assets/{asset_name}"), reader, &content_type)
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
                url: state
                    .storage
                    .retrieve_urls()
                    .await?
                    .get_url(format!("assets/{asset_name}")),
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
        .with_state(state.clone())
}
