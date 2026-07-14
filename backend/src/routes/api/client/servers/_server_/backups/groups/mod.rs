use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _backup_group_;

mod get {
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoApiObject, server::GetServer, server_backup_group::ServerBackupGroup,
            user::GetPermissionManager,
        },
        prelude::AsyncIteratorExt,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        backup_groups: Vec<shared::models::server_backup_group::ApiServerBackupGroup>,
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
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
    ) -> ApiResponseResult {
        permissions.has_server_permission("backup-groups.read")?;

        let backup_groups =
            ServerBackupGroup::all_by_server_uuid(&state.database, server.uuid).await?;

        ApiResponse::new_serialized(Response {
            backup_groups: backup_groups
                .into_iter()
                .map(|backup_group| backup_group.into_api_object(&state, ()))
                .try_collect_async_vec()
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
        name: compact_str::CompactString,
        #[garde(range(min = 1))]
        #[schema(minimum = 1)]
        retention_count: Option<i32>,
        #[garde(range(min = 1))]
        #[schema(minimum = 1)]
        retention_days: Option<i32>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        backup_group: shared::models::server_backup_group::ApiServerBackupGroup,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = CONFLICT, body = ApiError),
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

        permissions.has_server_permission("backup-groups.create")?;

        let backup_groups_lock = state
            .cache
            .lock(
                format!("servers::{}::backup-groups", server.uuid),
                Some(30),
                Some(5),
            )
            .await?;

        let backup_groups =
            ServerBackupGroup::count_by_server_uuid(&state.database, server.uuid).await?;
        if backup_groups >= state.settings.get().await?.server.max_backup_group_count as i64 {
            return ApiResponse::error("maximum number of backup groups reached")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let options = shared::models::server_backup_group::CreateServerBackupGroupOptions {
            server_uuid: server.uuid,
            name: data.name,
            retention_count: data.retention_count,
            retention_days: data.retention_days,
        };
        let group = match ServerBackupGroup::create(&state, options).await {
            Ok(group) => group,
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("backup group with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        };

        drop(backup_groups_lock);

        activity_logger
            .log(
                "server:backup-group.create",
                serde_json::json!({
                    "uuid": group.uuid,
                    "name": group.name,
                    "retention_count": group.retention_count,
                    "retention_days": group.retention_days,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            backup_group: group.into_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/{backup_group}", _backup_group_::router(state))
        .with_state(state.clone())
}
