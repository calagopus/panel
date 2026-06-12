use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{node::GetNode, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        config: wings_api::Config,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        node: GetNode,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("nodes.read")?;

        let mut config = node.fetch_configuration(&state.database).await?;

        if permissions
            .has_admin_permission("nodes.read-token")
            .is_err()
        {
            config.token_id = "redacted".into();
            config.token = "redacted".into();
        }

        ApiResponse::new_serialized(Response { config }).ok()
    }
}

mod patch {
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            admin_activity::GetAdminActivityLogger, node::GetNode, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        applied: bool,
    }

    #[utoipa::path(patch, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
    ), request_body = serde_json::Value)]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        node: GetNode,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(mut data): shared::Payload<serde_json::Value>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("nodes.update")?;

        wings_api::strip_config_paths(&mut data);

        let applied = node.update_configuration(&state.database, &data).await?;

        activity_logger
            .log(
                "node:update-config",
                serde_json::json!({
                    "uuid": node.uuid,
                    "config": data,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response { applied }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(patch::route))
        .with_state(state.clone())
}
