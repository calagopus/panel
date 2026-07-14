use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use axum::{
        extract::{Path, Query},
        http::StatusCode,
    };
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoApiObject, Pagination, PaginationParamsWithSearch, server::GetServer,
            server_backup::ServerBackup, server_backup_group::ServerBackupGroup,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        backups: Pagination<shared::models::server_backup::ApiServerBackup>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "backup_group" = uuid::Uuid,
            description = "The backup group ID",
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
        server: GetServer,
        Query(params): Query<PaginationParamsWithSearch>,
        Path((_server, backup_group)): Path<(uuid::Uuid, uuid::Uuid)>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("backup-groups.read")?;
        permissions.has_server_permission("backups.read")?;

        let backup_group = match ServerBackupGroup::by_server_uuid_uuid(
            &state.database,
            server.uuid,
            backup_group,
        )
        .await?
        {
            Some(backup_group) => backup_group,
            None => {
                return ApiResponse::error("backup group not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        };

        let backups = ServerBackup::by_server_uuid_node_uuid_backup_group_uuid_with_pagination(
            &state.database,
            server.uuid,
            server.node.uuid,
            backup_group.uuid,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        ApiResponse::new_serialized(Response {
            backups: backups
                .try_async_map(|backup| backup.into_api_object(&state, ()))
                .await?,
        })
        .ok()
    }
}

mod patch {
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            UpdatableModel,
            server::{GetServer, GetServerActivityLogger},
            server_backup_group::{ServerBackupGroup, UpdateServerBackupGroupOptions},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(patch, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = BAD_REQUEST, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "backup_group" = uuid::Uuid,
            description = "The backup group ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(UpdateServerBackupGroupOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        activity_logger: GetServerActivityLogger,
        Path((_server, backup_group)): Path<(uuid::Uuid, uuid::Uuid)>,
        shared::Payload(data): shared::Payload<UpdateServerBackupGroupOptions>,
    ) -> ApiResponseResult {
        permissions.has_server_permission("backup-groups.update")?;

        let mut backup_group = match ServerBackupGroup::by_server_uuid_uuid(
            &state.database,
            server.uuid,
            backup_group,
        )
        .await?
        {
            Some(backup_group) => backup_group,
            None => {
                return ApiResponse::error("backup group not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        };

        if let Err(err) = backup_group.update(&state, data).await {
            if err.is_unique_violation() {
                return ApiResponse::error("backup group with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }

            return ApiResponse::from(err).ok();
        }

        activity_logger
            .log(
                "server:backup-group.update",
                serde_json::json!({
                    "uuid": backup_group.uuid,
                    "name": backup_group.name,
                    "retention_count": backup_group.retention_count,
                    "retention_days": backup_group.retention_days,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod delete {
    use axum::{extract::Path, http::StatusCode};
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel,
            server::{GetServer, GetServerActivityLogger},
            server_backup_group::{DeleteServerBackupGroupOptions, ServerBackupGroup},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize, Default)]
    pub struct Payload {
        #[serde(default)]
        lock_backups: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "backup_group" = uuid::Uuid,
            description = "The backup group ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        activity_logger: GetServerActivityLogger,
        Path((_server, backup_group)): Path<(uuid::Uuid, uuid::Uuid)>,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_server_permission("backup-groups.delete")?;

        let backup_group = match ServerBackupGroup::by_server_uuid_uuid(
            &state.database,
            server.uuid,
            backup_group,
        )
        .await?
        {
            Some(backup_group) => backup_group,
            None => {
                return ApiResponse::error("backup group not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        };

        backup_group
            .delete(
                &state,
                DeleteServerBackupGroupOptions {
                    lock_backups: data.lock_backups,
                },
            )
            .await?;

        activity_logger
            .log(
                "server:backup-group.delete",
                serde_json::json!({
                    "uuid": backup_group.uuid,
                    "name": backup_group.name,
                    "lock_backups": data.lock_backups,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(patch::route))
        .routes(routes!(delete::route))
        .with_state(state.clone())
}
