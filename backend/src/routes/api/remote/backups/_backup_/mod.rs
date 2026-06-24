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

mod kopia;
mod pbs;
mod restic;
mod restore;
mod s3;

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

mod post {
    use crate::routes::api::remote::backups::_backup_::GetBackup;
    use aws_sdk_s3::types::{CompletedMultipartUpload, CompletedPart};
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

            let compression_type = s3_configuration.compression_type;
            let (client, bucket) = s3_configuration.into_client();

            let file_path = ServerBackup::s3_path(server.uuid, backup.uuid, compression_type);

            if data.successful {
                let completed_parts: Vec<CompletedPart> = data
                    .parts
                    .into_iter()
                    .map(|p| {
                        CompletedPart::builder()
                            .part_number(p.part_number as i32)
                            .e_tag(p.etag)
                            .build()
                    })
                    .collect();

                let completed_upload = CompletedMultipartUpload::builder()
                    .set_parts(Some(completed_parts))
                    .build();

                match client
                    .complete_multipart_upload()
                    .bucket(bucket.as_str())
                    .key(file_path)
                    .upload_id(&**upload_id)
                    .multipart_upload(completed_upload)
                    .send()
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
                match client
                    .abort_multipart_upload()
                    .bucket(bucket.as_str())
                    .key(file_path)
                    .upload_id(&**upload_id)
                    .send()
                    .await
                {
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
        .routes(routes!(post::route))
        .nest("/s3", s3::router(state))
        .nest("/pbs", pbs::router(state))
        .nest("/restic", restic::router(state))
        .nest("/kopia", kopia::router(state))
        .nest("/restore", restore::router(state))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
