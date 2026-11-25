use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        GetState,
        models::{
            ByUuid,
            node::Node,
            server::Server,
            user::{GetPermissionManager, GetUser},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use std::collections::HashMap;
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        resources: HashMap<uuid::Uuid, wings_api::ResourceUsage>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
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
        user: GetUser,
        Path(node): Path<uuid::Uuid>,
    ) -> ApiResponseResult {
        permissions.has_user_permission("servers.read")?;

        let (server_uuids, node) = tokio::try_join!(
            async {
                if permissions.has_admin_permission("servers.read").is_ok() {
                    return Ok(None);
                }

                state
                    .cache
                    .cached(
                        &format!("user::{}::servers::{}", user.uuid, node),
                        15,
                        || async {
                            Server::all_uuids_by_node_uuid_user_uuid(
                                &state.database,
                                node,
                                user.uuid,
                            )
                            .await
                        },
                    )
                    .await
                    .map(Some)
            },
            Node::by_uuid_optional_cached(&state.database, node),
        )?;

        if server_uuids.as_ref().is_some_and(|s| s.is_empty()) {
            return ApiResponse::new_serialized(Response {
                resources: HashMap::new(),
            })
            .ok();
        }

        let Some(node) = node else {
            return ApiResponse::error("node not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        };

        let mut resources = node.fetch_server_resources(&state.database).await?;
        if let Some(server_uuids) = server_uuids {
            resources = server_uuids
                .iter()
                .filter_map(|uuid| resources.remove_entry(uuid))
                .collect();
        }

        ApiResponse::new_serialized(Response { resources }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
