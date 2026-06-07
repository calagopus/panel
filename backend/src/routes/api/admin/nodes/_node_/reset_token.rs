use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::StatusCode;
    use shared::{
        ApiError, GetState,
        models::{
            admin_activity::GetAdminActivityLogger, node::GetNode, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(shared::models::node::AdminApiNodeToken)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "node" = uuid::Uuid,
            description = "The node ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        node: GetNode,
        activity_logger: GetAdminActivityLogger,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("nodes.reset-token")?;

        if node.is_all_in_one_node() && state.container_type.is_all_in_one() {
            return ApiResponse::error("the token for the aio node cannot be reset")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let (token_id, token) = node.reset_token(&state).await?;

        activity_logger
            .log(
                "node:reset-token",
                serde_json::json!({
                    "node_uuid": node.uuid,
                }),
            )
            .await;

        ApiResponse::new_serialized(shared::models::node::AdminApiNodeToken {
            token_id: token_id.into(),
            token: token.into(),
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
