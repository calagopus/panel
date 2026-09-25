use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            admin_activity::GetAdminActivityLogger,
            node::{GetNode, NodeEnrollment},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(chars, min = 1, max = 32))]
        #[schema(min_length = 1, max_length = 32)]
        pairing_code: compact_str::CompactString,
        #[garde(length(chars, min = 3, max = 255), url)]
        #[schema(min_length = 3, max_length = 255, format = "uri")]
        remote: Option<compact_str::CompactString>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "node" = uuid::Uuid,
            description = "The node ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        node: GetNode,
        request_host: shared::GetRequestHost,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("nodes.reset-token")?;

        if node.is_all_in_one_node() && state.container_type.is_all_in_one() {
            return ApiResponse::error("the aio node is configured automatically")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let panel_url = match &data.remote {
            Some(remote) => remote.to_string(),
            None => {
                state
                    .settings
                    .get_as(|s| s.app.url_for_host(request_host.as_deref()).to_string())
                    .await?
            }
        };

        let (code, _) = NodeEnrollment::create(&state, &node, data.remote.as_deref()).await?;

        if let Err(err) =
            wings_api::setup::enroll(node.url.as_str(), &data.pairing_code, &panel_url, &code).await
        {
            return ApiResponse::error(err.to_string())
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        activity_logger
            .log(
                "node:pair",
                serde_json::json!({
                    "node_uuid": node.uuid,
                    "remote": data.remote,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
