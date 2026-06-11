use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _file_;

mod get {
    use shared::{
        GetState,
        models::{node::GetNode, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(wings_api::system_logs::get::Response200)),
    ), params(
        (
            "node" = uuid::Uuid,
            description = "The node ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        node: GetNode,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("nodes.read")?;

        let logs = node
            .api_client(&state.database)
            .await?
            .get_system_logs()
            .await?;

        ApiResponse::new_serialized(logs).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .nest("/{file}", _file_::router(state))
        .with_state(state.clone())
}
