use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            ByUuid, backup_configuration::BackupConfigs, node::Node, server_backup::BackupDisk,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use std::time::Duration;
    use utoipa::ToSchema;

    const TEST_TIMEOUT: Duration = Duration::from_secs(70);

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(skip)]
        node_uuid: uuid::Uuid,
        #[garde(skip)]
        backup_disk: BackupDisk,
        #[garde(dive)]
        backup_configs: BackupConfigs,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        successful: bool,
        duration_ms: u64,
        error: Option<compact_str::CompactString>,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
        (status = NOT_IMPLEMENTED, body = ApiError),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        if permissions
            .has_admin_permission("backup-configurations.create")
            .is_err()
        {
            permissions.has_admin_permission("backup-configurations.update")?;
        }

        let node = match Node::by_uuid_optional_cached(&state.database, data.node_uuid).await? {
            Some(node) => node,
            None => {
                return ApiResponse::error("node not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        };

        let mut s3_probe = None;
        let target = match data.backup_disk {
            BackupDisk::Local => wings_api::BackupTestTarget::Wings,
            BackupDisk::DdupBak => wings_api::BackupTestTarget::DdupBak,
            BackupDisk::Btrfs => wings_api::BackupTestTarget::Btrfs,
            BackupDisk::Zfs => wings_api::BackupTestTarget::Zfs,
            BackupDisk::Restic => wings_api::BackupTestTarget::Restic {
                configuration: data
                    .backup_configs
                    .restic
                    .map(|restic| restic.into_wings_configuration()),
            },
            BackupDisk::S3 => {
                let Some(s3) = data.backup_configs.s3 else {
                    return ApiResponse::error("s3 configuration is required")
                        .with_status(StatusCode::BAD_REQUEST)
                        .ok();
                };

                let (client, bucket) = s3.into_client();
                let key = format!(".calagopus-test/{}", uuid::Uuid::new_v4());

                let presigned = match client
                    .put_object()
                    .bucket(&*bucket)
                    .key(&key)
                    .presigned(aws_sdk_s3::presigning::PresigningConfig::expires_in(
                        Duration::from_mins(5),
                    )?)
                    .await
                {
                    Ok(presigned) => presigned,
                    Err(err) => {
                        return ApiResponse::new_serialized(Response {
                            successful: false,
                            duration_ms: 0,
                            error: Some(compact_str::format_compact!(
                                "failed to presign the s3 test upload: {}",
                                aws_sdk_s3::error::DisplayErrorContext(err)
                            )),
                        })
                        .ok();
                    }
                };
                let upload_url = presigned.uri().into();

                s3_probe = Some((client, bucket, key));

                wings_api::BackupTestTarget::S3 {
                    configuration: wings_api::S3TestConfiguration { upload_url },
                }
            }
            BackupDisk::ProxmoxBackupServer => {
                let Some(pbs) = data.backup_configs.pbs else {
                    return ApiResponse::error("proxmox backup server configuration is required")
                        .with_status(StatusCode::BAD_REQUEST)
                        .ok();
                };

                wings_api::BackupTestTarget::ProxmoxBackupServer {
                    configuration: wings_api::PbsRepositoryConfiguration {
                        url: pbs.url,
                        datastore: pbs.datastore,
                        namespace: pbs.namespace,
                        token_id: pbs.token_id,
                        token_secret: pbs.token_secret,
                        fingerprint: pbs.fingerprint,
                    },
                }
            }
            BackupDisk::Kopia => {
                let Some(kopia) = data.backup_configs.kopia else {
                    return ApiResponse::error("kopia configuration is required")
                        .with_status(StatusCode::BAD_REQUEST)
                        .ok();
                };

                wings_api::BackupTestTarget::Kopia {
                    configuration: wings_api::KopiaBackupConfiguration {
                        url: kopia.url,
                        username: kopia.username,
                        password: kopia.password,
                        fingerprint: kopia.fingerprint,
                        tags: kopia.tags,
                    },
                }
            }
        };

        let client = node.api_client(&state.database).await?;
        let mut result = match tokio::time::timeout(
            TEST_TIMEOUT,
            client.post_system_backups_test(&target),
        )
        .await
        {
            Ok(Ok(result)) => result,
            Ok(Err(wings_api::client::ApiHttpError::Http(StatusCode::NOT_FOUND, _))) => {
                return ApiResponse::error("this node does not support backup tests")
                    .with_status(StatusCode::NOT_IMPLEMENTED)
                    .ok();
            }
            Ok(Err(err)) => return Err(err.into()),
            Err(_) => {
                return ApiResponse::error("node did not answer the backup test in time")
                    .with_status(StatusCode::EXPECTATION_FAILED)
                    .ok();
            }
        };

        if let Some((client, bucket, key)) = s3_probe {
            let deleted = client
                .delete_object()
                .bucket(&*bucket)
                .key(&key)
                .send()
                .await;

            if let Err(err) = deleted
                && result.successful
            {
                result.successful = false;
                result.error = Some(compact_str::format_compact!(
                    "the node uploaded the test object, but the panel could not delete it: {}",
                    aws_sdk_s3::error::DisplayErrorContext(err)
                ));
            }
        }

        ApiResponse::new_serialized(Response {
            successful: result.successful,
            duration_ms: result.duration_ms,
            error: result.error,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
