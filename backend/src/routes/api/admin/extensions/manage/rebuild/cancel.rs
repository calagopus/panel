use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::{extract::Query, http::StatusCode};
    use serde::{Deserialize, Serialize};
    use shared::{
        GetState,
        models::{admin_activity::GetAdminActivityLogger, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(Deserialize)]
    pub struct Params {
        build_id: Option<u64>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        build_id: u64,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
    ), params(
        (
            "build_id" = Option<u64>, Query,
            description = "The build to stop, defaulting to whatever is building",
            example = "3",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        if !state.container_type.is_heavy() {
            return ApiResponse::error(
                "extension management is only available in the official heavy container",
            )
            .with_status(StatusCode::NOT_IMPLEMENTED)
            .ok();
        }

        permissions.has_admin_permission("extensions.manage")?;

        match shared::heavy::ask(&shared::heavy::Request::Cancel {
            build_id: params.build_id,
        })
        .await
        {
            Ok(shared::heavy::Response::CancelAccepted { build_id }) => {
                activity_logger
                    .log(
                        "extension:rebuild.cancel",
                        serde_json::json!({
                            "build_id": build_id,
                        }),
                    )
                    .await;

                ApiResponse::new_serialized(Response { build_id }).ok()
            }
            Ok(shared::heavy::Response::CancelNotRunning) => {
                ApiResponse::error("that extension build is not running")
                    .with_status(StatusCode::CONFLICT)
                    .ok()
            }
            Ok(answer) => {
                tracing::error!(
                    "the extension supervisor answered a cancel request with {answer:?}"
                );

                ApiResponse::error("the extension supervisor gave an unexpected answer")
                    .with_status(StatusCode::INTERNAL_SERVER_ERROR)
                    .ok()
            }
            Err(err) => {
                tracing::error!("the extension supervisor could not be reached: {err}");

                ApiResponse::error("the extension supervisor could not be reached")
                    .with_status(StatusCode::SERVICE_UNAVAILABLE)
                    .ok()
            }
        }
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
