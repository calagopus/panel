use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use indexmap::IndexMap;
    use serde::Serialize;
    use shared::{
        GetState,
        models::{
            IntoAdminApiObject, system_backup_policy_run::SystemBackupPolicyRun,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        latest_runs: IndexMap<
            uuid::Uuid,
            shared::models::system_backup_policy_run::AdminApiSystemBackupPolicyRun,
        >,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route(state: GetState, permissions: GetPermissionManager) -> ApiResponseResult {
        permissions.has_admin_permission("system-backup-policies.read")?;

        let mut latest_runs = IndexMap::new();
        for run in SystemBackupPolicyRun::all_latest(&state.database).await? {
            latest_runs.insert(
                run.system_backup_policy.uuid,
                run.into_admin_api_object(&state, ()).await?,
            );
        }

        ApiResponse::new_serialized(Response { latest_runs }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
