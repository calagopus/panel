use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        GetState,
        models::server::GetServer,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response<'a> {
        resources: &'a wings_api::ResourceUsage,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(state: GetState, server: GetServer) -> ApiResponseResult {
        let resource_usages = server
            .node
            .fetch_cached(&state.database)
            .await?
            .fetch_server_resources(&state.database)
            .await?;

        let Some(resources) = resource_usages.get(&server.uuid) else {
            return ApiResponse::error("no resource usage data found for server")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        };

        ApiResponse::new_serialized(Response { resources }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
