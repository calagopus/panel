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
    pub is_directory: bool,
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
                let s3_client = get_s3_client(
                    access_key,
                    secret_key,
                    bucket,
                    region,
                    endpoint,
                    *path_style,
                )?;
                drop(settings);

                let s3_prefix = if directory.is_empty() {
                    format!("{base}/")
                } else {
                    format!("{base}/{directory}/")
                };
                let strip_prefix = format!("{base}/");

                let results = s3_client
                    .list(s3_prefix.clone(), Some("/".to_string()))
                    .await?;

                let storage_url_retriever = self.retrieve_urls().await?;

                let mut dirs: Vec<StorageAsset> = Vec::new();
                let mut files: Vec<StorageAsset> = Vec::new();

                for result in &results {
                    if let Some(prefixes) = &result.common_prefixes {
                        for cp in prefixes {
                            let name = cp
                                .prefix
                                .trim_start_matches(&strip_prefix)
                                .trim_end_matches('/')
                                .to_compact_string();
                            dirs.push(StorageAsset {
                                url: storage_url_retriever.get_url(&cp.prefix),
                                name,
                                size: 0,
                                is_directory: true,
                                created: chrono::DateTime::<chrono::Utc>::default(),
                            });
                        }
                    }

                    for entry in &result.contents {
                        if entry.key == s3_prefix {
                            continue;
                        }
                        let name = entry
                            .key
                            .trim_start_matches(&strip_prefix)
                            .to_compact_string();
                        files.push(StorageAsset {
                            url: storage_url_retriever.get_url(&entry.key),
                            name,
                            size: entry.size,
                            is_directory: false,
                            created: entry.last_modified.parse().unwrap_or_default(),
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
