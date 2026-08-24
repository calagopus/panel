use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _extension_;
#[cfg(unix)]
mod manage;

mod get {
    use serde::Serialize;
    use shared::{
        GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response<'a> {
        #[schema(inline)]
        extensions: &'a [shared::extensions::ConstructedExtension],
        disabled: Vec<compact_str::CompactString>,
        pending_disabled: Vec<compact_str::CompactString>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route(state: GetState, permissions: GetPermissionManager) -> ApiResponseResult {
        permissions.has_admin_permission("extensions.read")?;

        let pending_disabled = state
            .settings
            .get_as(|s| s.disabled_extensions.clone())
            .await?;

        ApiResponse::new_serialized(Response {
            extensions: &state.extensions.extensions().await,
            disabled: state.extensions.disabled(),
            pending_disabled,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    let router = OpenApiRouter::new().routes(routes!(get::route));

    #[cfg(unix)]
    let router = router.nest("/manage", manage::router(state));

    router
        .nest("/{extension}", _extension_::router(state))
        .with_state(state.clone())
}
