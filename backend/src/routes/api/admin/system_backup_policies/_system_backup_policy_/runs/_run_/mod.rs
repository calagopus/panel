use super::State;
use crate::routes::api::admin::system_backup_policies::_system_backup_policy_::GetSystemBackupPolicy;
use axum::{
    extract::{Path, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{
    GetState, models::system_backup_policy_run::SystemBackupPolicyRun, response::ApiResponse,
};
use utoipa_axum::{router::OpenApiRouter, routes};

mod cancel;
mod targets;

pub type GetSystemBackupPolicyRun = shared::extract::ConsumingExtension<SystemBackupPolicyRun>;

pub async fn auth(
    state: GetState,
    system_backup_policy: GetSystemBackupPolicy,
    Path(run): Path<Vec<String>>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let run = match run.get(1).map(|s| s.parse::<uuid::Uuid>()) {
        Some(Ok(id)) => id,
        _ => {
            return Ok(ApiResponse::error("invalid run uuid")
                .with_status(StatusCode::BAD_REQUEST)
                .into_response());
        }
    };

    let run = SystemBackupPolicyRun::by_system_backup_policy_uuid_uuid(
        &state.database,
        system_backup_policy.uuid,
        run,
    )
    .await;
    let run = match run {
        Ok(Some(run)) => run,
        Ok(None) => {
            return Ok(ApiResponse::error("run not found")
                .with_status(StatusCode::NOT_FOUND)
                .into_response());
        }
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    req.extensions_mut().insert(system_backup_policy.0);
    req.extensions_mut().insert(run);

    Ok(next.run(req).await)
}

mod get {
    use crate::routes::api::admin::system_backup_policies::_system_backup_policy_::runs::_run_::GetSystemBackupPolicyRun;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{IntoAdminApiObject, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        run: shared::models::system_backup_policy_run::AdminApiSystemBackupPolicyRun,
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
        (
            "run" = uuid::Uuid,
            description = "The system backup policy run ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        run: GetSystemBackupPolicyRun,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("system-backup-policies.read")?;

        ApiResponse::new_serialized(Response {
            run: run.0.into_admin_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .nest("/cancel", cancel::router(state))
        .nest("/targets", targets::router(state))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
