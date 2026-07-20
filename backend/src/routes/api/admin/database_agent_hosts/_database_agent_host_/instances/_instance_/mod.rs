use super::State;
use crate::routes::api::admin::database_agent_hosts::_database_agent_host_::GetDatabaseAgentHost;
use axum::{
    extract::{Path, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{
    GetState,
    models::{server_database_instance::ServerDatabaseInstance, user::GetPermissionManager},
    response::ApiResponse,
};
use utoipa_axum::{router::OpenApiRouter, routes};

pub type GetServerDatabaseInstance = shared::extract::ConsumingExtension<ServerDatabaseInstance>;

pub async fn auth(
    state: GetState,
    permissions: GetPermissionManager,
    database_agent_host: GetDatabaseAgentHost,
    Path(database_instance): Path<Vec<String>>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let database_instance = match database_instance.get(1).map(|s| s.parse::<uuid::Uuid>()) {
        Some(Ok(id)) => id,
        _ => {
            return Ok(ApiResponse::error("invalid database instance uuid")
                .with_status(StatusCode::BAD_REQUEST)
                .into_response());
        }
    };

    if let Err(err) = permissions.has_admin_permission("database-agent-hosts.read") {
        return Ok(err.into_response());
    }

    let database_instance = ServerDatabaseInstance::by_database_agent_host_uuid_uuid(
        &state.database,
        database_agent_host.uuid,
        database_instance,
    )
    .await;
    let database_instance = match database_instance {
        Ok(Some(database_instance)) => database_instance,
        Ok(None) => {
            return Ok(ApiResponse::error("database instance not found")
                .with_status(StatusCode::NOT_FOUND)
                .into_response());
        }
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    req.extensions_mut().insert(database_agent_host.0);
    req.extensions_mut().insert(database_instance);

    Ok(next.run(req).await)
}

mod get {
    use crate::routes::api::admin::database_agent_hosts::_database_agent_host_::instances::_instance_::GetServerDatabaseInstance;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{IntoAdminApiObject, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        instance: shared::models::server_database_instance::AdminApiServerDatabaseInstance,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "database_agent_host" = uuid::Uuid,
            description = "The database agent host ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "database_instance" = uuid::Uuid,
            description = "The database instance ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        database_instance: GetServerDatabaseInstance,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("database-agent-hosts.read")?;

        let storage_url_retriever = state.storage.retrieve_urls().await?;

        ApiResponse::new_serialized(Response {
            instance: database_instance
                .0
                .into_admin_api_object(&state, &storage_url_retriever)
                .await?,
        })
        .ok()
    }
}

mod patch {
    use crate::routes::api::admin::database_agent_hosts::_database_agent_host_::instances::_instance_::GetServerDatabaseInstance;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            UpdatableModel, admin_activity::GetAdminActivityLogger,
            server_database_instance::UpdateServerDatabaseInstanceOptions,
            user::GetPermissionManager,
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
        (status = CONFLICT, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "database_agent_host" = uuid::Uuid,
            description = "The database agent host ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "database_instance" = uuid::Uuid,
            description = "The database instance ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(UpdateServerDatabaseInstanceOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        mut database_instance: GetServerDatabaseInstance,
        shared::Payload(data): shared::Payload<UpdateServerDatabaseInstanceOptions>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("database-agent-hosts.update")?;

        if database_instance.database_agent_host.maintenance_enabled {
            return ApiResponse::error(
                "cannot update database instance while database agent host is in maintenance mode",
            )
            .with_status(StatusCode::EXPECTATION_FAILED)
            .ok();
        }

        let template = match &database_instance.database_agent_template {
            Some(template) => Some(template.fetch_cached(&state.database).await?),
            None => None,
        };

        if template.is_none()
            && (data.image == Some(None)
                || data.env == Some(None)
                || data.memory == Some(None)
                || data.swap == Some(None)
                || data.disk == Some(None)
                || data.io_weight == Some(None)
                || data.cpu == Some(None))
        {
            return ApiResponse::error(
                "cannot revert overrides to template values: template no longer exists",
            )
            .with_status(StatusCode::BAD_REQUEST)
            .ok();
        }

        let mut prospective = database_instance.0.clone();
        if let Some(image) = &data.image {
            prospective.image = image.clone();
        }
        if let Some(env) = &data.env {
            prospective.env = env.clone();
        }
        if let Some(memory) = data.memory {
            prospective.memory = memory;
        }
        if let Some(swap) = data.swap {
            prospective.swap = swap;
        }
        if let Some(disk) = data.disk {
            prospective.disk = disk;
        }
        if let Some(io_weight) = data.io_weight {
            prospective.io_weight = io_weight;
        }
        if let Some(cpu) = data.cpu {
            prospective.cpu = cpu;
        }

        let Some(spec) = prospective.resolve_spec(template.as_ref()) else {
            return ApiResponse::error("cannot resolve database instance configuration")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        };

        match database_instance
            .database_agent_host
            .api_client(&state.database)
            .await?
            .patch_instances_instance(
                database_instance.uuid,
                &db_agent_api::instances_instance::patch::RequestBody {
                    suspended: None,
                    memory: data.memory.is_some().then_some(spec.memory),
                    swap: data.swap.is_some().then_some(spec.swap),
                    disk: data.disk.is_some().then_some(spec.disk),
                    io_weight: data
                        .io_weight
                        .is_some()
                        .then_some(spec.io_weight.map(i64::from))
                        .flatten(),
                    cpu: data.cpu.is_some().then_some(spec.cpu as i64),
                    image: data.image.is_some().then_some(spec.image),
                    image_uid: None,
                    image_gid: None,
                    volumes: None,
                    socket_path: None,
                    timezone: None,
                    env: data.env.is_some().then_some(spec.env),
                    cmd: None,
                },
            )
            .await
        {
            Ok(_) => {}
            Err(db_agent_api::client::ApiHttpError::Http(StatusCode::EXPECTATION_FAILED, err)) => {
                return ApiResponse::new_serialized(ApiError::new_database_agent_value(err))
                    .with_status(StatusCode::EXPECTATION_FAILED)
                    .ok();
            }
            Err(err) => return Err(err.into()),
        }

        match database_instance.update(&state, data).await {
            Ok(_) => {}
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("database instance with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        }

        activity_logger
            .log(
                "database-agent-host:instance.update",
                serde_json::json!({
                    "uuid": database_instance.uuid,
                    "name": database_instance.name,
                    "image": database_instance.image,
                    "env_override_keys": database_instance
                        .env
                        .as_ref()
                        .map(|env| env.keys().collect::<Vec<_>>()),
                    "memory": database_instance.memory,
                    "swap": database_instance.swap,
                    "disk": database_instance.disk,
                    "io_weight": database_instance.io_weight,
                    "cpu": database_instance.cpu,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod delete {
    use super::GetServerDatabaseInstance;
    use axum::http::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel, admin_activity::GetAdminActivityLogger,
            server_database_instance::DeleteServerDatabaseInstanceOptions,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        #[serde(default)]
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
            "database_agent_host" = uuid::Uuid,
            description = "The database agent host ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "database_instance" = uuid::Uuid,
            description = "The database instance ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        database_instance: GetServerDatabaseInstance,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("database-agent-hosts.delete")?;

        if database_instance.locked && !data.force {
            return ApiResponse::error("database instance is locked and cannot be deleted")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        if database_instance.database_agent_host.maintenance_enabled && !data.force {
            return ApiResponse::error(
                "cannot delete database instance while database agent host is in maintenance mode",
            )
            .with_status(StatusCode::EXPECTATION_FAILED)
            .ok();
        }

        let instance_uuid = database_instance.uuid;
        let instance_name = database_instance.name.clone();
        let host_uuid = database_instance.database_agent_host.uuid;

        if let Err(err) = database_instance
            .0
            .delete(
                &state,
                DeleteServerDatabaseInstanceOptions { force: data.force },
            )
            .await
        {
            tracing::error!(
                database_agent_host = %host_uuid,
                database_instance = %instance_uuid,
                "failed to delete database instance: {:?}",
                err
            );

            let (err, status) = shared::response::extract_readable_error(&err)
                .unwrap_or_else(|| (err.to_string(), StatusCode::EXPECTATION_FAILED));

            return ApiResponse::error(format!("failed to delete database instance: {err}"))
                .with_status(status)
                .ok();
        }

        activity_logger
            .log(
                "database-agent-host:instance.delete",
                serde_json::json!({
                    "uuid": instance_uuid,
                    "database_agent_host_uuid": host_uuid,

                    "name": instance_name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(patch::route))
        .routes(routes!(delete::route))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
