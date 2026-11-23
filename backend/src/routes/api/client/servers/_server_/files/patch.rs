use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            server::{GetServer, GetServerActivityLogger},
            user::{GetPermissionManager, GetUser},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use std::path::Path;
    use utoipa::ToSchema;

    fn strip_default() -> u64 {
        1
    }

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        #[serde(default)]
        #[schema(default = "/")]
        root: compact_str::CompactString,
        format: wings_api::PatchFormat,
        source: wings_api::Source,
        file: Option<compact_str::CompactString>,
        #[serde(default = "strip_default")]
        #[schema(default = 1)]
        strip: u64,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        patched: u64,
    }

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
        user: GetUser,
        mut server: GetServer,
        activity_logger: GetServerActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_server_permission("files.update")?;
        if matches!(data.format, wings_api::PatchFormat::Git) {
            permissions.has_server_permission("files.create")?;
            permissions.has_server_permission("files.delete")?;
        }
        if matches!(data.source, wings_api::Source::File { .. }) {
            permissions.has_server_permission("files.read-content")?;
        }

        if server.is_ignored_subtree(&data.root) {
            return ApiResponse::error("root directory not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        }

        if let wings_api::Source::File { path } = &data.source
            && server.is_ignored(Path::new(data.root.as_str()).join(path.as_str()), false)
        {
            return ApiResponse::error("patch file not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        }

        if let Some(file) = &data.file
            && server.is_ignored(Path::new(data.root.as_str()).join(file.as_str()), false)
        {
            return ApiResponse::error("file not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        }

        let patch = match &data.source {
            wings_api::Source::File { path } => Some(path.clone()),
            wings_api::Source::Inline { .. } => None,
        };
        let request_body = wings_api::servers_server_files_patch::post::RequestBody {
            root: data.root,
            format: data.format,
            source: data.source,
            file: data.file,
            strip: data.strip,
            user: Some(user.uuid),
        };

        tokio::spawn(async move {
            let patched = match server
                .0
                .node
                .fetch_cached(&state.database)
                .await?
                .api_client(&state.database)
                .await?
                .ignoring(server.0.subuser_ignored_files.unwrap_or_default())
                .post_servers_server_files_patch(server.0.uuid, &request_body)
                .await
            {
                Ok(data) => data.patched,
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
                    "server:file.patch",
                    serde_json::json!({
                        "directory": request_body.root,
                        "patch": patch,
                        "file": request_body.file,
                    }),
                )
                .await;

            ApiResponse::new_serialized(Response { patched }).ok()
        })
        .await?
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
