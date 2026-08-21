use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod cancel;

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
        #[serde(default)]
        force: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        build_id: u64,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
    ), params(
        (
            "force" = bool, Query,
            description = "Whether to build even when the current extension set has already been built or has already failed",
            example = "true",
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

        match shared::heavy::ask(&shared::heavy::Request::RequestRebuild {
            force: params.force,
        })
        .await
        {
            Ok(shared::heavy::Response::RebuildAccepted { build_id }) => {
                activity_logger
                    .log(
                        "extension:rebuild",
                        serde_json::json!({
                            "build_id": build_id,
                            "force": params.force,
                        }),
                    )
                    .await;

                ApiResponse::new_serialized(Response { build_id }).ok()
            }
            Ok(shared::heavy::Response::RebuildAlreadyRunning { build_id }) => {
                ApiResponse::error(format!("extension build {build_id} is already in progress"))
                    .with_status(StatusCode::CONFLICT)
                    .ok()
            }
            Ok(answer) => {
                tracing::error!(
                    "the extension supervisor answered a rebuild request with {answer:?}"
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
        .nest("/cancel", cancel::router(state))
        .with_state(state.clone())
}
