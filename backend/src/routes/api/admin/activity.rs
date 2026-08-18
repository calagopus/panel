use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            IntoAdminApiObject, Pagination, PaginationParamsWithSearch,
            admin_activity::AdminActivity, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Params {
        user: Option<uuid::Uuid>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        activities: Pagination<shared::models::admin_activity::AdminApiAdminActivity>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ), params(
        (
            "user" = Option<uuid::Uuid>, Query,
            description = "The user ID to filter activities",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
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
            "search" = Option<String>, Query,
            description = "Search term for items",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        Query(pagination): Query<PaginationParamsWithSearch>,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&pagination) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("activity.read")?;

        let activities = if let Some(user_uuid) = params.user {
            AdminActivity::by_user_uuid_with_pagination(
                &state.database,
                user_uuid,
                pagination.page,
                pagination.per_page,
                pagination.search.as_deref(),
            )
            .await?
        } else {
            AdminActivity::all_with_pagination(
                &state.database,
                pagination.page,
                pagination.per_page,
                pagination.search.as_deref(),
            )
            .await?
        };

        let storage_url_retriever = state.storage.retrieve_urls().await?;

        ApiResponse::new_serialized(Response {
            activities: activities
                .try_async_map(|activity| {
                    activity.into_admin_api_object(&state, &storage_url_retriever)
                })
                .await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
