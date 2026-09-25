use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(chars, min = 3, max = 255), url)]
        #[schema(min_length = 3, max_length = 255, format = "uri")]
        url: compact_str::CompactString,
        #[garde(length(chars, min = 1, max = 32))]
        #[schema(min_length = 1, max_length = 32)]
        pairing_code: compact_str::CompactString,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        probe: wings_api::setup::SetupProbe,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
    ), request_body = inline(Payload))]
    pub async fn route(
        permissions: GetPermissionManager,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("nodes.create")?;

        match wings_api::setup::probe(&data.url, &data.pairing_code).await {
            Ok(probe) => ApiResponse::new_serialized(Response { probe }).ok(),
            Err(err) => ApiResponse::error(err.to_string())
                .with_status(StatusCode::BAD_REQUEST)
                .ok(),
        }
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
