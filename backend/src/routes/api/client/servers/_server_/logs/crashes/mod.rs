use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _crash_;

mod get {
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{server::GetServer, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        crashes: Vec<wings_api::Crash>,
    }

    #[utoipa::path(get, path = "/", responses(
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
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
    ) -> ApiResponseResult {
        permissions.has_server_permission("control.read-console")?;

        let crashes = match server
            .node
            .fetch_cached(&state.database)
            .await?
            .api_client(&state.database)
            .await?
            .get_servers_server_logs_crashes(server.uuid)
            .await
        {
            Ok(data) => data.crashes,
            Err(wings_api::client::ApiHttpError::Http(
                status @ (StatusCode::NOT_FOUND | StatusCode::EXPECTATION_FAILED),
                _,
            )) => {
                return ApiResponse::error("crash history is unavailable for this server")
                    .with_status(status)
                    .ok();
            }
            Err(err) => return Err(err.into()),
        };

        ApiResponse::new_serialized(Response { crashes }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .nest("/{crash}", _crash_::router(state))
        .with_state(state.clone())
}
