use super::State;
use axum::{
    extract::{Path, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{
    GetState,
    models::{node::GetNode, server_backup::ServerBackup},
    response::ApiResponse,
};
use utoipa_axum::{router::OpenApiRouter, routes};

mod restic;
mod restore;

pub type GetBackup = shared::extract::ConsumingExtension<ServerBackup>;

pub async fn auth(
    state: GetState,
    node: GetNode,
    Path(backup): Path<uuid::Uuid>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let backup = ServerBackup::by_node_uuid_uuid(&state.database, node.uuid, backup).await;
    let backup = match backup {
        Ok(Some(backup)) => backup,
        Ok(None) => {
            return Ok(ApiResponse::error("backup not found")
                .with_status(StatusCode::NOT_FOUND)
                .into_response());
        }
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    req.extensions_mut().insert(backup);
    req.extensions_mut().insert(node.0);

    Ok(next.run(req).await)
}

mod get {
    use crate::routes::api::remote::backups::_backup_::GetBackup;
    use axum::{extract::Query, http::StatusCode};
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            ByUuid,
            node::GetNode,
            server::Server,
            server_backup::{BackupDisk, ServerBackup},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use std::collections::HashMap;
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Params {
        size: u64,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        parts: Vec<String>,
        part_size: u64,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "backup" = uuid::Uuid,
            description = "The backup ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "size" = u64, Query,
            description = "The size of the backup in bytes",
            example = "1",
        ),
    ))]
    pub async fn route(
        state: GetState,
        node: GetNode,
        backup: GetBackup,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        if backup.disk != BackupDisk::S3 {
            return ApiResponse::error("backup is not stored on S3")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        if backup.upload_id.is_some() {
            return ApiResponse::error("backup is already being uploaded")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let backup_configuration = match backup.0.backup_configuration {
            Some(backup_configuration) => {
                backup_configuration.fetch_cached(&state.database).await?
            }
            None => {
                return ApiResponse::error("backup does not have a backup configuration assigned")
                    .with_status(StatusCode::EXPECTATION_FAILED)
                    .ok();
            }
        };

        let mut s3_configuration = match backup_configuration.backup_configs.s3 {
            Some(config) => config,
            None => {
                return ApiResponse::error("S3 configuration not found")
                    .with_status(StatusCode::EXPECTATION_FAILED)
                    .ok();
            }
        };
        s3_configuration.decrypt(&state.database).await?;

        let server = match Server::by_uuid_optional(
            &state.database,
            match backup.0.server {
                Some(server) => server.uuid,
                None => {
                    return ApiResponse::error("server uuid not found")
                        .with_status(StatusCode::EXPECTATION_FAILED)
                        .ok();
                }
            },
        )
        .await?
        {
            Some(server) => server,
            None => {
                return ApiResponse::error("server not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        };

        let part_size = s3_configuration.part_size;
        let part_count = (params.size as f64 / s3_configuration.part_size as f64).ceil() as usize;
        if part_count > 10_000_000 {
            return ApiResponse::error("backup is too large")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let mut parts = Vec::new();
        parts.reserve_exact(part_count);

        let client = match s3_configuration.into_client() {
            Ok(client) => client,
            Err(err) => {
                tracing::error!(
                    backup = %backup.0.uuid,
                    location = %node.0.location.name,
                    "failed to create S3 client: {:#?}",
                    err
                );

                return ApiResponse::error("failed to create S3 client")
                    .with_status(StatusCode::EXPECTATION_FAILED)
                    .ok();
            }
        };

        let file_path = ServerBackup::s3_path(server.uuid, backup.0.uuid);
        let content_type = ServerBackup::s3_content_type(&file_path);

        let multipart = match client
            .initiate_multipart_upload(&file_path, content_type)
            .await
        {
            Ok(multipart) => multipart,
            Err(err) => {
                tracing::error!(
                    backup = %backup.0.uuid,
                    location = %node.0.location.name,
                    "failed to initiate multipart upload: {:#?}",
                    err
                );

                return ApiResponse::error("failed to initiate multipart upload")
                    .with_status(StatusCode::EXPECTATION_FAILED)
                    .ok();
            }
        };

        for i in 0..part_count {
            let url = client
                .presign_put(
                    &file_path,
                    60 * 60 * 24,
                    None,
                    Some(HashMap::from([
                        ("partNumber".to_string(), (i + 1).to_string()),
                        ("uploadId".to_string(), multipart.upload_id.clone()),
                    ])),
                )
                .await?;

            parts.push(url);
        }

        sqlx::query!(
            "UPDATE server_backups
            SET upload_id = $1, upload_path = $2
            WHERE server_backups.uuid = $3",
            multipart.upload_id,
            &file_path,
            backup.0.uuid
        )
        .execute(state.database.write())
        .await?;

        ApiResponse::new_serialized(Response { parts, part_size }).ok()
    }
}

mod post {
    use crate::routes::api::remote::backups::_backup_::GetBackup;
    use axum::http::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            ByUuid, CreatableModel, EventEmittingModel,
            node::GetNode,
            server::Server,
            server_activity::ServerActivity,
            server_backup::{BackupDisk, ServerBackup, ServerBackupEvent},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(Debug, ToSchema, Deserialize)]
    pub struct PayloadPart {
        pub etag: String,
        pub part_number: u32,
    }

    #[derive(Debug, ToSchema, Deserialize)]
    pub struct Payload {
        pub checksum: String,
        pub checksum_type: String,
        pub size: u64,
        pub files: u64,
        pub successful: bool,
        pub browsable: bool,
        pub streaming: bool,
        #[schema(inline)]
        pub parts: Vec<PayloadPart>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "backup" = uuid::Uuid,
            description = "The backup ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        node: GetNode,
        backup: GetBackup,
        axum::Json(mut data): axum::Json<Payload>,
    ) -> ApiResponseResult {
        if backup.disk == BackupDisk::S3 {
            let upload_id = match &backup.upload_id {
                Some(id) => id,
                None => {
                    return ApiResponse::error("upload ID not found")
                        .with_status(StatusCode::EXPECTATION_FAILED)
                        .ok();
                }
            };

            let mut backup_configuration = match &backup.backup_configuration {
                Some(backup_configuration) => {
                    backup_configuration.fetch_cached(&state.database).await?
                }
                None => {
                    return ApiResponse::error(
                        "backup does not have a backup configuration assigned",
                    )
                    .with_status(StatusCode::EXPECTATION_FAILED)
                    .ok();
                }
            };

            let mut s3_configuration = match backup_configuration.backup_configs.s3.take() {
                Some(config) => config,
                None => {
                    return ApiResponse::error("S3 configuration not found")
                        .with_status(StatusCode::EXPECTATION_FAILED)
                        .ok();
                }
            };
            s3_configuration.decrypt(&state.database).await?;

            let server = match Server::by_uuid_optional(
                &state.database,
                match &backup.server {
                    Some(server) => server.uuid,
                    None => {
                        return ApiResponse::error("server uuid not found")
                            .with_status(StatusCode::EXPECTATION_FAILED)
                            .ok();
                    }
                },
            )
            .await?
            {
                Some(server) => server,
                None => {
                    return ApiResponse::error("server not found")
                        .with_status(StatusCode::NOT_FOUND)
                        .ok();
                }
            };

            let client = match s3_configuration.into_client() {
                Ok(client) => client,
                Err(err) => {
                    tracing::error!(
                        backup = %backup.uuid,
                        location = %node.location.name,
                        "failed to create S3 client: {:#?}",
                        err
                    );

                    return ApiResponse::error("failed to create S3 client")
                        .with_status(StatusCode::EXPECTATION_FAILED)
                        .ok();
                }
            };

            let file_path = ServerBackup::s3_path(server.uuid, backup.uuid);

            if data.successful {
                match client
                    .complete_multipart_upload(
                        &file_path,
                        upload_id,
                        data.parts
                            .into_iter()
                            .map(|p| s3::serde_types::Part {
                                part_number: p.part_number,
                                etag: p.etag,
                            })
                            .collect(),
                    )
                    .await
                {
                    Ok(_) => {
                        tracing::info!(
                            backup = %backup.uuid,
                            location = %node.location.name,
                            "completed multipart upload for backup"
                        );
                    }
                    Err(err) => {
                        tracing::error!(
                            backup = %backup.uuid,
                            location = %node.location.name,
                            "failed to complete multipart upload: {:#?}",
                            err
                        );

                        data.successful = false;
                    }
                }
            } else {
                match client.abort_upload(&file_path, upload_id).await {
                    Ok(_) => {
                        tracing::info!(
                            backup = %backup.uuid,
                            location = %node.location.name,
                            "aborted multipart upload for backup"
                        );
                    }
                    Err(err) => {
                        tracing::error!(
                            backup = %backup.uuid,
                            location = %node.location.name,
                            "failed to abort multipart upload: {:#?}",
                            err
                        );
                    }
                }
            }
        }

        if data.successful {
            sqlx::query!(
                "UPDATE server_backups
                SET checksum = $2, bytes = $3, files = $4, successful = true, browsable = $5, streaming = $6, completed = NOW()
                WHERE server_backups.uuid = $1",
                backup.uuid,
                format!("{}:{}", data.checksum_type, data.checksum),
                data.size as i64,
                data.files as i64,
                data.browsable,
                data.streaming
            )
            .execute(state.database.write())
            .await?;
        } else {
            sqlx::query!(
                "UPDATE server_backups
                SET successful = false, completed = NOW()
                WHERE server_backups.uuid = $1",
                backup.uuid
            )
            .execute(state.database.write())
            .await?;
        }

        if let Some(server) = &backup.server
            && let Err(err) = ServerActivity::create(
                &state,
                shared::models::server_activity::CreateServerActivityOptions {
                    server_uuid: server.uuid,
                    user_uuid: None,
                    impersonator_uuid: None,
                    api_key_uuid: None,
                    schedule_uuid: None,
                    event: if data.successful {
                        "server:backup.complete"
                    } else {
                        "server:backup.fail"
                    }
                    .into(),
                    ip: None,
                    data: serde_json::json!({
                        "uuid": backup.uuid,
                        "name": backup.name,
                    }),
                    created: None,
                },
            )
            .await
        {
            tracing::warn!(
                backup = %backup.uuid,
                "failed to log server activity: {:#?}",
                err
            );
        }

        ServerBackup::get_event_emitter().emit(
            state.0.clone(),
            ServerBackupEvent::CreationCompleted {
                backup: Box::new(backup.0),
                successful: data.successful,
            },
        );

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/restic", restic::router(state))
        .nest("/restore", restore::router(state))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
