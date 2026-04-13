use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use std::sync::Arc;
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        update_information: Arc<shared::updates::UpdateInformation>,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = EXPECTATION_FAILED, body = ApiError),
    ))]
    pub async fn route(state: GetState, permissions: GetPermissionManager) -> ApiResponseResult {
        permissions.has_admin_permission("stats.read")?;

        let update_information = match state.updates.trigger_recheck_and_wait().await {
            Ok(info) => info,
            Err(err) => {
                return ApiResponse::error(format!("failed to check for updates: {}", err))
                    .with_status(StatusCode::EXPECTATION_FAILED)
                    .ok();
            }
        };

        ApiResponse::new_serialized(Response { update_information }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
