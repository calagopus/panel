use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod counts;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            IntoAdminApiObject, Pagination, PaginationParamsWithSearch, nest_egg::NestEgg,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Params {
        nest_uuid: Option<uuid::Uuid>,
    }

    #[derive(ToSchema, Serialize)]
    struct ResponseEgg {
        egg: shared::models::nest_egg::AdminApiNestEgg,
        nest: shared::models::nest::AdminApiNest,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        eggs: Pagination<ResponseEgg>,
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
        (
            "nest_uuid" = Option<uuid::Uuid>, Query,
            description = "Only return eggs of this nest",
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

        permissions.has_admin_permission("eggs.read")?;

        let eggs = NestEgg::all_with_pagination(
            &state.database,
            params.nest_uuid,
            pagination.page,
            pagination.per_page,
            pagination.search.as_deref(),
        )
        .await?;

        ApiResponse::new_serialized(Response {
            eggs: eggs
                .try_async_map(async |egg| {
                    Ok::<_, shared::database::DatabaseError>(ResponseEgg {
                        nest: egg
                            .nest
                            .fetch_cached(&state.database)
                            .await?
                            .into_admin_api_object(&state, ())
                            .await?,
                        egg: egg.into_admin_api_object(&state, ()).await?,
                    })
                })
                .await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .nest("/counts", counts::router(state))
        .with_state(state.clone())
}
