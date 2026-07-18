use super::State;
use axum::{
    extract::{Path, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{
    GetState,
    models::{
        server::GetServer, server_database_instance::ServerDatabaseInstance,
        user::GetPermissionManager,
    },
    response::ApiResponse,
};
use utoipa_axum::{router::OpenApiRouter, routes};

mod databases;
mod export;
mod logs;
mod power;
mod resources;
mod users;

pub type GetServerDatabaseInstance = shared::extract::ConsumingExtension<ServerDatabaseInstance>;

pub async fn auth(
    state: GetState,
    permissions: GetPermissionManager,
    server: GetServer,
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

    if let Err(err) = permissions.has_server_permission("database-instances.read") {
        return Ok(err.into_response());
    }

    let database_instance = ServerDatabaseInstance::by_server_uuid_uuid(
        &state.database,
        server.uuid,
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

    req.extensions_mut().insert(server.0);
    req.extensions_mut().insert(database_instance);

    Ok(next.run(req).await)
}

mod get {
    use crate::routes::api::client::servers::_server_::databases::instances::_instance_::GetServerDatabaseInstance;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{IntoApiObject, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct LiveDetails {
        suspended: bool,
        #[schema(inline)]
        utilization: db_agent_api::ResourceUsage,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        instance: shared::models::server_database_instance::ApiServerDatabaseInstance,
        #[schema(inline)]
        live: Option<LiveDetails>,
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
        permissions.has_server_permission("database-instances.read")?;

        let live = match database_instance
            .database_agent_host
            .api_client(&state.database)
            .await
        {
            Ok(client) => match (
                client.get_instances_instance(database_instance.uuid).await,
                client
                    .get_instances_instance_utilization(database_instance.uuid)
                    .await,
            ) {
                (Ok(instance), Ok(utilization)) => Some(LiveDetails {
                    suspended: instance.instance.suspended,
                    utilization: utilization.utilization,
                }),
                _ => None,
            },
            Err(_) => None,
        };

        ApiResponse::new_serialized(Response {
            instance: database_instance.0.into_api_object(&state, ()).await?,
            live,
        })
        .ok()
    }
}

mod patch {
    use crate::routes::api::client::servers::_server_::databases::instances::_instance_::GetServerDatabaseInstance;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            UpdatableModel, server::GetServerActivityLogger,
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
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
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
        activity_logger: GetServerActivityLogger,
        mut database_instance: GetServerDatabaseInstance,
        shared::Payload(data): shared::Payload<UpdateServerDatabaseInstanceOptions>,
    ) -> ApiResponseResult {
        permissions.has_server_permission("database-instances.update")?;

        match database_instance.update(&state, data).await {
            Ok(_) => {}
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("database instance with name already exists")
                    .with_status(axum::http::StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        }

        activity_logger
            .log(
                "server:database-instance.update",
                serde_json::json!({
                    "uuid": database_instance.uuid,
                    "name": database_instance.name,
                    "locked": database_instance.locked,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod delete {
    use crate::routes::api::client::servers::_server_::databases::instances::_instance_::GetServerDatabaseInstance;
    use axum::{extract::Query, http::StatusCode};
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel,
            server::{GetServer, GetServerActivityLogger},
            server_database_instance::DeleteServerDatabaseInstanceOptions,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Params {
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
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "database_instance" = uuid::Uuid,
            description = "The database instance ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "force" = bool, Query,
            description = "Whether to delete the panel record even if the agent cannot be reached",
            example = "false",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        database_instance: GetServerDatabaseInstance,
        activity_logger: GetServerActivityLogger,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        permissions.has_server_permission("database-instances.delete")?;

        if database_instance.locked {
            return ApiResponse::error("database instance is locked and cannot be deleted")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        if database_instance.database_agent_host.maintenance_enabled {
            return ApiResponse::error(
                "cannot delete database instance while database agent host is in maintenance mode",
            )
            .with_status(StatusCode::EXPECTATION_FAILED)
            .ok();
        }

        if let Err(err) = database_instance
            .delete(
                &state,
                DeleteServerDatabaseInstanceOptions {
                    force: params.force,
                },
            )
            .await
        {
            if err
                .downcast_ref::<shared::response::DisplayError>()
                .is_some()
            {
                return ApiResponse::from(err).ok();
            }

            tracing::error!(server = %server.uuid, "failed to delete database instance: {:?}", err);

            return ApiResponse::error("failed to delete database instance")
                .with_status(StatusCode::INTERNAL_SERVER_ERROR)
                .ok();
        }

        activity_logger
            .log(
                "server:database-instance.delete",
                serde_json::json!({
                    "uuid": database_instance.uuid,
                    "name": database_instance.name,
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
        .nest("/databases", databases::router(state))
        .nest("/export", export::router(state))
        .nest("/users", users::router(state))
        .nest("/logs", logs::router(state))
        .nest("/power", power::router(state))
        .nest("/resources", resources::router(state))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
