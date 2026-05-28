use crate::settings::SettingsReadGuard;
use aws_sdk_s3::{
    Client as S3Client,
    config::{Config as S3Config, Credentials, Region, retry::RetryConfig, timeout::TimeoutConfig},
    primitives::ByteStream,
    types::{CompletedMultipartUpload, CompletedPart},
};
use compact_str::ToCompactString;
use serde::{Deserialize, Serialize};
use std::{path::Path, sync::Arc};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio_util::bytes::{Bytes, BytesMut};
use utoipa::ToSchema;

#[derive(ToSchema, Deserialize, Serialize)]
pub struct StorageAsset {
    pub name: compact_str::CompactString,
    pub url: String,
    pub size: u64,
    pub is_directory: bool,
    pub created: chrono::DateTime<chrono::Utc>,
}

fn get_s3_client(
    access_key: &str,
    secret_key: &str,
    region: &str,
    endpoint: &str,
    path_style: bool,
) -> Result<S3Client, anyhow::Error> {
    let credentials = Credentials::new(access_key, secret_key, None, None, "calagopus-static");

    let timeout_config = TimeoutConfig::builder()
        .connect_timeout(std::time::Duration::from_secs(10))
        .build();

    let config = S3Config::builder()
        .behavior_version(aws_sdk_s3::config::BehaviorVersion::latest())
        .credentials_provider(credentials)
        .region(Region::new(region.to_string()))
        .endpoint_url(endpoint)
        .force_path_style(path_style)
        .timeout_config(timeout_config)
        .retry_config(RetryConfig::standard())
        .build();

    Ok(S3Client::from_conf(config))
}

pub struct StorageUrlRetriever<'a> {
    settings: SettingsReadGuard<'a>,
}

impl<'a> StorageUrlRetriever<'a> {
    pub fn new(settings: SettingsReadGuard<'a>) -> Self {
        Self { settings }
    }

    pub fn get_settings(&self) -> &super::settings::AppSettings {
        &self.settings
    }

    pub fn get_url(&self, path: impl AsRef<str>) -> String {
        match &self.settings.storage_driver {
            super::settings::StorageDriver::Filesystem { .. } => {
                format!(
                    "{}/{}",
                    self.settings.app.url.trim_end_matches('/'),
                    path.as_ref()
                )
            }
            super::settings::StorageDriver::S3 { public_url, .. } => {
                format!("{}/{}", public_url.trim_end_matches('/'), path.as_ref())
            }
        }
    }
}

pub struct Storage {
    settings: Arc<super::settings::Settings>,
}

impl Storage {
    pub fn new(settings: Arc<super::settings::Settings>) -> Self {
        Self { settings }
    }

    pub async fn retrieve_urls(&self) -> Result<StorageUrlRetriever<'_>, anyhow::Error> {
        let settings = self.settings.get().await?;

