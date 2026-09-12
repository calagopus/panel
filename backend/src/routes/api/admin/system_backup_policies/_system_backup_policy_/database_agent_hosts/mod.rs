use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _database_agent_host_;

mod get {
    use crate::routes::api::admin::system_backup_policies::_system_backup_policy_::GetSystemBackupPolicy;
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoAdminApiObject, Pagination, PaginationParamsWithSearch,
            system_backup_policy_database_agent_host::SystemBackupPolicyDatabaseAgentHost,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        database_agent_hosts:
            Pagination<shared::models::system_backup_policy_database_agent_host::AdminApiSystemBackupPolicyDatabaseAgentHost>,
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
        (
            "search" = Option<String>, Query,
            description = "Search term for items",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        system_backup_policy: GetSystemBackupPolicy,
        Query(params): Query<PaginationParamsWithSearch>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("system-backup-policies.read")?;

        let database_agent_hosts =
            SystemBackupPolicyDatabaseAgentHost::by_system_backup_policy_uuid_with_pagination(
                &state.database,
                system_backup_policy.uuid,
                params.page,
                params.per_page,
                params.search.as_deref(),
            )
            .await?;

        ApiResponse::new_serialized(Response {
            database_agent_hosts: database_agent_hosts
                .try_async_map(|host| host.into_admin_api_object(&state, ()))
                .await?,
        })
        .ok()
    }
}

mod post {
    use crate::routes::api::admin::system_backup_policies::_system_backup_policy_::GetSystemBackupPolicy;
    use axum::http::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel, admin_activity::GetAdminActivityLogger,
            server_backup::ServerBackupKind,
            system_backup_policy_database_agent_host::SystemBackupPolicyDatabaseAgentHost,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        database_agent_host_uuid: uuid::Uuid,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
        (status = BAD_REQUEST, body = ApiError),
        (status = CONFLICT, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
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
        permissions.has_admin_permission("system-backup-policies.update")?;

        if system_backup_policy.kind != ServerBackupKind::DatabaseInstance {
            return ApiResponse::error(
                "database agent hosts can only be attached to database backup policies",
            )
            .with_status(StatusCode::EXPECTATION_FAILED)
            .ok();
        }

        let options =
            shared::models::system_backup_policy_database_agent_host::CreateSystemBackupPolicyDatabaseAgentHostOptions {
                system_backup_policy_uuid: system_backup_policy.uuid,
                database_agent_host_uuid: data.database_agent_host_uuid,
            };
        match SystemBackupPolicyDatabaseAgentHost::create(&state, options).await {
            Ok(_) => {}
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error(
                    "database agent host already exists in this system backup policy",
                )
                .with_status(StatusCode::CONFLICT)
                .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        };

        activity_logger
            .log(
                "system-backup-policy:database-agent-host.create",
                serde_json::json!({
                    "system_backup_policy_uuid": system_backup_policy.uuid,
                    "database_agent_host_uuid": data.database_agent_host_uuid,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest(
            "/{database_agent_host}",
            _database_agent_host_::router(state),
        )
        .with_state(state.clone())
}
