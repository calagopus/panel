use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{Pagination, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(range(min = 1, max = 100))]
        #[schema(minimum = 1, maximum = 100)]
        #[serde(default = "Pagination::default_per_page")]
        per_page: i64,
        #[garde(skip)]
        #[serde(default)]
        directory: compact_str::CompactString,
        #[garde(length(chars, min = 1, max = 128))]
        #[schema(min_length = 1, max_length = 128)]
        search: compact_str::CompactString,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        assets: Vec<shared::storage::StorageAsset>,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("assets.read")?;

        let directory = data.directory.trim_matches('/');
        if directory.contains("..") {
            return ApiResponse::error("invalid directory path")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let assets = state
            .storage
            .search("assets", directory, &data.search, data.per_page as usize)
            .await?;

        ApiResponse::new_serialized(Response { assets }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
