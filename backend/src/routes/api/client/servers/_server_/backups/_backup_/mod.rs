use super::State;
use axum::{
    extract::{Path, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{
    GetState,
    models::{server::GetServer, server_backup::ServerBackup, user::GetPermissionManager},
    response::ApiResponse,
};
use utoipa_axum::{router::OpenApiRouter, routes};

mod download;
mod restore;

pub type GetServerBackup = shared::extract::ConsumingExtension<ServerBackup>;

pub async fn auth(
    state: GetState,
    permissions: GetPermissionManager,
    server: GetServer,
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

    if let Err(err) = permissions.has_server_permission("backups.read") {
        return Ok(err.into_response());
    }

    let backup = ServerBackup::by_server_uuid_uuid(&state.database, server.uuid, backup).await;
    let backup = match backup {
        Ok(Some(backup)) => backup,
        Ok(None) => {
            return Ok(ApiResponse::error("backup not found")
                .with_status(StatusCode::NOT_FOUND)
                .into_response());
        }
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    req.extensions_mut().insert(server.0);
    req.extensions_mut().insert(backup);

    Ok(next.run(req).await)
}

mod get {
    use crate::routes::api::client::servers::_server_::backups::_backup_::GetServerBackup;
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
            "server" = uuid::Uuid,
            description = "The server ID",
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
        permissions.has_server_permission("backups.read")?;

        ApiResponse::new_serialized(Response {
            backup: backup.0.into_api_object(&state, ()).await?,
        })
        .ok()
    }
}

mod delete {
    use crate::routes::api::client::servers::_server_::backups::_backup_::GetServerBackup;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel,
            server::{GetServer, GetServerActivityLogger},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
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
        server: GetServer,
        activity_logger: GetServerActivityLogger,
        backup: GetServerBackup,
    ) -> ApiResponseResult {
        permissions.has_server_permission("backups.delete")?;

        if backup.completed.is_none() {
            return ApiResponse::error("backup has not been completed yet")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        if backup.locked {
            return ApiResponse::error("backup is locked and cannot be deleted")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        if let Err(err) = backup.delete(&state, Default::default()).await {
            tracing::error!(server = %server.uuid, backup = %backup.uuid, "failed to delete backup: {:?}", err);

            return ApiResponse::error("failed to delete backup")
                .with_status(StatusCode::INTERNAL_SERVER_ERROR)
                .ok();
        }

        activity_logger
            .log(
                "server:backup.delete",
                serde_json::json!({
                    "uuid": backup.uuid,
                    "name": backup.name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod patch {
    use crate::routes::api::client::servers::_server_::backups::_backup_::GetServerBackup;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            UpdatableModel, server::GetServerActivityLogger,
            server_backup::UpdateServerBackupOptions, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(patch, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = BAD_REQUEST, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "backup" = uuid::Uuid,
            description = "The backup ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(UpdateServerBackupOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetServerActivityLogger,
        mut backup: GetServerBackup,
        shared::Payload(data): shared::Payload<UpdateServerBackupOptions>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("backups.update")?;

        backup.update(&state, data).await?;

        activity_logger
            .log(
                "server:backup.update",
                serde_json::json!({
                    "uuid": backup.uuid,
                    "name": backup.name,
                    "locked": backup.locked,
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
        .nest("/download", download::router(state))
        .nest("/restore", restore::router(state))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
