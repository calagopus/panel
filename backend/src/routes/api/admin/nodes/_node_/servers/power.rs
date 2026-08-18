use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            admin_activity::GetAdminActivityLogger, node::GetNode, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        servers: wings_api::ServerSelector,
        action: wings_api::ServerPowerAction,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        affected: u64,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
    ), params(
        (
            "node" = uuid::Uuid,
            description = "The node ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        node: GetNode,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("nodes.power")?;

        let response_data = node
            .api_client(&state.database)
            .await?
            .post_servers_power(&wings_api::servers_power::post::RequestBody {
                servers: data.servers.clone(),
                action: data.action,
                wait_seconds: None,
            })
            .await?;

        activity_logger
            .log(
                "node:servers.power",
                serde_json::json!({
                    "node_uuid": node.uuid,
                    "servers": data.servers,
                    "action": data.action,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            affected: response_data.affected,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
