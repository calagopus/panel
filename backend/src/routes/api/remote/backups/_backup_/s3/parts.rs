use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use crate::routes::api::remote::backups::_backup_::GetBackup;
    use aws_sdk_s3::presigning::PresigningConfig;
    use axum::{extract::Query, http::StatusCode};
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            node::GetNode,
            server_backup::{BackupDisk, ServerBackup},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use std::time::Duration;
    use utoipa::ToSchema;

    const MAX_PARTS: u16 = 10000;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Params {
        #[garde(range(min = 1, max = MAX_PARTS))]
        #[schema(minimum = 1, maximum = 10000)]
        from_part: u16,
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
            "from_part" = u16, Query,
            description = "The part number to start from when generating presigned urls",
            example = "1",
        ),
    ))]
    pub async fn route(
        state: GetState,
        node: GetNode,
        backup: GetBackup,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        if backup.disk != BackupDisk::S3 {
            return ApiResponse::error("backup is not stored on S3")
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

        let server_uuid = match &backup.0.server {
            Some(server) => server.uuid,
            None => {
                return ApiResponse::error("server uuid not found")
                    .with_status(StatusCode::EXPECTATION_FAILED)
                    .ok();
            }
        };

        let part_size = s3_configuration.part_size;
        let part_count = MAX_PARTS.saturating_sub(params.from_part).min(50);

        if part_count == 0 {
            return ApiResponse::error("no more parts can be uploaded")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let mut parts = Vec::new();
        parts.reserve_exact(part_count as usize);

        let compression_type = s3_configuration.compression_type;
        let (client, bucket) = s3_configuration.into_client();

        let (file_path, upload_id) = match (backup.0.upload_path, backup.0.upload_id) {
            (Some(upload_path), Some(upload_id)) => (upload_path, upload_id),
            _ => {
                let file_path = ServerBackup::s3_path(server_uuid, backup.0.uuid, compression_type);
                let content_type = ServerBackup::s3_content_type(&file_path);

                let multipart = match client
                    .create_multipart_upload()
                    .bucket(&*bucket)
                    .key(&*file_path)
                    .content_type(content_type)
                    .send()
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

                let upload_id = match multipart.upload_id() {
                    Some(upload_id) => upload_id,
                    None => {
                        tracing::error!(
                            backup = %backup.0.uuid,
                            location = %node.0.location.name,
                            "S3 did not return an upload_id"
                        );

                        return ApiResponse::error("failed to initiate multipart upload")
                            .with_status(StatusCode::EXPECTATION_FAILED)
                            .ok();
                    }
                };

                sqlx::query!(
                    "UPDATE server_backups
                    SET upload_id = $1, upload_path = $2
                    WHERE server_backups.uuid = $3",
                    upload_id,
                    &file_path,
                    backup.0.uuid
                )
                .execute(state.database.write())
                .await?;

                (file_path, upload_id.into())
            }
        };

        let presigning_config = PresigningConfig::expires_in(Duration::from_hours(24))?;

        for i in 0..part_count {
            let presigned = client
                .upload_part()
                .bucket(&*bucket)
                .key(&*file_path)
                .upload_id(&*upload_id)
                .part_number((params.from_part + i) as i32)
                .presigned(presigning_config.clone())
                .await?;

            parts.push(presigned.uri().to_string());
        }

        ApiResponse::new_serialized(Response { parts, part_size }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
