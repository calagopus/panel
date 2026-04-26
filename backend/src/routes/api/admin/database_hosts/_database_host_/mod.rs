use super::State;
use axum::{
    extract::{Path, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{
    GetState,
    models::{ByUuid, database_host::DatabaseHost, user::GetPermissionManager},
    response::ApiResponse,
};
use utoipa_axum::{router::OpenApiRouter, routes};

mod databases;
mod test;

pub type GetDatabaseHost = shared::extract::ConsumingExtension<DatabaseHost>;

pub async fn auth(
    state: GetState,
    permissions: GetPermissionManager,
    Path(database_host): Path<uuid::Uuid>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    if let Err(err) = permissions.has_admin_permission("database-hosts.read") {
        return Ok(err.into_response());
    }

    let database_host = DatabaseHost::by_uuid_optional(&state.database, database_host).await;
    let database_host = match database_host {
        Ok(Some(database_host)) => database_host,
        Ok(None) => {
            return Ok(ApiResponse::error("database host not found")
                .with_status(StatusCode::NOT_FOUND)
                .into_response());
        }
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    req.extensions_mut().insert(database_host);

    Ok(next.run(req).await)
}

mod get {
    use crate::routes::api::admin::database_hosts::_database_host_::GetDatabaseHost;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{IntoAdminApiObject, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        database_host: shared::models::database_host::AdminApiDatabaseHost,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "database_host" = uuid::Uuid,
            description = "The database host ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        database_host: GetDatabaseHost,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("database-hosts.read")?;

        ApiResponse::new_serialized(Response {
            database_host: database_host.0.into_admin_api_object(&state, ()).await?,
        })
        .ok()
    }
}

mod delete {
    use crate::routes::api::admin::database_hosts::_database_host_::GetDatabaseHost;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel, admin_activity::GetAdminActivityLogger,
            server_database::ServerDatabase, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), params(
        (
            "database_host" = uuid::Uuid,
            description = "The database host ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        database_host: GetDatabaseHost,
        activity_logger: GetAdminActivityLogger,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("database-hosts.delete")?;

        if ServerDatabase::count_by_database_host_uuid(&state.database, database_host.uuid).await
            > 0
        {
            return ApiResponse::error("database host has databases, cannot delete")
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        database_host.delete(&state, ()).await?;

        activity_logger
            .log(
                "database-host:delete",
                serde_json::json!({
                    "uuid": database_host.uuid,
                    "name": database_host.name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod patch {
    use crate::routes::api::admin::database_hosts::_database_host_::GetDatabaseHost;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            UpdatableModel, admin_activity::GetAdminActivityLogger,
            database_host::UpdateDatabaseHostOptions, user::GetPermissionManager,
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
            "database_host" = uuid::Uuid,
            description = "The database host ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(UpdateDatabaseHostOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        mut database_host: GetDatabaseHost,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<UpdateDatabaseHostOptions>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("database-hosts.update")?;

        match database_host.update(&state, data).await {
            Ok(_) => {}
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("database host with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        }

        database_host.credentials.censor();

        activity_logger
            .log(
                "database-host:update",
                serde_json::json!({
                    "uuid": database_host.uuid,
                    "name": database_host.name,
                    "deployment_enabled": database_host.deployment_enabled,
                    "maintenance_enabled": database_host.maintenance_enabled,

                    "public_host": database_host.public_host,
                    "public_port": database_host.public_port,

                    "credentials": database_host.credentials,
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
        .nest("/test", test::router(state))
        .nest("/databases", databases::router(state))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
