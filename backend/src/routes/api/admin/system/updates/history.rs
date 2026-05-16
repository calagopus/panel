use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use std::collections::BTreeMap;
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct ResponseVersionHistory<'a> {
        panel: &'a [shared::updates::VersionHistoryEntry],
        extensions: &'a BTreeMap<&'static str, Vec<shared::updates::VersionHistoryEntry>>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response<'a> {
        version_history: ResponseVersionHistory<'a>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = EXPECTATION_FAILED, body = ApiError),
    ))]
    pub async fn route(state: GetState, permissions: GetPermissionManager) -> ApiResponseResult {
        permissions.has_admin_permission("stats.read")?;

        ApiResponse::new_serialized(Response {
            version_history: ResponseVersionHistory {
                panel: &state.updates.get_panel_version_history().await,
                extensions: &*state.updates.get_extension_version_history().await,
            },
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
