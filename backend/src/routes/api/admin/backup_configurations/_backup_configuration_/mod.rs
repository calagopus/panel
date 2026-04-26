use super::State;
use axum::{
    extract::{Path, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{
    GetState,
    models::{ByUuid, backup_configuration::BackupConfiguration, user::GetPermissionManager},
    response::ApiResponse,
};
use utoipa_axum::{router::OpenApiRouter, routes};

mod backups;
mod locations;
mod nodes;
mod servers;
mod stats;

pub type GetBackupConfiguration = shared::extract::ConsumingExtension<BackupConfiguration>;

pub async fn auth(
    state: GetState,
    permissions: GetPermissionManager,
    Path(backup_configuration): Path<Vec<String>>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let backup_configuration = match backup_configuration
        .first()
        .map(|s| s.parse::<uuid::Uuid>())
    {
        Some(Ok(id)) => id,
        _ => {
            return Ok(ApiResponse::error("invalid backup configuration uuid")
                .with_status(StatusCode::BAD_REQUEST)
                .into_response());
        }
    };

    if let Err(err) = permissions.has_admin_permission("backup-configurations.read") {
        return Ok(err.into_response());
    }

    let backup_configuration =
        BackupConfiguration::by_uuid_optional(&state.database, backup_configuration).await;
    let backup_configuration = match backup_configuration {
        Ok(Some(backup_configuration)) => backup_configuration,
        Ok(None) => {
            return Ok(ApiResponse::error("location not found")
                .with_status(StatusCode::NOT_FOUND)
                .into_response());
        }
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    req.extensions_mut().insert(backup_configuration);

    Ok(next.run(req).await)
}

mod get {
    use crate::routes::api::admin::backup_configurations::_backup_configuration_::GetBackupConfiguration;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{IntoAdminApiObject, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        backup_configuration: shared::models::backup_configuration::AdminApiBackupConfiguration,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "backup_configuration" = uuid::Uuid,
            description = "The backup configuration ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        backup_configuration: GetBackupConfiguration,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("backup-configurations.read")?;

        ApiResponse::new_serialized(Response {
            backup_configuration: backup_configuration
                .0
                .into_admin_api_object(&state, ())
                .await?,
        })
        .ok()
    }
}

mod delete {
    use crate::routes::api::admin::backup_configurations::_backup_configuration_::GetBackupConfiguration;
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
            "backup_configuration" = uuid::Uuid,
            description = "The backup configuration ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        backup_configuration: GetBackupConfiguration,
        activity_logger: GetAdminActivityLogger,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("backup-configurations.delete")?;

        backup_configuration.delete(&state, ()).await?;

        activity_logger
            .log(
                "backup-configuration:delete",
                serde_json::json!({
                    "uuid": backup_configuration.uuid,
                    "name": backup_configuration.name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod patch {
    use crate::routes::api::admin::backup_configurations::_backup_configuration_::GetBackupConfiguration;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            UpdatableModel, admin_activity::GetAdminActivityLogger,
            backup_configuration::UpdateBackupConfigurationOptions, user::GetPermissionManager,
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
            "backup_configuration" = uuid::Uuid,
            description = "The backup configuration ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(UpdateBackupConfigurationOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        mut backup_configuration: GetBackupConfiguration,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<UpdateBackupConfigurationOptions>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("backup-configurations.update")?;

        match backup_configuration.update(&state, data).await {
            Ok(_) => {}
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("backup configuration with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        }

        activity_logger
            .log(
                "backup-configuration:update",
                serde_json::json!({
                    "uuid": backup_configuration.uuid,
                    "name": backup_configuration.name,
                    "description": backup_configuration.description,

                    "maintenance_enabled": backup_configuration.maintenance_enabled,
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
        .nest("/stats", stats::router(state))
        .nest("/backups", backups::router(state))
        .nest("/locations", locations::router(state))
        .nest("/nodes", nodes::router(state))
        .nest("/servers", servers::router(state))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
