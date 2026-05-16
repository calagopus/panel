use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use futures_util::StreamExt;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{admin_activity::GetAdminActivityLogger, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        names: Vec<compact_str::CompactString>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        deleted: usize,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("assets.delete")?;

        let mut futures = Vec::new();

        for name in &data.names {
            if name.contains("..") {
                continue;
            }

            futures.push(state.storage.remove(Some(format!("assets/{name}"))));
        }

        let mut results_stream = futures_util::stream::iter(futures).buffer_unordered(5);
        let mut deleted = 0;

        while let Some(result) = results_stream.next().await {
            if result.is_ok() {
                deleted += 1;
            }
        }

        activity_logger
            .log(
                "assets:delete",
                serde_json::json!({
                    "names": data.names,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response { deleted }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
