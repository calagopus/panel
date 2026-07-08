use super::State;
use axum::{
    extract::{Path, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{
    GetState,
    models::{ByUuid, database_agent_host::DatabaseAgentHost, user::GetPermissionManager},
    response::ApiResponse,
};
use utoipa_axum::{router::OpenApiRouter, routes};

mod config;
mod reset_token;
mod system;
mod test;
mod token;

pub type GetDatabaseAgentHost = shared::extract::ConsumingExtension<DatabaseAgentHost>;

pub async fn auth(
    state: GetState,
    permissions: GetPermissionManager,
    Path(database_agent_host): Path<Vec<String>>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let database_agent_host = match database_agent_host.first().map(|s| s.parse::<uuid::Uuid>()) {
        Some(Ok(id)) => id,
        _ => {
            return Ok(ApiResponse::error("invalid database agent host uuid")
                .with_status(StatusCode::BAD_REQUEST)
                .into_response());
        }
    };

    if let Err(err) = permissions.has_admin_permission("database-agent-hosts.read") {
        return Ok(err.into_response());
    }

    let database_agent_host =
        DatabaseAgentHost::by_uuid_optional(&state.database, database_agent_host).await;
    let database_agent_host = match database_agent_host {
        Ok(Some(database_agent_host)) => database_agent_host,
        Ok(None) => {
            return Ok(ApiResponse::error("database agent host not found")
                .with_status(StatusCode::NOT_FOUND)
                .into_response());
        }
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    req.extensions_mut().insert(database_agent_host);

    Ok(next.run(req).await)
}

mod get {
    use crate::routes::api::admin::database_agent_hosts::_database_agent_host_::GetDatabaseAgentHost;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{IntoAdminApiObject, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        database_agent_host: shared::models::database_agent_host::AdminApiDatabaseAgentHost,
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
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        database_agent_host: GetDatabaseAgentHost,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("database-agent-hosts.read")?;

        ApiResponse::new_serialized(Response {
            database_agent_host: database_agent_host
                .0
                .into_admin_api_object(&state, ())
                .await?,
        })
        .ok()
    }
}

mod delete {
    use crate::routes::api::admin::database_agent_hosts::_database_agent_host_::GetDatabaseAgentHost;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel, admin_activity::GetAdminActivityLogger, user::GetPermissionManager,
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
            "database_agent_host" = uuid::Uuid,
            description = "The database agent host ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        database_agent_host: GetDatabaseAgentHost,
        activity_logger: GetAdminActivityLogger,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("database-agent-hosts.delete")?;

        database_agent_host.delete(&state, ()).await?;

        activity_logger
            .log(
                "database-agent-host:delete",
                serde_json::json!({
                    "uuid": database_agent_host.uuid,
                    "name": database_agent_host.name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod patch {
    use crate::routes::api::admin::database_agent_hosts::_database_agent_host_::GetDatabaseAgentHost;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            UpdatableModel, admin_activity::GetAdminActivityLogger,
            database_agent_host::UpdateDatabaseAgentHostOptions, user::GetPermissionManager,
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
            "database_agent_host" = uuid::Uuid,
            description = "The database agent host ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(UpdateDatabaseAgentHostOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        mut database_agent_host: GetDatabaseAgentHost,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<UpdateDatabaseAgentHostOptions>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("database-agent-hosts.update")?;

        match database_agent_host.update(&state, data).await {
            Ok(_) => {}
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("database agent host with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        }

        activity_logger
            .log(
                "database-agent-host:update",
                serde_json::json!({
                    "uuid": database_agent_host.uuid,
                    "name": database_agent_host.name,
                    "url": database_agent_host.url,
                    "deployment_enabled": database_agent_host.deployment_enabled,
                    "maintenance_enabled": database_agent_host.maintenance_enabled,
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
        .nest("/token", token::router(state))
        .nest("/reset-token", reset_token::router(state))
        .nest("/config", config::router(state))
        .nest("/test", test::router(state))
        .nest("/system", system::router(state))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
