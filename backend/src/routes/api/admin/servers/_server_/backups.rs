use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use axum::{extract::Query, http::StatusCode};
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            Pagination, server::GetServer, server_backup::ServerBackup, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Params {
        #[garde(range(min = 1))]
        #[serde(default = "Pagination::default_page")]
        page: i64,
        #[garde(range(min = 1, max = 100))]
        #[serde(default = "Pagination::default_per_page")]
        per_page: i64,
        #[garde(length(chars, min = 1, max = 100))]
        #[serde(
            default,
            deserialize_with = "shared::deserialize::deserialize_string_option"
        )]
        search: Option<compact_str::CompactString>,

        #[garde(skip)]
        #[serde(default)]
        partially_detached: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        backups: Pagination<shared::models::server_backup::AdminApiNodeServerBackup>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
    ), params(
        (
            "node" = uuid::Uuid,
            description = "The node ID",
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
            "partially_detached" = bool, Query,
            description = "Only show backups that are partially detached (assigned to the wrong node)",
            example = "false",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("nodes.backups")?;

        let backups = if params.partially_detached {
            ServerBackup::by_partially_detached_server_uuid_node_uuid_with_pagination(
                &state.database,
                server.uuid,
                server.node.uuid,
                params.page,
                params.per_page,
                params.search.as_deref(),
            )
            .await
        } else {
            ServerBackup::by_server_uuid_with_pagination(
                &state.database,
                server.uuid,
                params.page,
                params.per_page,
                params.search.as_deref(),
            )
            .await
        }?;

        let storage_url_retriever = state.storage.retrieve_urls().await?;

        ApiResponse::new_serialized(Response {
            backups: backups
                .try_async_map(|backup| {
                    backup.into_admin_node_api_object(&state, &storage_url_retriever)
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
