use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _allocation_;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoApiObject, Pagination, PaginationParamsWithSearch, server::GetServer,
            server_allocation::ServerAllocation, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        allocations: Pagination<shared::models::server_allocation::ApiServerAllocation>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
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
        server: GetServer,
        Query(params): Query<PaginationParamsWithSearch>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("allocations.read")?;

        let allocations = ServerAllocation::by_server_uuid_with_pagination(
            &state.database,
            server.uuid,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        let allocation_uuid = server.0.allocation.map(|a| a.uuid);

        ApiResponse::new_serialized(Response {
            allocations: allocations
                .try_async_map(|allocation| allocation.into_api_object(&state, allocation_uuid))
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
            IntoApiObject,
            server::{GetServer, GetServerActivityLogger},
            server_allocation::ServerAllocation,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        allocation: shared::models::server_allocation::ApiServerAllocation,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = UNAUTHORIZED, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        activity_logger: GetServerActivityLogger,
    ) -> ApiResponseResult {
        permissions.has_server_permission("allocations.create")?;

        let egg_configuration = server.egg.configuration(&state.database).await?;

        if !egg_configuration
            .config_allocations
            .is_some_and(|config| config.user_self_assign.enabled)
        {
            return ApiResponse::error("self-assigning allocations is not enabled for this server")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let allocations_lock = state
            .cache
            .lock(
                format!("servers::{}::allocations", server.uuid),
                Some(30),
                Some(5),
            )
            .await?;

        let allocations =
            ServerAllocation::count_by_server_uuid(&state.database, server.uuid).await;
        if allocations >= server.allocation_limit as i64 {
            return ApiResponse::error("maximum number of allocations reached")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let allocation = match ServerAllocation::create_random(&state.database, &server).await {
            Ok(allocation_uuid) => ServerAllocation::by_uuid(&state.database, allocation_uuid)
                .await?
                .ok_or_else(|| anyhow::anyhow!("allocation not found after creation"))?,
            Err(err) if err.to_string().contains("null value in column") => {
                return ApiResponse::error("no node allocations are available")
                    .with_status(StatusCode::EXPECTATION_FAILED)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        };

        drop(allocations_lock);

        activity_logger
            .log(
                "server:allocation.create",
                serde_json::json!({
                    "ip": allocation.allocation.ip,
                    "ip_alias": allocation.allocation.ip_alias,
                    "port": allocation.allocation.port,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            allocation: allocation
                .into_api_object(&state, server.0.allocation.map(|a| a.uuid))
                .await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/{allocation}", _allocation_::router(state))
        .with_state(state.clone())
}
