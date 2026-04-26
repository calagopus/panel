use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use axum::http::StatusCode;
    use shared::{
        GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = String),
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

        let logs = shared::heavy::get_build_logs().await;

        ApiResponse::new_stream(logs).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
