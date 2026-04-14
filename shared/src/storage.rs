use crate::settings::SettingsReadGuard;
use compact_str::ToCompactString;
use serde::{Deserialize, Serialize};
use std::{path::Path, sync::Arc};
use tokio::io::AsyncWriteExt;
use utoipa::ToSchema;

#[derive(ToSchema, Deserialize, Serialize)]
pub struct StorageAsset {
    pub name: compact_str::CompactString,
    pub url: String,
    pub size: u64,
    pub created: chrono::DateTime<chrono::Utc>,
}

fn get_s3_client(
    access_key: &str,
    secret_key: &str,
    bucket: &str,
    region: &str,
    endpoint: &str,
    path_style: bool,
) -> Result<Box<s3::Bucket>, anyhow::Error> {
    let mut bucket = s3::Bucket::new(
        bucket,
        s3::Region::Custom {
            region: region.to_string(),
            endpoint: endpoint.to_string(),
        },
        s3::creds::Credentials::new(Some(access_key), Some(secret_key), None, None, None)?,
    )?;

    if path_style {
        bucket.set_path_style();
    }

    Ok(bucket)
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

        if path.is_empty() || path.contains("..") || path.starts_with("/") {
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
                let s3_client = get_s3_client(
                    access_key,
                    secret_key,
                    bucket,
                    region,
                    endpoint,
                    *path_style,
                )?;
                drop(settings);

                s3_client.delete_object(path).await?;
            }
        }

        Ok(())
    }

    pub async fn store(
        &self,
        path: impl AsRef<str>,
        mut data: impl tokio::io::AsyncRead + Unpin,
        content_type: impl AsRef<str>,
    ) -> Result<u64, anyhow::Error> {
        let path = path.as_ref();
        let content_type = content_type.as_ref();

        if path.is_empty() || path.contains("..") || path.starts_with("/") {
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
                let s3_client = get_s3_client(
                    access_key,
                    secret_key,
                    bucket,
                    region,
                    endpoint,
                    *path_style,
                )?;
                drop(settings);

                let response = s3_client
                    .put_object_stream_with_content_type(&mut data, path, content_type)
                    .await?;
                Ok(response.uploaded_bytes() as u64)
            }
        }
    }

    pub async fn list(
        &self,
        path: impl AsRef<str>,
        page: usize,
        per_page: usize,
    ) -> Result<crate::models::Pagination<StorageAsset>, anyhow::Error> {
        let path = path.as_ref();

        if path.is_empty() || path.contains("..") || path.starts_with("/") {
            return Err(anyhow::anyhow!("invalid path"));
        }

        let settings = self.settings.get().await?;

        match &settings.storage_driver {
            super::settings::StorageDriver::Filesystem { path: base_path } => {
                let base_filesystem =
                    match crate::cap::CapFilesystem::async_new(Path::new(base_path).join(path))
                        .await
                    {
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

                let mut directory_reader = base_filesystem.async_walk_dir("").await?;
                let mut raw_entries = Vec::new();

                while let Some(Ok((is_dir, entry))) = directory_reader.next_entry().await {
                    if is_dir {
                        continue;
                    }

                    raw_entries.push(entry);
                }

                raw_entries.sort_unstable();

                let total_entries = raw_entries.len();
                let mut entries = Vec::new();
                let start = (page - 1) * per_page;

                let storage_url_retriever = self.retrieve_urls().await?;

                for entry in raw_entries.into_iter().skip(start).take(per_page) {
                    let metadata = match base_filesystem.async_metadata(&entry).await {
                        Ok(metadata) => metadata,
                        Err(_) => continue,
                    };

                    let entry_name = entry.to_string_lossy().to_compact_string();

                    entries.push(StorageAsset {
                        url: storage_url_retriever.get_url(format!("assets/{entry_name}")),
                        name: entry_name,
                        size: metadata.len(),
                        created: metadata
                            .created()
                            .or_else(|_| metadata.modified())?
                            .into_std()
                            .into(),
                    });
                }

                Ok(crate::models::Pagination {
                    total: total_entries as i64,
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
                let s3_client = get_s3_client(
                    access_key,
                    secret_key,
                    bucket,
                    region,
                    endpoint,
                    *path_style,
                )?;
                drop(settings);

                let buckets = s3_client.list(path.into(), None).await?;
                let entries = buckets
                    .into_iter()
                    .flat_map(|bucket| bucket.contents)
                    .collect::<Vec<_>>();

                let start = (page - 1) * per_page;

                let storage_url_retriever = self.retrieve_urls().await?;

                Ok(crate::models::Pagination {
                    total: entries.len() as i64,
                    per_page: per_page as i64,
                    page: page as i64,
                    data: entries
                        .into_iter()
                        .skip(start)
                        .take(per_page)
                        .map(|e| StorageAsset {
                            url: storage_url_retriever.get_url(&e.key),
                            name: e.key.trim_start_matches("assets/").to_compact_string(),
                            size: e.size,
                            created: e.last_modified.parse().unwrap_or_default(),
                        })
                        .collect(),
                })
            }
        }
    }
}
