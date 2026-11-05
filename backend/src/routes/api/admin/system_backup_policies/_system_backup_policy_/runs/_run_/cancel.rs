use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::admin::system_backup_policies::_system_backup_policy_::{
        GetSystemBackupPolicy, runs::_run_::GetSystemBackupPolicyRun,
    };
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            admin_activity::GetAdminActivityLogger,
            system_backup_policy_run::SystemBackupPolicyRun, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
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
        system_backup_policy: GetSystemBackupPolicy,
        run: GetSystemBackupPolicyRun,
        activity_logger: GetAdminActivityLogger,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("system-backup-policies.update")?;

        if !SystemBackupPolicyRun::cancel(&state.database, system_backup_policy.uuid, run.uuid)
            .await?
        {
            return ApiResponse::error("this run is already finished or cancelled")
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        activity_logger
            .log(
                "system-backup-policy:run.cancel",
                serde_json::json!({
                    "system_backup_policy_uuid": system_backup_policy.uuid,
                    "run_uuid": run.uuid,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
