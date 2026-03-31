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
            user::{GetPermissionManager, GetUser},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        #[serde(default)]
        #[schema(default = "/")]
        root: compact_str::CompactString,
        files: Vec<compact_str::CompactString>,

        destination: compact_str::CompactString,
        #[schema(example = "123e4567-e89b-12d3-a456-426614174000")]
        destination_server: String,

        #[serde(default)]
        foreground: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

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
        server: GetServer,
        user: GetUser,
        mut activity_logger: GetServerActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_server_permission("files.read")?;

        let destination_server =
            match Server::by_user_identifier(&state.database, &user, &data.destination_server)
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

        let permissions = permissions
            .0
            .set_user_server_owner(user.uuid == destination_server.uuid)
            .add_subuser_permissions(destination_server.subuser_permissions);

        permissions.has_server_permission("files.create")?;

        #[derive(Serialize)]
        struct FileTransferUploadJwt {
            #[serde(flatten)]
            base: BasePayload,

            server: uuid::Uuid,
            root: compact_str::CompactString,

            destination_path: compact_str::CompactString,
        }

        let destination_node = destination_server
            .node
            .fetch_cached(&state.database)
            .await?;

        let token = destination_node.create_jwt(
            &state.database,
            &state.jwt,
            &FileTransferUploadJwt {
                base: BasePayload {
                    issuer: "panel".into(),
                    subject: Some(destination_server.uuid.to_string()),
                    audience: Vec::new(),
                    expiration_time: Some(chrono::Utc::now().timestamp() + 600),
                    not_before: None,
                    issued_at: Some(chrono::Utc::now().timestamp()),
                    jwt_id: destination_server.node.uuid.to_string(),
                },
                server: server.uuid,
                root: data.root.clone(),
                destination_path: data.destination.clone(),
            },
        )?;

        let url = destination_node.url("/api/transfers/files");

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
            let response = match server
                .node
                .fetch_cached(&state.database)
                .await?
                .api_client(&state.database)
                .await?
                .post_servers_server_files_copy_remote(server.uuid, &request_body)
                .await
            {
                Ok(wings_api::servers_server_files_copy_remote::post::Response::Ok(_)) => {
                    ApiResponse::new_serialized(Response {}).ok()
                }
                Ok(wings_api::servers_server_files_copy_remote::post::Response::Accepted(data)) => {
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
                    "server:file.copy-remote",
                    serde_json::json!({
                        "directory": request_body.root,
                        "files": request_body.files.iter().collect::<Vec<_>>(),

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
                        "files": request_body.files.iter().collect::<Vec<_>>(),

                        "source_server": server.uuid,
                        "destination_path": request_body.destination_path,
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
