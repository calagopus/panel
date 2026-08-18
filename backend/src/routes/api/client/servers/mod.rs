use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

pub mod _server_;
mod eggs;
mod groups;
mod nodes;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            IntoApiObject, Pagination, PaginationParamsWithSearch,
            server::Server,
            user::{GetPermissionManager, GetUser},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Params {
        #[serde(default)]
        other: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        servers: Pagination<shared::models::server::ApiServer>,
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
            "other" = bool, Query,
            description = "If true, returns servers not owned by the user (admin only)",
            example = "false",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        Query(pagination): Query<PaginationParamsWithSearch>,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&pagination) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_user_permission("servers.read")?;

        let servers = if params.other && permissions.has_admin_permission("servers.read").is_ok() {
            Server::by_not_user_uuid_with_pagination(
                &state.database,
                user.uuid,
                pagination.page,
                pagination.per_page,
                pagination.search.as_deref(),
            )
            .await
        } else {
            Server::by_user_uuid_with_pagination(
                &state.database,
                user.uuid,
                pagination.page,
                pagination.per_page,
                pagination.search.as_deref(),
            )
            .await
        }?;

        ApiResponse::new_serialized(Response {
            servers: servers
                .try_async_map(|server| server.into_api_object(&state, &user))
                .await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .nest("/groups", groups::router(state))
        .nest("/nodes", nodes::router(state))
        .nest("/eggs", eggs::router(state))
        .nest("/{server}", _server_::router(state))
        .with_state(state.clone())
}
