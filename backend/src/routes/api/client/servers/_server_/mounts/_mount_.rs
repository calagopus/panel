use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod delete {
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel,
            server::{GetServer, GetServerActivityLogger},
            server_mount::ServerMount,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "mount" = uuid::Uuid,
            description = "The mount ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        activity_logger: GetServerActivityLogger,
        Path((_server, mount)): Path<(String, uuid::Uuid)>,
    ) -> ApiResponseResult {
        permissions.has_server_permission("mounts.detach")?;

        let server_mount =
            match ServerMount::by_server_uuid_mount_uuid(&state.database, server.uuid, mount)
                .await?
            {
                Some(mount) => mount,
                None => {
                    return ApiResponse::error("mount not found")
                        .with_status(StatusCode::NOT_FOUND)
                        .ok();
                }
            };

        if !server_mount
            .mount
            .fetch_cached(&state.database)
            .await?
            .user_mountable
        {
            return ApiResponse::new_serialized(ApiError::new_value(&["mount not found"]))
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        }

        server_mount.delete(&state, ()).await?;

        activity_logger
            .log(
                "server:mounts.detach",
                serde_json::json!({
                    "mount_uuid": server_mount.mount.uuid,
                }),
            )
            .await;

        server.0.batch_sync(&state.database).await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(delete::route))
        .with_state(state.clone())
}