        Ok(StorageUrlRetriever::new(settings))
    }

    pub async fn remove(&self, path: Option<impl AsRef<str>>) -> Result<(), anyhow::Error> {
        let path = match path {
            Some(path) => path,
            None => return Ok(()),
        };
        let path = path.as_ref();

        if path.is_empty() || path.contains("..") || path.starts_with('/') {
            return Err(anyhow::anyhow!("invalid path"));
        }

        let settings = self.settings.get().await?;

        tracing::debug!(path, "removing file");

        match &settings.storage_driver {
            super::settings::StorageDriver::Filesystem { path: base_path } => {
                let base_filesystem =
                    match crate::cap::CapFilesystem::async_new(base_path.into()).await {
                        Ok(base_filesystem) => base_filesystem,
                        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(()),
                        Err(err) => return Err(err.into()),
                    };
                drop(settings);

                if let Err(err) = base_filesystem.async_remove_file(&path).await
                    && err
                        .downcast_ref::<std::io::Error>()
                        .is_none_or(|e| e.kind() != std::io::ErrorKind::NotFound)
                {
                    return Err(err);
                }

                if let Some(parent) = Path::new(path).parent().map(|p| p.to_path_buf()) {
                    tokio::spawn(async move {
                        tokio::time::sleep(std::time::Duration::from_secs(10)).await;

                        let mut directory = match base_filesystem.async_read_dir(&parent).await {
                            Ok(directory) => directory,
                            Err(_) => return,
                        };

                        if directory.next_entry().await.is_none() {
                            base_filesystem.async_remove_dir(parent).await.ok();
                        }
                    });
                }
            }
            super::settings::StorageDriver::S3 {
                access_key,
                secret_key,
                bucket,
                region,
                endpoint,
                path_style,
                ..
            } => {
                let s3_client =
                    get_s3_client(access_key, secret_key, region, endpoint, *path_style)?;
                let bucket = bucket.clone();
                drop(settings);

                s3_client
                    .delete_object()
                    .bucket(bucket)
                    .key(path)
                    .send()
                    .await?;
            }
        }

        Ok(())
    }

    pub async fn store(
        &self,
        path: impl AsRef<str>,
        data: impl tokio::io::AsyncRead + Unpin,
        content_type: impl AsRef<str>,
    ) -> Result<u64, anyhow::Error> {
        let path = path.as_ref();
        let content_type = content_type.as_ref();

        if path.is_empty() || path.contains("..") || path.starts_with('/') {
            return Err(anyhow::anyhow!("invalid path"));
        }

        let settings = self.settings.get().await?;

        tracing::debug!(path, content_type, "storing file");

        match &settings.storage_driver {
            super::settings::StorageDriver::Filesystem { path: base_path } => {
                tokio::fs::create_dir_all(base_path).await?;

                let base_filesystem =
                    crate::cap::CapFilesystem::async_new(base_path.into()).await?;
                drop(settings);

                if let Some(parent) = Path::new(path).parent() {
                    base_filesystem.async_create_dir_all(parent).await?;
                }

                let mut file = base_filesystem.async_create(path).await?;
                let mut data = data;
                let bytes = tokio::io::copy(&mut data, &mut file).await?;

                file.shutdown().await?;
                Ok(bytes)
            }
            super::settings::StorageDriver::S3 {
                access_key,
                secret_key,
                bucket,
                region,
                endpoint,
                path_style,
                ..
            } => {
                let s3_client =
                    get_s3_client(access_key, secret_key, region, endpoint, *path_style)?;
                let bucket = bucket.clone();
                drop(settings);

                upload_multipart(&s3_client, &bucket, path, content_type, data).await
            }
        }
    }

    pub async fn list(
        &self,
        base: impl AsRef<str>,
        directory: impl AsRef<str>,
        page: usize,
        per_page: usize,
    ) -> Result<crate::models::Pagination<StorageAsset>, anyhow::Error> {
        let base = base.as_ref();
        let directory = directory.as_ref();

        if base.is_empty() || base.contains("..") || base.starts_with('/') {
            return Err(anyhow::anyhow!("invalid base path"));
        }
        if !directory.is_empty()
            && (directory.contains("..") || directory.starts_with('/') || directory.ends_with('/'))
        {
            return Err(anyhow::anyhow!("invalid directory path"));
        }

        let settings = self.settings.get().await?;

        match &settings.storage_driver {
            super::settings::StorageDriver::Filesystem { path: base_path } => {
                let dir_path = if directory.is_empty() {
                    Path::new(base_path).join(base)
                } else {
                    Path::new(base_path).join(base).join(directory)
                };

                let base_filesystem = match crate::cap::CapFilesystem::async_new(dir_path).await {
                    Ok(base_filesystem) => base_filesystem,
                    Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
                        return Ok(crate::models::Pagination {
                            total: 0,
                            per_page: per_page as i64,
                            page: page as i64,
                            data: Vec::new(),
                        });
                    }
                    Err(err) => return Err(err.into()),
                };
                drop(settings);

                let mut dir_reader = base_filesystem.async_read_dir("").await?;
                let mut raw_dirs: Vec<String> = Vec::new();
                let mut raw_files: Vec<String> = Vec::new();

                while let Some(Ok((is_dir, name))) = dir_reader.next_entry().await {
                    if is_dir {
                        raw_dirs.push(name);
                    } else {
                        raw_files.push(name);
                    }
                }

                raw_dirs.sort_unstable();
                raw_files.sort_unstable();

                let total = (raw_dirs.len() + raw_files.len()) as i64;
                let start = (page - 1) * per_page;

                let storage_url_retriever = self.retrieve_urls().await?;

                let mut entries = Vec::new();

                for (is_dir, name) in raw_dirs
                    .into_iter()
                    .map(|n| (true, n))
                    .chain(raw_files.into_iter().map(|n| (false, n)))
                    .skip(start)
                    .take(per_page)
                {
                    let full_name = if directory.is_empty() {
                        name.clone()
                    } else {
                        format!("{directory}/{name}")
                    };

                    let (size, created) = if is_dir {
                        (0u64, chrono::DateTime::<chrono::Utc>::default())
                    } else {
                        let metadata = match base_filesystem.async_metadata(&name).await {
                            Ok(m) => m,
                            Err(_) => continue,
                        };
                        let created = metadata
                            .created()
                            .or_else(|_| metadata.modified())?
                            .into_std()
                            .into();
                        (metadata.len(), created)
                    };

                    entries.push(StorageAsset {
                        url: storage_url_retriever.get_url(format!("{base}/{full_name}")),
                        name: full_name.to_compact_string(),
                        size,
                        is_directory: is_dir,
                        created,
                    });
                }

                Ok(crate::models::Pagination {
                    total,
                    per_page: per_page as i64,
                    page: page as i64,
                    data: entries,
                })
            }
            super::settings::StorageDriver::S3 {
                access_key,
                secret_key,
                bucket,
                region,
                endpoint,
                path_style,
                ..
            } => {
                let s3_client =
                    get_s3_client(access_key, secret_key, region, endpoint, *path_style)?;
                let bucket_name = bucket.clone();
                drop(settings);

                let s3_prefix = if directory.is_empty() {
                    format!("{base}/")
                } else {
                    format!("{base}/{directory}/")
                };
                let strip_prefix = format!("{base}/");

                let storage_url_retriever = self.retrieve_urls().await?;

                let mut dirs = Vec::new();
                let mut files = Vec::new();

                let mut paginator = s3_client
                    .list_objects_v2()
                    .bucket(&*bucket_name)
                    .prefix(&s3_prefix)
                    .delimiter("/")
                    .into_paginator()
                    .send();

                while let Some(result) = paginator.next().await {
                    let page = result?;

                    for cp in page.common_prefixes() {
                        let Some(prefix) = cp.prefix() else { continue };
                        let name = prefix
                            .trim_start_matches(&strip_prefix)
                            .trim_end_matches('/')
                            .to_compact_string();
                        dirs.push(StorageAsset {
                            url: storage_url_retriever.get_url(prefix),
                            name,
                            size: 0,
                            is_directory: true,
                            created: chrono::DateTime::<chrono::Utc>::default(),
                        });
                    }

                    for entry in page.contents() {
                        let Some(key) = entry.key() else { continue };
                        if key == s3_prefix {
                            continue;
                        }
                        let name = key.trim_start_matches(&strip_prefix).to_compact_string();
                        let size = entry.size().unwrap_or(0).max(0) as u64;
                        let created = entry
                            .last_modified()
                            .and_then(|dt| {
                                chrono::DateTime::<chrono::Utc>::from_timestamp(
                                    dt.secs(),
                                    dt.subsec_nanos(),
                                )
                            })
                            .unwrap_or_default();

                        files.push(StorageAsset {
                            url: storage_url_retriever.get_url(key),
                            name,
                            size,
                            is_directory: false,
                            created,
                        });
                    }
                }

                let total = (dirs.len() + files.len()) as i64;
                let start = (page - 1) * per_page;

                Ok(crate::models::Pagination {
                    total,
                    per_page: per_page as i64,
                    page: page as i64,
                    data: dirs
                        .into_iter()
                        .chain(files)
                        .skip(start)
                        .take(per_page)
                        .collect(),
                })
            }
        }
    }
}

