use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use crate::routes::api::admin::system_backup_policies::_system_backup_policy_::runs::_run_::GetSystemBackupPolicyRun;
    use axum::{extract::Query, http::StatusCode};
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            IntoAdminApiObject, Pagination, PaginationParamsWithSearch,
            system_backup_policy_run_target::{
                SystemBackupPolicyRunTarget, SystemBackupPolicyRunTargetStatus,
            },
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Params {
        status: Option<SystemBackupPolicyRunTargetStatus>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        targets: Pagination<
            shared::models::system_backup_policy_run_target::AdminApiSystemBackupPolicyRunTarget,
        >,
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
        (
            "search" = Option<String>, Query,
            description = "Search term for items",
        ),
        (
            "status" = Option<SystemBackupPolicyRunTargetStatus>, Query,
            description = "Only show targets with this status",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        run: GetSystemBackupPolicyRun,
        Query(pagination): Query<PaginationParamsWithSearch>,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&pagination) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("system-backup-policies.read")?;

        let targets =
            SystemBackupPolicyRunTarget::by_system_backup_policy_run_uuid_with_pagination(
                &state.database,
                run.uuid,
                params.status,
                pagination.page,
                pagination.per_page,
                pagination.search.as_deref(),
            )
            .await?;

        let storage_url_retriever = state.storage.retrieve_urls().await?;

        ApiResponse::new_serialized(Response {
            targets: targets
                .try_async_map(|target| {
                    target.into_admin_api_object(&state, &storage_url_retriever)
                })
                .await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
