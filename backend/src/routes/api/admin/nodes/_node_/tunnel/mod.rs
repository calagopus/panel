use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod metrics;
mod rotate;

mod get {
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoAdminApiObject, node::GetNode, node_tunnel::NodeTunnel, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        tunnel: Option<shared::models::node_tunnel::AdminApiNodeTunnel>,
        status: Option<wings_api::TundraStatus>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
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
    ) -> ApiResponseResult {
        permissions.has_admin_permission("nodes.tunnel")?;

        let tunnel = NodeTunnel::by_node_uuid(&state.database, node.uuid).await?;
        let status = node.fetch_tunnel_status(&state.database).await;

        ApiResponse::new_serialized(Response {
            tunnel: match tunnel {
                Some(tunnel) => Some(tunnel.into_admin_api_object(&state, ()).await?),
                None => None,
            },
            status,
        })
        .ok()
    }
}

mod post {
    use axum::http::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel, IntoAdminApiObject,
            admin_activity::GetAdminActivityLogger,
            node::GetNode,
            node_tunnel::{CreateNodeTunnelOptions, NodeTunnel},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        host: compact_str::CompactString,
        port: u16,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        tunnel: shared::models::node_tunnel::AdminApiNodeTunnel,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
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
        permissions.has_admin_permission("nodes.tunnel")?;

        if NodeTunnel::by_node_uuid(&state.database, node.uuid)
            .await?
            .is_some()
        {
            return ApiResponse::error("this node is already on the private network")
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        let tunnel = NodeTunnel::create(
            &state,
            CreateNodeTunnelOptions {
                node_uuid: node.uuid,
                host: data.host,
                port: data.port,
            },
        )
        .await?;

        activity_logger
            .log(
                "node:tunnel.create",
                serde_json::json!({
                    "node_uuid": node.uuid,
                }),
            )
            .await;

        shared::tunnel::poke_nodes(&state.database).await;

        ApiResponse::new_serialized(Response {
            tunnel: tunnel.into_admin_api_object(&state, ()).await?,
        })
        .ok()
    }
}

mod patch {
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoAdminApiObject, UpdatableModel,
            admin_activity::GetAdminActivityLogger,
            node::GetNode,
            node_tunnel::{NodeTunnel, UpdateNodeTunnelOptions},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        tunnel: shared::models::node_tunnel::AdminApiNodeTunnel,
    }

    #[utoipa::path(patch, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "node" = uuid::Uuid,
            description = "The node ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(shared::models::node_tunnel::UpdateNodeTunnelOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        node: GetNode,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<UpdateNodeTunnelOptions>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("nodes.tunnel")?;

        let Some(mut tunnel) = NodeTunnel::by_node_uuid(&state.database, node.uuid).await? else {
            return ApiResponse::error("this node is not on the private network")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        };

        tunnel.update(&state, data).await?;

        activity_logger
            .log(
                "node:tunnel.update",
                serde_json::json!({
                    "node_uuid": node.uuid,
                }),
            )
            .await;

        shared::tunnel::poke_nodes(&state.database).await;

        ApiResponse::new_serialized(Response {
            tunnel: tunnel.into_admin_api_object(&state, ()).await?,
        })
        .ok()
    }
}

mod delete {
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel, admin_activity::GetAdminActivityLogger, node::GetNode,
            node_tunnel::NodeTunnel, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
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
        permissions.has_admin_permission("nodes.tunnel")?;

        let Some(tunnel) = NodeTunnel::by_node_uuid(&state.database, node.uuid).await? else {
            return ApiResponse::error("this node is not on the private network")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        };

        let client = node.api_client(&state.database).await?;
        tunnel.delete(&state, ()).await?;

        tokio::spawn(async move {
            match tokio::time::timeout(std::time::Duration::from_secs(5), client.post_tundra_sync())
                .await
            {
                Ok(Ok(())) => {}
                Ok(Err(err)) => {
                    tracing::warn!("failed to notify the removed tunnel node: {:?}", err)
                }
                Err(_) => tracing::warn!("notifying the removed tunnel node timed out"),
            }
        });

        activity_logger
            .log(
                "node:tunnel.delete",
                serde_json::json!({
                    "node_uuid": node.uuid,
                }),
            )
            .await;

        shared::tunnel::poke_nodes(&state.database).await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .routes(routes!(patch::route))
        .routes(routes!(delete::route))
        .nest("/rotate", rotate::router(state))
        .nest("/metrics", metrics::router(state))
        .with_state(state.clone())
}
