use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::StatusCode;
    use compact_str::ToCompactString;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        jwt::BasePayload,
        models::{
            server::{GetServer, GetServerActivityLogger, Server},
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
        files: Vec<wings_api::CopyFile>,

        destination: compact_str::CompactString,
        #[schema(example = "123e4567-e89b-12d3-a456-426614174000")]
        destination_server: String,

        #[serde(default)]
        foreground: bool,
        #[serde(default)]
        overwrite: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        skipped: Vec<wings_api::DirectoryEntry>,
    }

    #[derive(ToSchema, Serialize)]
    struct ResponseAccepted {
        identifier: uuid::Uuid,
        skipped: Vec<wings_api::DirectoryEntry>,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = ACCEPTED, body = inline(ResponseAccepted)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
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
        mut activity_logger: GetServerActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_server_permission("files.read-content")?;

        let mut destination_server = match Server::by_user_identifier(
            &state.database,
            &permissions,
            &data.destination_server,
        )
        .await?
        {
            Some(server) => server,
            None => {
                return ApiResponse::error("destination server not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        };

        if server.uuid == destination_server.uuid {
            return ApiResponse::error("cannot remote copy files to the same server")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        if let Some(message) = destination_server.unavailable_reason() {
            return ApiResponse::error(message)
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        let permissions = permissions.for_server(&destination_server);

        permissions.has_server_permission("files.create")?;

        if server.is_ignored_subtree(&data.root) {
            return ApiResponse::error("root directory not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        }

        if destination_server.is_ignored_subtree(&data.destination) {
            return ApiResponse::error("destination directory not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        }

        for file in &data.files {
            if server.is_ignored_subtree(Path::new(&data.root).join(&file.from))
                || destination_server.is_ignored_either(Path::new(&data.destination).join(&file.to))
            {
                return ApiResponse::error("file not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        }

        #[derive(Serialize)]
        struct FileTransferUploadJwt<'a> {
            #[serde(flatten)]
            base: BasePayload,

            server: uuid::Uuid,
            root: compact_str::CompactString,

            destination_path: compact_str::CompactString,

            ignored_files: &'a [compact_str::CompactString],
        }

        let destination_node = destination_server
            .node
            .fetch_cached(&state.database)
            .await?;

        let token = destination_node
            .create_jwt(
                &state.database,
                &state.jwt,
                &FileTransferUploadJwt {
                    base: BasePayload {
                        scope: "transfer".into(),
                        issuer: "panel".into(),
                        subject: Some(destination_server.uuid.to_compact_string()),
                        audience: Vec::new(),
                        expiration_time: Some(chrono::Utc::now().timestamp() + 600),
                        not_before: None,
                        issued_at: Some(chrono::Utc::now().timestamp()),
                        jwt_id: destination_server.node.uuid.to_compact_string(),
                    },
                    server: server.uuid,
                    root: data.root.clone(),
                    destination_path: data.destination.clone(),
                    ignored_files: destination_server
                        .subuser_ignored_files
                        .as_deref()
                        .unwrap_or(&[]),
                },
            )
            .await?;

        let url = destination_node.url("/api/transfers/files");

        let extra = wings_api::servers_server_files_copy_remote::post::Extra {
            overwrite: data.overwrite,
            ..Default::default()
        };
        let request_body = wings_api::servers_server_files_copy_remote::post::RequestBody {
            url: if server.node.uuid == destination_node.uuid {
                "".to_compact_string()
            } else {
                url.to_compact_string()
            },
            token: format!("Bearer {token}").into(),
            archive_format: if server.node.uuid == destination_node.uuid {
                wings_api::TransferArchiveFormat::Tar
            } else {
                wings_api::TransferArchiveFormat::TarGz
            },
            compression_level: None,
            root: data.root,
            files: data.files,
            destination_server: destination_server.uuid,
            destination_path: data.destination,
            foreground: data.foreground,
        };

        tokio::spawn(async move {
            let (identifier, skipped) = match server
                .0
                .node
                .fetch_cached(&state.database)
                .await?
                .api_client(&state.database)
                .await?
                .ignoring(server.0.subuser_ignored_files.unwrap_or_default())
                .ignoring_destination(destination_server.subuser_ignored_files.unwrap_or_default())
                .post_servers_server_files_copy_remote_with(server.0.uuid, &request_body, &extra)
                .await
            {
                Ok(wings_api::servers_server_files_copy_remote::post::Response::Ok(data)) => {
                    (None, data.skipped)
                }
                Ok(wings_api::servers_server_files_copy_remote::post::Response::Accepted(data)) => {
                    (Some(data.identifier), data.skipped)
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

            let copied_files = request_body
                .files
                .iter()
                .filter(|file| !skipped.iter().any(|entry| entry.name == file.to))
                .collect::<Vec<_>>();
            if copied_files.is_empty() {
                return ApiResponse::new_serialized(Response { skipped }).ok();
            }

            activity_logger
                .log(
                    "server:file.copy-remote",
                    serde_json::json!({
                        "directory": request_body.root,
                        "files": copied_files,

                        "destination_server": destination_server.uuid,
                        "destination_path": request_body.destination_path,
                    }),
                )
                .await;

            activity_logger.server_uuid = destination_server.uuid;
            activity_logger
                .log(
                    "server:file.copy-remote",
                    serde_json::json!({
                        "directory": request_body.root,
                        "files": copied_files,

                        "source_server": server.0.uuid,
                        "destination_path": request_body.destination_path,
                    }),
                )
                .await;

            match identifier {
                Some(identifier) => ApiResponse::new_serialized(ResponseAccepted {
                    identifier,
                    skipped,
                })
                .with_status(StatusCode::ACCEPTED)
                .ok(),
                None => ApiResponse::new_serialized(Response { skipped }).ok(),
            }
        })
        .await?
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
