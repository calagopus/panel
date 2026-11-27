use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use serde::Serialize;
    use shared::{
        models::user::{AuthMethod, GetAuthMethod},
        response::{ApiResponse, ApiResponseResult},
        ApiError,
    };
    use utoipa::ToSchema;
    use axum::http::StatusCode;

    #[derive(ToSchema, Serialize)]
    struct Response {
        user_permissions: Vec<compact_str::CompactString>,
        admin_permissions: Vec<compact_str::CompactString>,
        server_permissions: Vec<compact_str::CompactString>,
        unrestricted_admin: bool,
    }

    #[utoipa::path(
        get,
        path = "/",
        responses(
            (status = OK, body = inline(Response)),
            (status = BAD_REQUEST, body = ApiError),
        ),
    )]
    pub async fn route(auth_method: GetAuthMethod) -> ApiResponseResult {
        let AuthMethod::ApiKey(api_key) = auth_method.0.as_ref() else {
            return ApiResponse::error("API key authentication required")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        };

        ApiResponse::new_serialized(Response {
            user_permissions: api_key.user_permissions.as_ref().clone(),
            admin_permissions: api_key.admin_permissions.as_ref().clone(),
            server_permissions: api_key.server_permissions.as_ref().clone(),
            unrestricted_admin: api_key.unrestricted_admin,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
