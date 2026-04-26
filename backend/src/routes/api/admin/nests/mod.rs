use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _nest_;
mod eggs;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoAdminApiObject, Pagination, PaginationParamsWithSearch, nest::Nest,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        nests: Pagination<shared::models::nest::AdminApiNest>,
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

        permissions.has_admin_permission("nests.read")?;

        let nests = Nest::all_with_pagination(
            &state.database,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        ApiResponse::new_serialized(Response {
            nests: nests
                .try_async_map(|nest| nest.into_admin_api_object(&state, ()))
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
            nest::{CreateNestOptions, Nest},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        nest: shared::models::nest::AdminApiNest,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), request_body = inline(CreateNestOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<CreateNestOptions>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("nests.create")?;

        let nest = match Nest::create(&state, data).await {
            Ok(nest) => nest,
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("nest with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        };

        activity_logger
            .log(
                "nest:create",
                serde_json::json!({
                    "uuid": nest.uuid,
                    "author": nest.author,
                    "name": nest.name,
                    "description": nest.description,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            nest: nest.into_admin_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/{nest}", _nest_::router(state))
        .nest("/eggs", eggs::router(state))
        .with_state(state.clone())
}
