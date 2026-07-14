use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _backup_;
mod groups;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            IntoApiObject, Pagination, server::GetServer, server_backup::ServerBackup,
            user::GetPermissionManager,
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
        ungrouped: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        backups: Pagination<shared::models::server_backup::ApiServerBackup>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
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
            "ungrouped" = bool, Query,
            description = "Only show backups that are not assigned to a backup group",
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

        permissions.has_server_permission("backups.read")?;

        let backups = if params.ungrouped {
            ServerBackup::by_ungrouped_server_uuid_node_uuid_with_pagination(
                &state.database,
                server.uuid,
                server.node.uuid,
                params.page,
                params.per_page,
                params.search.as_deref(),
            )
            .await
        } else {
            ServerBackup::by_server_uuid_node_uuid_with_pagination(
                &state.database,
                server.uuid,
                server.node.uuid,
                params.page,
                params.per_page,
                params.search.as_deref(),
            )
            .await
        }?;

        ApiResponse::new_serialized(Response {
            backups: backups
                .try_async_map(|backup| backup.into_api_object(&state, ()))
                .await?,
        })
        .ok()
    }
}

mod post {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel, IntoApiObject,
            server::{GetServer, GetServerActivityLogger},
            server_backup::{GroupRotationOutcome, ServerBackup},
            server_backup_group::ServerBackupGroup,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        name: Option<compact_str::CompactString>,
        #[garde(skip)]
        backup_group_uuid: Option<uuid::Uuid>,

        #[garde(skip)]
        ignored_files: Vec<compact_str::CompactString>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        backup: shared::models::server_backup::ApiServerBackup,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = UNAUTHORIZED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        activity_logger: GetServerActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("backups.create")?;

        let backup_group = if let Some(group_uuid) = data.backup_group_uuid {
            match ServerBackupGroup::by_server_uuid_uuid(&state.database, server.uuid, group_uuid)
                .await?
            {
                Some(group) => Some(group),
                None => {
                    return ApiResponse::error("backup group not found")
                        .with_status(StatusCode::NOT_FOUND)
                        .ok();
                }
            }
        } else {
            None
        };

        let backups_lock = state
            .cache
            .lock(
                format!("servers::{}::backups", server.uuid),
                Some(30),
                Some(5),
            )
            .await?;

        if let Some(group) = &backup_group
            && ServerBackup::rotate_group_for_create(&state, group).await?
                == GroupRotationOutcome::BlockedAllLocked
        {
            return ApiResponse::error("backup group is full and all of its backups are locked")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let backups = ServerBackup::count_by_server_uuid(&state.database, server.uuid).await?;
        if backups >= server.backup_limit as i64 {
            return ApiResponse::error("maximum number of backups reached")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let ratelimit = state
            .settings
            .get_as(|s| s.ratelimits.client_servers_backups_create)
            .await?;
        state
            .cache
            .ratelimit(
                "client/servers/backups/create",
                ratelimit.hits,
                ratelimit.window_seconds,
                server.uuid.to_string(),
            )
            .await?;

        let options = shared::models::server_backup::CreateServerBackupOptions {
            server: &server,
            name: data.name.unwrap_or_else(ServerBackup::default_name),
            backup_group_uuid: backup_group.as_ref().map(|group| group.uuid),
            ignored_files: data.ignored_files,
            metadata: ServerBackup::generate_metadata(&state, &server).await?,
        };
        let backup = ServerBackup::create(&state, options).await?;

        drop(backups_lock);

        activity_logger
            .log(
                "server:backup.create",
                serde_json::json!({
                    "uuid": backup.uuid,
                    "name": backup.name,
                    "ignored_files": backup.ignored_files,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            backup: backup.into_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/groups", groups::router(state))
        .nest("/{backup}", _backup_::router(state))
        .with_state(state.clone())
}
