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
    use std::collections::HashSet;
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        servers: HashSet<uuid::Uuid>,
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
        axum::Json(data): axum::Json<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("nodes.power")?;

        let response_data = node
            .api_client(&state.database)
            .post_servers_power(&wings_api::servers_power::post::RequestBody {
                servers: data.servers.iter().cloned().collect(),
                action: data.action,
                wait_seconds: None,
            })
            .await?;

        activity_logger
            .log(
                "node:servers.power",
                serde_json::json!({
                    "node_uuid": node.uuid,
                    "servers": if data.servers.is_empty() { None } else { Some(&data.servers) },
                    "action": data.action,
                }),
            )
            .await;

        ApiResponse::json(Response {
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
