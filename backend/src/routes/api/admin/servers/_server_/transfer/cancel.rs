use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            admin_activity::GetAdminActivityLogger, server::GetServer, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = CONFLICT, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
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
        activity_logger: GetAdminActivityLogger,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("servers.transfer")?;

        let Some(destination_node) = &server.destination_node else {
            return ApiResponse::error("server is not being transferred")
                .with_status(StatusCode::CONFLICT)
                .ok();
        };

        server
            .node
            .fetch_cached(&state.database)
            .await?
            .api_client(&state.database)
            .await?
            .delete_servers_server_transfer(server.uuid)
            .await?;

        activity_logger
            .log(
                "server:abort-transfer",
                serde_json::json!({
                    "uuid": server.uuid,
                    "destination_node_uuid": destination_node.uuid,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {})
            .with_status(StatusCode::OK)
            .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