const PART_SIZE: usize = 16 * 1024 * 1024;

async fn upload_multipart(
    client: &S3Client,
    bucket: &str,
    key: &str,
    content_type: &str,
    mut data: impl tokio::io::AsyncRead + Unpin,
) -> Result<u64, anyhow::Error> {
    let first_part = read_part(&mut data, PART_SIZE).await?;

    if first_part.len() < PART_SIZE {
        let total = first_part.len() as u64;
        client
            .put_object()
            .bucket(bucket)
            .key(key)
            .content_type(content_type)
            .body(ByteStream::from(first_part))
            .send()
            .await?;
        return Ok(total);
    }

    let create = client
        .create_multipart_upload()
        .bucket(bucket)
        .key(key)
        .content_type(content_type)
        .send()
        .await?;

    let upload_id = create
        .upload_id()
        .ok_or_else(|| anyhow::anyhow!("S3 did not return an upload_id"))?
        .to_string();

    let result = run_multipart(client, bucket, key, &upload_id, &mut data, first_part).await;

    match result {
        Ok(total) => Ok(total),
        Err(err) => {
            if let Err(abort_err) = client
                .abort_multipart_upload()
                .bucket(bucket)
                .key(key)
                .upload_id(&upload_id)
                .send()
                .await
            {
                tracing::warn!(
                    bucket,
                    key,
                    upload_id,
                    "failed to abort multipart upload after error: {:#?}",
                    abort_err
                );
            }
            Err(err)
        }
    }
}

async fn run_multipart(
    client: &S3Client,
    bucket: &str,
    key: &str,
    upload_id: &str,
    data: &mut (impl tokio::io::AsyncRead + Unpin),
    first_part: Bytes,
) -> Result<u64, anyhow::Error> {
    let mut completed = Vec::new();
    let mut total: u64 = 0;
    let mut part_number: i32 = 1;
    let mut current = first_part;

    loop {
        let part_len = current.len() as u64;
        let resp = client
            .upload_part()
            .bucket(bucket)
            .key(key)
            .upload_id(upload_id)
            .part_number(part_number)
            .body(ByteStream::from(current))
            .send()
            .await?;

        completed.push(
            CompletedPart::builder()
                .part_number(part_number)
                .set_e_tag(resp.e_tag().map(|s| s.to_string()))
                .build(),
        );
        total += part_len;
        part_number += 1;

        let next = read_part(data, PART_SIZE).await?;
        if next.is_empty() {
            break;
        }
        current = next;
    }

    let completed_upload = CompletedMultipartUpload::builder()
        .set_parts(Some(completed))
        .build();

    client
        .complete_multipart_upload()
        .bucket(bucket)
        .key(key)
        .upload_id(upload_id)
        .multipart_upload(completed_upload)
        .send()
        .await?;

    Ok(total)
}

async fn read_part(
    data: &mut (impl tokio::io::AsyncRead + Unpin),
    cap: usize,
) -> Result<Bytes, std::io::Error> {
    let mut buf = BytesMut::with_capacity(cap);
    while buf.len() < cap {
        let n = data.read_buf(&mut buf).await?;
        if n == 0 {
            break;
        }
    }
    Ok(buf.freeze())
}
