use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod patch {
    use futures_util::StreamExt;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            ByUuid, admin_activity::GetAdminActivityLogger, node::Node, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        node_uuids: Vec<uuid::Uuid>,
        config: serde_json::Value,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        applied: usize,
    }

    #[utoipa::path(patch, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("nodes.update")?;

        let update_node = async |node: uuid::Uuid| -> Result<bool, anyhow::Error> {
            let node = Node::by_uuid_optional_cached(&state.database, node).await?;
            let Some(node) = node else {
                return Ok(false);
            };

            let applied = match node
                .update_configuration(&state.database, &data.config)
                .await
            {
                Ok(applied) => applied,
                Err(err) => {
                    tracing::warn!(
                        "failed to update configuration for node {}: {:?}",
                        node.uuid,
                        err
                    );
                    return Ok(false);
                }
            };
            if !applied {
                return Ok(false);
            }

            activity_logger
                .log(
                    "node:update-config",
                    serde_json::json!({
                        "uuid": node.uuid,
                        "config": data.config,
                    }),
                )
                .await;

            Ok(true)
        };

        let mut futures = Vec::new();

        for node_uuid in data.node_uuids {
            futures.push(update_node(node_uuid));
        }

        let mut results_stream = futures_util::stream::iter(futures).buffer_unordered(5);

        let mut applied = 0;
        while let Some(result) = results_stream.next().await {
            match result {
                Ok(true) => applied += 1,
                Ok(false) => {}
                Err(err) => return ApiResponse::from(err).ok(),
            }
        }

        ApiResponse::new_serialized(Response { applied }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(patch::route))
        .with_state(state.clone())
}
