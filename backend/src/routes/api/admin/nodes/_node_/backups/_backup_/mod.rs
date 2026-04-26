use super::State;
use axum::{
    extract::{Path, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{
    GetState,
    models::{node::GetNode, server_backup::ServerBackup, user::GetPermissionManager},
    response::ApiResponse,
};
use utoipa_axum::{router::OpenApiRouter, routes};

mod detach;
mod download;
mod reattach;
mod restore;

pub type GetServerBackup = shared::extract::ConsumingExtension<ServerBackup>;

pub async fn auth(
    state: GetState,
    permissions: GetPermissionManager,
    node: GetNode,
    Path(backup): Path<Vec<String>>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let backup = match backup.get(1).map(|s| s.parse::<uuid::Uuid>()) {
        Some(Ok(id)) => id,
        _ => {
            return Ok(ApiResponse::error("invalid backup uuid")
                .with_status(StatusCode::BAD_REQUEST)
                .into_response());
        }
    };

    if let Err(err) = permissions.has_admin_permission("nodes.backups") {
        return Ok(err.into_response());
    }

    let backup = ServerBackup::by_node_uuid_uuid(&state.database, node.uuid, backup).await;
    let backup = match backup {
        Ok(Some(backup)) => backup,
        Ok(None) => {
            return Ok(ApiResponse::error("backup not found")
                .with_status(StatusCode::NOT_FOUND)
                .into_response());
        }
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    req.extensions_mut().insert(node.0);
    req.extensions_mut().insert(backup);

    Ok(next.run(req).await)
}

mod get {
    use crate::routes::api::admin::nodes::_node_::backups::_backup_::GetServerBackup;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{IntoApiObject, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    pub struct Response {
        backup: shared::models::server_backup::ApiServerBackup,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "node" = uuid::Uuid,
            description = "The node ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "backup" = uuid::Uuid,
            description = "The backup ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        backup: GetServerBackup,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("nodes.backups")?;

        ApiResponse::new_serialized(Response {
            backup: backup.0.into_api_object(&state, ()).await?,
        })
        .ok()
    }
}

mod delete {
    use crate::routes::api::admin::nodes::_node_::backups::_backup_::GetServerBackup;
    use axum::http::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel, admin_activity::GetAdminActivityLogger, node::GetNode,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        force: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "node" = uuid::Uuid,
            description = "The node ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "backup" = uuid::Uuid,
            description = "The backup ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        node: GetNode,
        activity_logger: GetAdminActivityLogger,
        backup: GetServerBackup,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("nodes.backups")?;

        if backup.completed.is_none() {
            return ApiResponse::error("backup has not been completed yet")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        backup
            .delete(
                &state,
                shared::models::server_backup::DeleteServerBackupOptions { force: data.force },
            )
            .await?;

        activity_logger
            .log(
                "node:backup.delete",
                serde_json::json!({
                    "uuid": backup.uuid,
                    "node_uuid": node.uuid,

                    "name": backup.name,
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
        .nest("/download", download::router(state))
        .nest("/restore", restore::router(state))
        .nest("/reattach", reattach::router(state))
        .nest("/detach", detach::router(state))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
