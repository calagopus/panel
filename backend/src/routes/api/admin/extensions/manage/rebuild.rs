use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route(state: GetState, permissions: GetPermissionManager) -> ApiResponseResult {
        if !state.container_type.is_heavy() {
            return ApiResponse::error(
                "extension management is only available in the official heavy container",
            )
            .with_status(StatusCode::NOT_IMPLEMENTED)
            .ok();
        }

        permissions.has_admin_permission("extensions.manage")?;

        if shared::heavy::is_locked().await {
            return ApiResponse::error("extension rebuild is already in progress")
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        shared::heavy::trigger_rebuild().await?;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
