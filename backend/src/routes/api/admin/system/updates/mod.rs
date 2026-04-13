use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod nodes;
mod recheck;

mod get {
    use serde::Serialize;
    use shared::{
        GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use std::sync::Arc;
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        update_information: Option<Arc<shared::updates::UpdateInformation>>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route(state: GetState, permissions: GetPermissionManager) -> ApiResponseResult {
        permissions.has_admin_permission("stats.read")?;

        ApiResponse::new_serialized(Response {
            update_information: state.updates.get_update_information().await,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .nest("/recheck", recheck::router(state))
        .nest("/nodes", nodes::router(state))
        .with_state(state.clone())
}
