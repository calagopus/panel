use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _system_backup_policy_;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoAdminApiObject, Pagination, PaginationParamsWithSearch,
            system_backup_policy::SystemBackupPolicy, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        system_backup_policies:
            Pagination<shared::models::system_backup_policy::AdminApiSystemBackupPolicy>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ), params(
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
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        Query(params): Query<PaginationParamsWithSearch>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("system-backup-policies.read")?;

        let system_backup_policies = SystemBackupPolicy::all_with_pagination(
            &state.database,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        ApiResponse::new_serialized(Response {
            system_backup_policies: system_backup_policies
                .try_async_map(|policy| policy.into_admin_api_object(&state, ()))
                .await?,
        })
        .ok()
    }
}

mod post {
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel, IntoAdminApiObject,
            admin_activity::GetAdminActivityLogger,
            system_backup_policy::{CreateSystemBackupPolicyOptions, SystemBackupPolicy},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        system_backup_policy: shared::models::system_backup_policy::AdminApiSystemBackupPolicy,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), request_body = inline(CreateSystemBackupPolicyOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<CreateSystemBackupPolicyOptions>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("system-backup-policies.create")?;

        let system_backup_policy = match SystemBackupPolicy::create(&state, data).await {
            Ok(system_backup_policy) => system_backup_policy,
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("system backup policy with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        };

        activity_logger
            .log(
                "system-backup-policy:create",
                serde_json::json!({
                    "uuid": system_backup_policy.uuid,
                    "name": system_backup_policy.name,
                    "description": system_backup_policy.description,

                    "enabled": system_backup_policy.enabled,
                    "cron": system_backup_policy.cron.to_string(),
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            system_backup_policy: system_backup_policy
                .into_admin_api_object(&state, ())
                .await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest(
            "/{system_backup_policy}",
            _system_backup_policy_::router(state),
        )
        .with_state(state.clone())
}
