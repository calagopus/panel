use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use axum::extract::Query;
    use indexmap::IndexMap;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoAdminApiObject, Pagination, PaginationParamsWithSearch, node::GetNode,
            server::Server, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        servers: Pagination<shared::models::server::AdminApiServer>,
        transfers: IndexMap<uuid::Uuid, wings_api::TransferProgress>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
    ), params(
        (
            "node" = uuid::Uuid,
            description = "The node ID",
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
        node: GetNode,
        Query(params): Query<PaginationParamsWithSearch>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("nodes.transfers")?;

        let (servers, transfers) = tokio::try_join!(
            Server::by_node_uuid_transferring_with_pagination(
                &state.database,
                node.uuid,
                params.page,
                params.per_page,
                params.search.as_deref()
            ),
            async {
                Ok(node
                    .api_client(&state.database)
                    .await?
                    .get_transfers()
                    .await?)
            },
        )?;

        let storage_url_retriever = state.storage.retrieve_urls().await?;

        ApiResponse::new_serialized(Response {
            servers: servers
                .try_async_map(|server| {
                    server.into_admin_api_object(&state, &storage_url_retriever)
                })
                .await?,
            transfers,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
