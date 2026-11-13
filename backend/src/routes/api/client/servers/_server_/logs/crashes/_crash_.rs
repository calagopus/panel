use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use axum::{extract::Path, http::StatusCode};
    use shared::{
        ApiError, GetState,
        models::{server::GetServer, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = String),
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
            "crash" = i64,
            description = "The crash ID",
            example = "1767225600000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        Path((_server, crash)): Path<(String, i64)>,
    ) -> ApiResponseResult {
        permissions.has_server_permission("control.read-console")?;

        let log = match server
            .node
            .fetch_cached(&state.database)
            .await?
            .api_client(&state.database)
            .await?
            .get_servers_server_logs_crashes_crash(server.uuid, crash)
            .await
        {
            Ok(log) => log,
            Err(wings_api::client::ApiHttpError::Http(StatusCode::NOT_FOUND, _)) => {
                return ApiResponse::error("crash not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
            Err(wings_api::client::ApiHttpError::Http(StatusCode::EXPECTATION_FAILED, _)) => {
                return ApiResponse::error("crash history is unavailable for this server")
                    .with_status(StatusCode::EXPECTATION_FAILED)
                    .ok();
            }
            Err(err) => return Err(err.into()),
        };

        ApiResponse::new_stream(log)
            .with_header("Content-Type", "text/plain")
            .ok()
    }
}

mod delete {
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            server::{GetServer, GetServerActivityLogger},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
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
            "crash" = i64,
            description = "The crash ID",
            example = "1767225600000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        activity_logger: GetServerActivityLogger,
        Path((_server, crash)): Path<(String, i64)>,
    ) -> ApiResponseResult {
        permissions.has_server_permission("control.delete-crashes")?;

        match server
            .node
            .fetch_cached(&state.database)
            .await?
            .api_client(&state.database)
            .await?
            .delete_servers_server_logs_crashes_crash(server.uuid, crash)
            .await
        {
            Ok(_) => {}
            Err(wings_api::client::ApiHttpError::Http(StatusCode::NOT_FOUND, _)) => {
                return ApiResponse::error("crash not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
            Err(err) => return Err(err.into()),
        }

        activity_logger
            .log(
                "server:crash.delete",
                serde_json::json!({
                    "crash_id": crash,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(delete::route))
        .with_state(state.clone())
}
