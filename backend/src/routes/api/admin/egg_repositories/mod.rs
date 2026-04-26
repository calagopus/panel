use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _egg_repository_;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoAdminApiObject, Pagination, PaginationParamsWithSearch,
            egg_repository::EggRepository, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        egg_repositories: Pagination<shared::models::egg_repository::AdminApiEggRepository>,
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
        Query(params): Query<PaginationParamsWithSearch>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("egg-repositories.read")?;

        let egg_repositories = EggRepository::all_with_pagination(
            &state.database,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        ApiResponse::new_serialized(Response {
            egg_repositories: egg_repositories
                .try_async_map(|egg_repository| egg_repository.into_admin_api_object(&state, ()))
                .await?,
        })
        .ok()
    }
}

mod post {
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel, IntoAdminApiObject,
            admin_activity::GetAdminActivityLogger,
            egg_repository::{CreateEggRepositoryOptions, EggRepository},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        egg_repository: shared::models::egg_repository::AdminApiEggRepository,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), request_body = inline(CreateEggRepositoryOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<CreateEggRepositoryOptions>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("egg-repositories.create")?;

        let egg_repository = match EggRepository::create(&state, data).await {
            Ok(egg_repository) => egg_repository,
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error(
                    "egg repository with name/git repository already exists",
                )
                .with_status(StatusCode::CONFLICT)
                .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        };

        activity_logger
            .log(
                "egg-repository:create",
                serde_json::json!({
                    "uuid": egg_repository.uuid,
                    "name": egg_repository.name,
                    "description": egg_repository.description,
                    "git_repository": egg_repository.git_repository,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            egg_repository: egg_repository.into_admin_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/{egg_repository}", _egg_repository_::router(state))
        .with_state(state.clone())
}
