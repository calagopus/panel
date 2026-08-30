use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod put {
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
        files: Vec<wings_api::servers_server_files_rename::put::RequestBodyFiles>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        renamed: u64,
    }

    #[utoipa::path(put, path = "/", responses(
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
        permissions.has_server_permission("files.update")?;

        let request_body = wings_api::servers_server_files_rename::put::RequestBody {
            files: data
                .files
                .into_iter()
                .filter(|f| {
                    !server.is_ignored_either(Path::new(&data.root).join(&f.from))
                        && !server.is_ignored_either(Path::new(&data.root).join(&f.to))
                })
                .collect(),
            root: data.root,
            ignored: server.0.subuser_ignored_files.unwrap_or_default(),
            create_directories: permissions.has_server_permission("files.create").is_ok(),
        };

        let data = match server
            .0
            .node
            .fetch_cached(&state.database)
            .await?
            .api_client(&state.database)
            .await?
            .put_servers_server_files_rename(server.0.uuid, &request_body)
            .await
        {
            Ok(data) => data,
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
                "server:file.rename",
                serde_json::json!({
                    "directory": request_body.root,
                    "files": request_body.files,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            renamed: data.renamed,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(put::route))
        .with_state(state.clone())
}
