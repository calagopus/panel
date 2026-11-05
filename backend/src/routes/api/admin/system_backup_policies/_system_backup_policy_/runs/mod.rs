use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _run_;

mod get {
    use crate::routes::api::admin::system_backup_policies::_system_backup_policy_::GetSystemBackupPolicy;
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoAdminApiObject, Pagination, PaginationParams,
            system_backup_policy_run::SystemBackupPolicyRun, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        runs: Pagination<shared::models::system_backup_policy_run::AdminApiSystemBackupPolicyRun>,
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
            "page" = i64, Query,
            description = "The page number",
            example = "1",
        ),
        (
            "per_page" = i64, Query,
            description = "The number of items per page",
            example = "10",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        system_backup_policy: GetSystemBackupPolicy,
        Query(params): Query<PaginationParams>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("system-backup-policies.read")?;

        let runs = SystemBackupPolicyRun::by_system_backup_policy_uuid_with_pagination(
            &state.database,
            system_backup_policy.uuid,
            params.page,
            params.per_page,
        )
        .await?;

        ApiResponse::new_serialized(Response {
            runs: runs
                .try_async_map(|run| run.into_admin_api_object(&state, ()))
                .await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .nest("/{run}", _run_::router(state))
        .with_state(state.clone())
}
