use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _egg_;
mod install;

mod get {
    use crate::routes::api::admin::egg_repositories::_egg_repository_::GetEggRepository;
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoAdminApiObject, Pagination, PaginationParamsWithSearch,
            egg_repository_egg::EggRepositoryEgg, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        egg_repository_eggs:
            Pagination<shared::models::egg_repository_egg::AdminApiEggRepositoryEgg>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ), params(
        (
            "egg_repository" = uuid::Uuid,
            description = "The egg repository ID",
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
        egg_repository: GetEggRepository,
        Query(params): Query<PaginationParamsWithSearch>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("egg-repositories.read")?;

        let egg_repository_eggs = EggRepositoryEgg::by_egg_repository_uuid_with_pagination(
            &state.database,
            egg_repository.uuid,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        ApiResponse::new_serialized(Response {
            egg_repository_eggs: egg_repository_eggs
                .try_async_map(|egg| egg.into_admin_api_object(&state, ()))
                .await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .nest("/{egg}", _egg_::router(state))
        .nest("/install", install::router(state))
        .with_state(state.clone())
}
