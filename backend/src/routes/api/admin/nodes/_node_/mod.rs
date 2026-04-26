use super::State;
use axum::{
    extract::{Path, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{
    GetState,
    models::{ByUuid, node::Node, user::GetPermissionManager},
    response::ApiResponse,
};
use utoipa_axum::{router::OpenApiRouter, routes};

mod allocations;
mod backups;
mod mounts;
mod reset_token;
mod servers;
mod system;

pub async fn auth(
    state: GetState,
    permissions: GetPermissionManager,
    Path(node): Path<Vec<String>>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let node = match node.first().map(|s| s.parse::<uuid::Uuid>()) {
        Some(Ok(id)) => id,
        _ => {
            return Ok(ApiResponse::error("invalid node uuid")
                .with_status(StatusCode::BAD_REQUEST)
                .into_response());
        }
    };

    if let Err(err) = permissions.has_admin_permission("nodes.read") {
        return Ok(err.into_response());
    }

    let node = Node::by_uuid_optional(&state.database, node).await;
    let node = match node {
        Ok(Some(node)) => node,
        Ok(None) => {
            return Ok(ApiResponse::error("node not found")
                .with_status(StatusCode::NOT_FOUND)
                .into_response());
        }
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    req.extensions_mut().insert(node);

    Ok(next.run(req).await)
}

mod get {
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{IntoAdminApiObject, node::GetNode, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        node: shared::models::node::AdminApiNode,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
        (status = BAD_REQUEST, body = ApiError),
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
        permissions.has_admin_permission("nodes.read")?;

        ApiResponse::new_serialized(Response {
            node: node.0.into_admin_api_object(&state, ()).await?,
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
            DeletableModel, admin_activity::GetAdminActivityLogger, node::GetNode, server::Server,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
        (status = BAD_REQUEST, body = ApiError),
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
        permissions.has_admin_permission("nodes.delete")?;

        if Server::count_by_node_uuid(&state.database, node.uuid).await > 0 {
            return ApiResponse::error("node has servers, cannot delete")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        node.delete(&state, ()).await?;

        activity_logger
            .log(
                "node:delete",
                serde_json::json!({
                    "uuid": node.uuid,
                    "name": node.name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod patch {
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            UpdatableModel,
            admin_activity::GetAdminActivityLogger,
            node::{GetNode, UpdateNodeOptions},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(patch, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
        (status = BAD_REQUEST, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), params(
        (
            "node" = uuid::Uuid,
            description = "The node ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(UpdateNodeOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        mut node: GetNode,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<UpdateNodeOptions>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("nodes.update")?;

        match node.update(&state, data).await {
            Ok(_) => {}
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("node with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        }

        activity_logger
            .log(
                "node:update",
                serde_json::json!({
                    "uuid": node.uuid,
                    "location_uuid": node.location.uuid,

                    "name": node.name,
                    "description": node.description,
                    "deployment_enabled": node.deployment_enabled,
                    "maintenance_enabled": node.maintenance_enabled,
                    "public_url": node.public_url,
                    "url": node.url,
                    "sftp_host": node.sftp_host,
                    "sftp_port": node.sftp_port,
                    "memory": node.memory,
                    "disk": node.disk,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(delete::route))
        .routes(routes!(patch::route))
        .nest("/reset-token", reset_token::router(state))
        .nest("/allocations", allocations::router(state))
        .nest("/system", system::router(state))
        .nest("/servers", servers::router(state))
        .nest("/mounts", mounts::router(state))
        .nest("/backups", backups::router(state))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
