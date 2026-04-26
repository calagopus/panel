use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _egg_;

mod get {
    use axum::extract::Query;
    use serde::Serialize;
    use shared::{
        GetState,
        models::{
            IntoApiObject, Pagination, PaginationParamsWithSearch,
            user::{GetPermissionManager, GetUser},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        nest_eggs: Pagination<shared::models::nest_egg::ApiNestEgg>,
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
        (
            "search" = Option<String>, Query,
            description = "Search term for items",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        Query(params): Query<PaginationParamsWithSearch>,
    ) -> ApiResponseResult {
        permissions.has_user_permission("servers.read")?;

        let nest_eggs = shared::models::nest_egg::NestEgg::by_user_with_pagination(
            &state.database,
            &user,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        ApiResponse::new_serialized(Response {
            nest_eggs: nest_eggs
                .try_async_map(|nest_egg| nest_egg.into_api_object(&state, ()))
                .await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .nest("/{egg}", _egg_::router(state))
        .with_state(state.clone())
}
