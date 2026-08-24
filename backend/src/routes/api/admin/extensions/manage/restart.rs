use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        GetState,
        models::{admin_activity::GetAdminActivityLogger, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
    ) -> ApiResponseResult {
        if !state.container_type.is_heavy() {
            return ApiResponse::error(
                "restarting the panel is only available in the official heavy container",
            )
            .with_status(StatusCode::NOT_IMPLEMENTED)
            .ok();
        }

        permissions.has_admin_permission("extensions.manage")?;

        match shared::heavy::ask(&shared::heavy::Request::RequestRestart).await {
            Ok(shared::heavy::Response::RestartAccepted) => {
                activity_logger
                    .log("extension:restart", serde_json::json!({}))
                    .await;

                ApiResponse::new_serialized(Response {}).ok()
            }
            Ok(answer) => {
                tracing::error!(
                    "the extension supervisor answered a restart request with {answer:?}"
                );

                ApiResponse::error("the extension supervisor gave an unexpected answer")
                    .with_status(StatusCode::INTERNAL_SERVER_ERROR)
                    .ok()
            }
            Err(err) => {
                tracing::error!("the extension supervisor could not be reached: {err}");

                ApiResponse::error("the extension supervisor could not be reached")
                    .with_status(StatusCode::SERVICE_UNAVAILABLE)
                    .ok()
            }
        }
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
