use super::State;
use axum::{
    extract::{Path, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{
    GetState,
    models::{ByUuid, system_backup_policy::SystemBackupPolicy, user::GetPermissionManager},
    response::ApiResponse,
};
use utoipa_axum::{router::OpenApiRouter, routes};

mod backups;
mod locations;
mod nodes;
mod servers;
mod trigger;

pub type GetSystemBackupPolicy = shared::extract::ConsumingExtension<SystemBackupPolicy>;

pub async fn auth(
    state: GetState,
    permissions: GetPermissionManager,
    Path(system_backup_policy): Path<Vec<String>>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let system_backup_policy = match system_backup_policy
        .first()
        .map(|s| s.parse::<uuid::Uuid>())
    {
        Some(Ok(id)) => id,
        _ => {
            return Ok(ApiResponse::error("invalid system backup policy uuid")
                .with_status(StatusCode::BAD_REQUEST)
                .into_response());
        }
    };

    if let Err(err) = permissions.has_admin_permission("system-backup-policies.read") {
        return Ok(err.into_response());
    }

    let system_backup_policy =
        SystemBackupPolicy::by_uuid_optional(&state.database, system_backup_policy).await;
    let system_backup_policy = match system_backup_policy {
        Ok(Some(system_backup_policy)) => system_backup_policy,
        Ok(None) => {
            return Ok(ApiResponse::error("system backup policy not found")
                .with_status(StatusCode::NOT_FOUND)
                .into_response());
        }
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    req.extensions_mut().insert(system_backup_policy);

    Ok(next.run(req).await)
}

mod get {
    use crate::routes::api::admin::system_backup_policies::_system_backup_policy_::GetSystemBackupPolicy;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{IntoAdminApiObject, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        system_backup_policy: shared::models::system_backup_policy::AdminApiSystemBackupPolicy,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "system_backup_policy" = uuid::Uuid,
            description = "The system backup policy ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        system_backup_policy: GetSystemBackupPolicy,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("system-backup-policies.read")?;

        ApiResponse::new_serialized(Response {
            system_backup_policy: system_backup_policy
                .0
                .into_admin_api_object(&state, ())
                .await?,
        })
        .ok()
    }
}

mod delete {
    use crate::routes::api::admin::system_backup_policies::_system_backup_policy_::GetSystemBackupPolicy;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel, admin_activity::GetAdminActivityLogger, server_backup::ServerBackup,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize, Default)]
    pub struct Payload {
        #[serde(default)]
        delete_backups: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "system_backup_policy" = uuid::Uuid,
            description = "The system backup policy ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        system_backup_policy: GetSystemBackupPolicy,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("system-backup-policies.delete")?;

        let backups = if data.delete_backups {
            ServerBackup::all_by_system_backup_policy_uuid(
                &state.database,
                system_backup_policy.uuid,
            )
            .await?
        } else {
            Vec::new()
        };

        system_backup_policy.delete(&state, ()).await?;

        if !backups.is_empty() {
            let state = state.0.clone();

            tokio::spawn(async move {
                for backup in backups {
                    if let Err(err) = backup.delete(&state, Default::default()).await {
                        tracing::error!(
                            backup = %backup.uuid,
                            "failed to delete system backup policy backup: {:#?}",
                            err
                        );
                    }
                }
            });
        }

        activity_logger
            .log(
                "system-backup-policy:delete",
                serde_json::json!({
                    "uuid": system_backup_policy.uuid,
                    "name": system_backup_policy.name,

                    "delete_backups": data.delete_backups,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod patch {
    use crate::routes::api::admin::system_backup_policies::_system_backup_policy_::GetSystemBackupPolicy;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            UpdatableModel, admin_activity::GetAdminActivityLogger,
            system_backup_policy::UpdateSystemBackupPolicyOptions, user::GetPermissionManager,
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
            "system_backup_policy" = uuid::Uuid,
            description = "The system backup policy ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(UpdateSystemBackupPolicyOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        mut system_backup_policy: GetSystemBackupPolicy,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<UpdateSystemBackupPolicyOptions>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("system-backup-policies.update")?;

        match system_backup_policy.update(&state, data).await {
            Ok(_) => {}
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("system backup policy with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        }

        activity_logger
            .log(
                "system-backup-policy:update",
                serde_json::json!({
                    "uuid": system_backup_policy.uuid,
                    "name": system_backup_policy.name,
                    "description": system_backup_policy.description,

                    "enabled": system_backup_policy.enabled,
                    "cron": system_backup_policy.cron.to_string(),
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
        .nest("/backups", backups::router(state))
        .nest("/locations", locations::router(state))
        .nest("/nodes", nodes::router(state))
        .nest("/servers", servers::router(state))
        .nest("/trigger", trigger::router(state))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
