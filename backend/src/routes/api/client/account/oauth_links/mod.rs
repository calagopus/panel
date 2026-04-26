use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _oauth_link_;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoApiObject, Pagination, PaginationParams,
            user::{GetPermissionManager, GetUser},
            user_oauth_link::UserOAuthLink,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        oauth_links: Pagination<shared::models::user_oauth_link::ApiUserOAuthLink>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
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
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        Query(params): Query<PaginationParams>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_user_permission("oauth-links.read")?;

        let oauth_links = UserOAuthLink::filtered_by_user_uuid_with_pagination(
            &state.database,
            user.uuid,
            params.page,
            params.per_page,
        )
        .await?;

        ApiResponse::new_serialized(Response {
            oauth_links: oauth_links
                .try_async_map(|oauth_link| oauth_link.into_api_object(&state, ()))
                .await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .nest("/{oauth_link}", _oauth_link_::router(state))
        .with_state(state.clone())
}
