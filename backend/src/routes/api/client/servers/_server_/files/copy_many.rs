use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
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

        #[schema(inline)]
        files: Vec<wings_api::servers_server_files_copy_many::post::RequestBodyFiles>,

        #[serde(default)]
        foreground: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        copied: u64,
    }

    #[derive(ToSchema, Serialize)]
    struct ResponseAccepted {
        identifier: uuid::Uuid,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = ACCEPTED, body = inline(ResponseAccepted)),
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

        let request_body = wings_api::servers_server_files_copy_many::post::RequestBody {
            files: data
                .files
                .into_iter()
                .filter(|f| {
                    !server.is_ignored(Path::new(&data.root).join(&f.from), false)
                        && !server.is_ignored(Path::new(&data.root).join(&f.to), false)
                })
                .collect(),
            root: data.root,
            foreground: data.foreground,
        };

        tokio::spawn(async move {
            let response = match server
                .node
                .fetch_cached(&state.database)
                .await?
                .api_client(&state.database)
                .await?
                .post_servers_server_files_copy_many(server.uuid, &request_body)
                .await
            {
                Ok(wings_api::servers_server_files_copy_many::post::Response::Ok(data)) => {
                    ApiResponse::new_serialized(Response {
                        copied: data.copied,
                    })
                    .ok()
                }
                Ok(wings_api::servers_server_files_copy_many::post::Response::Accepted(data)) => {
                    ApiResponse::new_serialized(ResponseAccepted {
                        identifier: data.identifier,
                    })
                    .with_status(StatusCode::ACCEPTED)
                    .ok()
                }
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
                    "server:file.copy-many",
                    serde_json::json!({
                        "directory": request_body.root,
                        "files": request_body.files,
                    }),
                )
                .await;

            response
        })
        .await?
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
