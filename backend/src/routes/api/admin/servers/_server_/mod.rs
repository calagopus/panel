use super::State;
use axum::{
    extract::{Path, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{
    GetState,
    models::{server::Server, user::GetPermissionManager},
    response::ApiResponse,
};
use utoipa_axum::{router::OpenApiRouter, routes};

mod allocations;
mod backups;
mod clear_state;
mod logs;
mod mounts;
mod transfer;
mod variables;

pub async fn auth(
    state: GetState,
    permissions: GetPermissionManager,
    Path(server): Path<Vec<String>>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    if let Err(err) = permissions.has_admin_permission("servers.read") {
        return Ok(err.into_response());
    }

    let server = Server::by_identifier(&state.database, &server[0]).await;
    let server = match server {
        Ok(Some(server)) => server,
        Ok(None) => {
            return Ok(ApiResponse::error("server not found")
                .with_status(StatusCode::NOT_FOUND)
                .into_response());
        }
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    req.extensions_mut().insert(server);

    Ok(next.run(req).await)
}

mod get {
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{IntoAdminApiObject, server::GetServer, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        server: shared::models::server::AdminApiServer,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
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
    ) -> ApiResponseResult {
        permissions.has_admin_permission("servers.read")?;

        ApiResponse::new_serialized(Response {
            server: server
                .0
                .into_admin_api_object(&state, &state.storage.retrieve_urls().await?)
                .await?,
        })
        .ok()
    }
}

mod delete {
    use axum::http::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel, admin_activity::GetAdminActivityLogger, server::GetServer,
            server_backup::ServerBackup, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        force: bool,
        delete_backups: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("servers.delete")?;

        let backups = if data.delete_backups {
            ServerBackup::all_by_server_uuid(&state.database, server.uuid).await?
        } else {
            Vec::new()
        };

        if let Err(err) = server
            .delete(
                &state,
                shared::models::server::DeleteServerOptions { force: data.force },
            )
            .await
        {
            tracing::error!("failed to delete server: {:?}", err);

            return ApiResponse::error(format!("failed to delete server: {err}"))
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        if data.delete_backups {
            for backup in backups {
                let backup_uuid = backup.uuid;

                if let Err(err) = backup.delete(&state, Default::default()).await {
                    tracing::error!(server = %server.uuid, backup = %backup_uuid, "failed to delete backup: {:?}", err);

                    if !data.force {
                        return ApiResponse::error(format!("failed to delete backup: {err}"))
                            .with_status(StatusCode::EXPECTATION_FAILED)
                            .ok();
                    }
                }
            }
        }

        activity_logger
            .log(
                "server:delete",
                serde_json::json!({
                    "uuid": server.uuid,
                    "name": server.name,
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
            server::{GetServer, UpdateServerOptions},
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
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(UpdateServerOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        mut server: GetServer,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<UpdateServerOptions>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("servers.update")?;

        let limits = data.limits;
        let feature_limits = data.feature_limits.clone();
        match server.update(&state, data).await {
            Ok(_) => {}
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("server with external id already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        }

        activity_logger
            .log(
                "server:update",
                serde_json::json!({
                    "uuid": server.uuid,
                    "owner_uuid": server.owner.uuid,
                    "egg_uuid": server.egg.uuid,

                    "external_id": server.external_id,
                    "name": server.name,
                    "description": server.description,
                    "limits": limits,
                    "pinned_cpus": server.pinned_cpus,
                    "startup": server.startup,
                    "image": server.image,
                    "timezone": server.timezone,

                    "hugepages_passthrough_enabled": server.hugepages_passthrough_enabled,
                    "kvm_passthrough_enabled": server.kvm_passthrough_enabled,

                    "feature_limits": feature_limits,
                }),
            )
            .await;

        tokio::spawn(async move {
            if let Err(err) = server.0.sync(&state.database).await {
                tracing::error!("failed to sync server on node: {:?}", err);
            }
        });

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(delete::route))
        .routes(routes!(patch::route))
        .nest("/variables", variables::router(state))
        .nest("/mounts", mounts::router(state))
        .nest("/transfer", transfer::router(state))
        .nest("/allocations", allocations::router(state))
        .nest("/clear-state", clear_state::router(state))
        .nest("/logs", logs::router(state))
        .nest("/backups", backups::router(state))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
