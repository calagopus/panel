use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::StatusCode;
    use compact_str::ToCompactString;
    use futures_util::StreamExt;
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

    const MAX_DESTINATION_SERVERS: usize = 25;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        #[serde(default)]
        #[schema(default = "/")]
        root: compact_str::CompactString,
        #[schema(inline)]
        files: Vec<wings_api::CopyFile>,

        destination: compact_str::CompactString,
        #[schema(min_items = 1, max_items = 25)]
        destination_servers: Vec<uuid::Uuid>,

        #[serde(default)]
        overwrite: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct ResponseResult {
        server: uuid::Uuid,
        identifier: Option<uuid::Uuid>,
        error: Option<String>,
        skipped: Vec<wings_api::DirectoryEntry>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        results: Vec<ResponseResult>,
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

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = FORBIDDEN, body = ApiError),
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
        activity_logger: GetServerActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_server_permission("files.read-content")?;

        let mut destination_uuids: Vec<uuid::Uuid> = Vec::new();
        for uuid in data.destination_servers {
            if !destination_uuids.contains(&uuid) {
                destination_uuids.push(uuid);
            }
        }

        if destination_uuids.is_empty() {
            return ApiResponse::error("no destination servers provided")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        if destination_uuids.len() > MAX_DESTINATION_SERVERS {
            return ApiResponse::error(format!(
                "too many destination servers (maximum is {MAX_DESTINATION_SERVERS})"
            ))
            .with_status(StatusCode::EXPECTATION_FAILED)
            .ok();
        }

        if destination_uuids.contains(&server.uuid) {
            return ApiResponse::error("cannot remote copy files to the same server")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        if server.is_ignored_subtree(&data.root) {
            return ApiResponse::error("root directory not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        }

        for file in &data.files {
            if server.is_ignored_subtree(Path::new(&data.root).join(&file.from)) {
                return ApiResponse::error("file not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        }

        let mut destination_servers =
            Server::by_user_uuids(&state.database, &permissions, &destination_uuids).await?;

        if destination_servers.len() != destination_uuids.len() {
            return ApiResponse::error("destination server not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        }

        for destination_server in destination_servers.iter_mut() {
            if let Some(message) = destination_server.unavailable_reason() {
                return ApiResponse::error(format!("{}: {message}", destination_server.name))
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }

            if permissions
                .for_server(destination_server)
                .has_server_permission("files.create")
                .is_err()
            {
                return ApiResponse::error(format!(
                    "you do not have permission to create files on server {}",
                    destination_server.name
                ))
                .with_status(StatusCode::FORBIDDEN)
                .ok();
            }

            if destination_server.is_ignored_subtree(&data.destination) {
                return ApiResponse::error(format!(
                    "destination directory not found on server {}",
                    destination_server.name
                ))
                .with_status(StatusCode::NOT_FOUND)
                .ok();
            }

            for file in &data.files {
                if destination_server.is_ignored_either(Path::new(&data.destination).join(&file.to))
                {
                    return ApiResponse::error(format!(
                        "file not found on server {}",
                        destination_server.name
                    ))
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
                }
            }
        }

        let source_node = server.node.fetch_cached(&state.database).await?;

        let mut jobs = Vec::with_capacity(destination_servers.len());
        for destination_server in destination_servers {
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

            let same_node = source_node.uuid == destination_node.uuid;
            let request_body = wings_api::servers_server_files_copy_remote::post::RequestBody {
                url: if same_node {
                    "".to_compact_string()
                } else {
                    destination_node
                        .url("/api/transfers/files")
                        .to_compact_string()
                },
                token: format!("Bearer {token}").into(),
                archive_format: if same_node {
                    wings_api::TransferArchiveFormat::Tar
                } else {
                    wings_api::TransferArchiveFormat::TarGz
                },
                compression_level: None,
                root: data.root.clone(),
                files: data.files.clone(),
                destination_server: destination_server.uuid,
                destination_path: data.destination.clone(),
                foreground: false,
            };

            jobs.push((destination_server, request_body));
        }

        let extra = wings_api::servers_server_files_copy_remote::post::Extra {
            overwrite: data.overwrite,
            ..Default::default()
        };

        tokio::spawn(async move {
            let source_ignored = server.0.subuser_ignored_files.clone().unwrap_or_default();

            let copy_to = async |index: usize,
                                 destination_server: Server,
                                 request_body: wings_api::servers_server_files_copy_remote::post::RequestBody| {
                let api_client = match source_node.api_client(&state.database).await {
                    Ok(api_client) => api_client,
                    Err(err) => return Err(err),
                };

                let result = api_client
                    .ignoring(source_ignored.clone())
                    .ignoring_destination(
                        destination_server
                            .subuser_ignored_files
                            .clone()
                            .unwrap_or_default(),
                    )
                    .post_servers_server_files_copy_remote_with(server.0.uuid, &request_body, &extra)
                    .await;

                let result = match result {
                    Ok(wings_api::servers_server_files_copy_remote::post::Response::Ok(data)) => {
                        Ok((None, data.skipped))
                    }
                    Ok(wings_api::servers_server_files_copy_remote::post::Response::Accepted(
                        data,
                    )) => Ok((Some(data.identifier), data.skipped)),
                    Err(wings_api::client::ApiHttpError::Http(
                        StatusCode::NOT_FOUND | StatusCode::EXPECTATION_FAILED,
                        err,
                    )) => Err(err.error.to_string()),
                    Err(err) => {
                        tracing::error!(
                            server = %server.0.uuid,
                            destination_server = %destination_server.uuid,
                            "failed to start remote copy: {:#?}",
                            err
                        );

                        Err("failed to start the copy on the source node".to_string())
                    }
                };

                let copied_files = match &result {
                    Ok((_, skipped)) => request_body
                        .files
                        .iter()
                        .filter(|file| !skipped.iter().any(|entry| entry.name == file.to))
                        .collect::<Vec<_>>(),
                    Err(_) => Vec::new(),
                };

                if !copied_files.is_empty() {
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

                    let mut destination_activity_logger = activity_logger.clone();
                    destination_activity_logger.server_uuid = destination_server.uuid;
                    destination_activity_logger
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
                }

                Ok::<_, anyhow::Error>((index, destination_server.uuid, result))
            };

            let mut futures = Vec::with_capacity(jobs.len());
            for (index, (destination_server, request_body)) in jobs.into_iter().enumerate() {
                futures.push(copy_to(index, destination_server, request_body));
            }

            let mut results_stream = futures_util::stream::iter(futures).buffer_unordered(5);

            let mut results = Vec::new();
            while let Some(result) = results_stream.next().await {
                results.push(result?);
            }

            results.sort_by_key(|(index, _, _)| *index);

            ApiResponse::new_serialized(Response {
                results: results
                    .into_iter()
                    .map(|(_, server, result)| match result {
                        Ok((identifier, skipped)) => ResponseResult {
                            server,
                            identifier,
                            error: None,
                            skipped,
                        },
                        Err(error) => ResponseResult {
                            server,
                            identifier: None,
                            error: Some(error),
                            skipped: Vec::new(),
                        },
                    })
                    .collect(),
            })
            .ok()
        })
        .await?
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
