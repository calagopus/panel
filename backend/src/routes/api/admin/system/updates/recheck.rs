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
                let (err, status) = shared::response::extract_readable_error(&err)
                    .unwrap_or_else(|| (err.to_string(), StatusCode::EXPECTATION_FAILED));

                return ApiResponse::error(format!("failed to check for updates: {}", err))
                    .with_status(status)
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
