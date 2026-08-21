use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        cap::CapFilesystem,
        models::{
            server::{GetServer, GetServerActivityLogger},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use std::path::Path;
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        #[serde(default)]
        #[schema(default = "/")]
        root: compact_str::CompactString,

        link: compact_str::CompactString,
        target: compact_str::CompactString,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        mut server: GetServer,
        activity_logger: GetServerActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_server_permission("files.create")?;

        if server.is_ignored(&data.root, true) {
            return ApiResponse::error("root directory not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        }

        let link =
            CapFilesystem::resolve_path(&Path::new(data.root.as_str()).join(data.link.as_str()));
        if server.is_ignored(&link, false) {
            return ApiResponse::error("destination not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        }

        let target = Path::new(data.target.as_str());
        let target = match target.strip_prefix("/") {
            Ok(target) => CapFilesystem::resolve_path(&Path::new("/").join(target)),
            Err(_) => {
                CapFilesystem::resolve_path(&link.parent().unwrap_or(Path::new("/")).join(target))
            }
        };
        if server.is_ignored(&target, false) {
            return ApiResponse::error("target not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        }

        let request_body = wings_api::servers_server_files_create_symlink::post::RequestBody {
            root: data.root,
            link: data.link,
            target: data.target,
        };

        match server
            .node
            .fetch_cached(&state.database)
            .await?
            .api_client(&state.database)
            .await?
            .post_servers_server_files_create_symlink(server.uuid, &request_body)
            .await
        {
            Ok(_) => {}
            Err(wings_api::client::ApiHttpError::Http(StatusCode::NOT_FOUND, err)) => {
                return ApiResponse::new_serialized(ApiError::new_wings_value(err))
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
            Err(wings_api::client::ApiHttpError::Http(StatusCode::EXPECTATION_FAILED, err)) => {
                return ApiResponse::new_serialized(ApiError::new_wings_value(err))
                    .with_status(StatusCode::EXPECTATION_FAILED)
                    .ok();
            }
            Err(err) => return Err(err.into()),
        };

        activity_logger
            .log(
                "server:file.create-symlink",
                serde_json::json!({
                    "directory": request_body.root,
                    "link": request_body.link,
                    "target": request_body.target,
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
