use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod delete_failed;

mod get {
    use crate::routes::api::admin::database_agent_hosts::_database_agent_host_::GetDatabaseAgentHost;
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            Pagination, PaginationParamsWithSearch,
            server_backup::{FailedServerBackupScope, ServerBackup},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        backups: Pagination<shared::models::server_backup::AdminApiNodeServerBackup>,
        failed: i64,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "database_agent_host" = uuid::Uuid,
            description = "The database agent host ID",
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
        database_agent_host: GetDatabaseAgentHost,
        Query(params): Query<PaginationParamsWithSearch>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("database-agent-hosts.backups")?;

        let backups = ServerBackup::by_database_agent_host_uuid_with_pagination(
            &state.database,
            database_agent_host.uuid,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        let storage_url_retriever = state.storage.retrieve_urls().await?;

        ApiResponse::new_serialized(Response {
            backups: backups
                .try_async_map(|backup| {
                    backup.into_admin_node_api_object(&state, &storage_url_retriever)
                })
                .await?,
            failed: ServerBackup::count_failed(
                &state.database,
                FailedServerBackupScope::DatabaseAgentHost(database_agent_host.uuid),
            )
            .await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .nest("/delete-failed", delete_failed::router(state))
        .with_state(state.clone())
}
