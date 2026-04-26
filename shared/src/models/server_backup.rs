use crate::{
    jwt::BasePayload,
    models::{InsertQueryBuilder, UpdateQueryBuilder},
    prelude::*,
    storage::StorageUrlRetriever,
};
use compact_str::ToCompactString;
use garde::Validate;
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow, prelude::Type};
use std::{
    collections::BTreeMap,
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

#[derive(Debug, ToSchema, Serialize, Deserialize, Type, PartialEq, Eq, Hash, Clone, Copy)]
#[serde(rename_all = "kebab-case")]
#[sqlx(type_name = "backup_disk", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum BackupDisk {
    Local,
    S3,
    DdupBak,
    Btrfs,
    Zfs,
    Restic,
}

impl BackupDisk {
    #[inline]
    pub fn to_wings_adapter(self) -> wings_api::BackupAdapter {
        match self {
            BackupDisk::Local => wings_api::BackupAdapter::Wings,
            BackupDisk::S3 => wings_api::BackupAdapter::S3,
            BackupDisk::DdupBak => wings_api::BackupAdapter::DdupBak,
            BackupDisk::Btrfs => wings_api::BackupAdapter::Btrfs,
            BackupDisk::Zfs => wings_api::BackupAdapter::Zfs,
            BackupDisk::Restic => wings_api::BackupAdapter::Restic,
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ServerBackup {
    pub uuid: uuid::Uuid,
    pub server: Option<Fetchable<super::server::Server>>,
    pub node: Fetchable<super::node::Node>,
    pub backup_configuration: Option<Fetchable<super::backup_configuration::BackupConfiguration>>,

    pub name: compact_str::CompactString,
    pub successful: bool,
    pub browsable: bool,
    pub streaming: bool,
    pub locked: bool,

    pub ignored_files: Vec<compact_str::CompactString>,
    pub checksum: Option<compact_str::CompactString>,
    pub bytes: i64,
    pub files: i64,

    pub disk: BackupDisk,
    pub upload_id: Option<compact_str::CompactString>,
    pub upload_path: Option<compact_str::CompactString>,

    pub completed: Option<chrono::NaiveDateTime>,
    pub deleted: Option<chrono::NaiveDateTime>,
    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for ServerBackup {
    const NAME: &'static str = "server_backup";

    fn get_extension_list() -> &'static super::ModelExtensionList {
        static EXTENSIONS: LazyLock<super::ModelExtensionList> =
            LazyLock::new(|| std::sync::RwLock::new(Vec::new()));

        &EXTENSIONS
    }

    fn get_extension_data(&self) -> &super::ModelExtensionData {
        &self.extension_data
    }

    #[inline]
    fn base_columns(prefix: Option<&str>) -> BTreeMap<&'static str, compact_str::CompactString> {
        let prefix = prefix.unwrap_or_default();

        BTreeMap::from([
            (
                "server_backups.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "server_backups.server_uuid",
                compact_str::format_compact!("{prefix}server_uuid"),
            ),
            (
                "server_backups.node_uuid",
                compact_str::format_compact!("{prefix}node_uuid"),
            ),
            (
                "server_backups.backup_configuration_uuid",
                compact_str::format_compact!("{prefix}backup_configuration_uuid"),
            ),
            (
                "server_backups.name",
                compact_str::format_compact!("{prefix}name"),
            ),
            (
                "server_backups.successful",
                compact_str::format_compact!("{prefix}successful"),
            ),
            (
                "server_backups.browsable",
                compact_str::format_compact!("{prefix}browsable"),
            ),
            (
                "server_backups.streaming",
                compact_str::format_compact!("{prefix}streaming"),
            ),
            (
                "server_backups.locked",
                compact_str::format_compact!("{prefix}locked"),
            ),
            (
                "server_backups.ignored_files",
                compact_str::format_compact!("{prefix}ignored_files"),
            ),
            (
                "server_backups.checksum",
                compact_str::format_compact!("{prefix}checksum"),
            ),
            (
                "server_backups.bytes",
                compact_str::format_compact!("{prefix}bytes"),
            ),
            (
                "server_backups.files",
                compact_str::format_compact!("{prefix}files"),
            ),
            (
                "server_backups.disk",
                compact_str::format_compact!("{prefix}disk"),
            ),
            (
                "server_backups.upload_id",
                compact_str::format_compact!("{prefix}upload_id"),
            ),
            (
                "server_backups.upload_path",
                compact_str::format_compact!("{prefix}upload_path"),
            ),
            (
                "server_backups.completed",
                compact_str::format_compact!("{prefix}completed"),
            ),
            (
                "server_backups.deleted",
                compact_str::format_compact!("{prefix}deleted"),
            ),
            (
                "server_backups.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ])
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            uuid: row.try_get(compact_str::format_compact!("{prefix}uuid").as_str())?,
            server: super::server::Server::get_fetchable_from_row(
                row,
                compact_str::format_compact!("{prefix}server_uuid"),
            ),
            backup_configuration:
                super::backup_configuration::BackupConfiguration::get_fetchable_from_row(
                    row,
                    compact_str::format_compact!("{prefix}backup_configuration_uuid"),
                ),
            node: super::node::Node::get_fetchable(
                row.try_get(compact_str::format_compact!("{prefix}node_uuid").as_str())?,
            ),
            name: row.try_get(compact_str::format_compact!("{prefix}name").as_str())?,
            successful: row.try_get(compact_str::format_compact!("{prefix}successful").as_str())?,
            browsable: row.try_get(compact_str::format_compact!("{prefix}browsable").as_str())?,
            streaming: row.try_get(compact_str::format_compact!("{prefix}streaming").as_str())?,
            locked: row.try_get(compact_str::format_compact!("{prefix}locked").as_str())?,
            ignored_files: row
                .try_get(compact_str::format_compact!("{prefix}ignored_files").as_str())?,
            checksum: row.try_get(compact_str::format_compact!("{prefix}checksum").as_str())?,
            bytes: row.try_get(compact_str::format_compact!("{prefix}bytes").as_str())?,
            files: row.try_get(compact_str::format_compact!("{prefix}files").as_str())?,
            disk: row.try_get(compact_str::format_compact!("{prefix}disk").as_str())?,
            upload_id: row.try_get(compact_str::format_compact!("{prefix}upload_id").as_str())?,
            upload_path: row
                .try_get(compact_str::format_compact!("{prefix}upload_path").as_str())?,
            completed: row.try_get(compact_str::format_compact!("{prefix}completed").as_str())?,
            deleted: row.try_get(compact_str::format_compact!("{prefix}deleted").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl ServerBackup {
    pub async fn create_raw(
        state: &crate::State,
        options: CreateServerBackupOptions<'_>,
    ) -> Result<Self, anyhow::Error> {
        let backup_configuration = options
            .server
            .backup_configuration(&state.database)
            .await
            .ok_or_else(|| {
                crate::response::DisplayError::new(
                    "no backup configuration available, unable to create backup",
                )
                .with_status(StatusCode::EXPECTATION_FAILED)
            })?;

        if backup_configuration.maintenance_enabled {
            return Err(crate::response::DisplayError::new(
                "cannot create backup while backup configuration is in maintenance mode",
            )
            .with_status(StatusCode::EXPECTATION_FAILED)
            .into());
        }

        let row = sqlx::query(&format!(
            r#"
            INSERT INTO server_backups (server_uuid, node_uuid, backup_configuration_uuid, name, ignored_files, bytes, disk)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING {}
            "#,
            Self::columns_sql(None)
        ))
        .bind(options.server.uuid)
        .bind(options.server.node.uuid)
        .bind(backup_configuration.uuid)
        .bind(options.name)
        .bind(&options.ignored_files)
        .bind(0i64)
        .bind(backup_configuration.backup_disk)
        .fetch_one(state.database.write())
        .await?;

        Ok(Self::map(None, &row)?)
    }

    pub async fn by_server_uuid_uuid(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM server_backups
            WHERE server_backups.server_uuid = $1 AND server_backups.uuid = $2
            "#,
            Self::columns_sql(None)
        ))
        .bind(server_uuid)
        .bind(uuid)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn by_node_uuid_uuid(
        database: &crate::database::Database,
        node_uuid: uuid::Uuid,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM server_backups
            WHERE server_backups.node_uuid = $1 AND server_backups.uuid = $2
            "#,
            Self::columns_sql(None)
        ))
        .bind(node_uuid)
        .bind(uuid)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn by_server_uuid_with_pagination(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(&format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM server_backups
            WHERE
                server_backups.server_uuid = $1
                AND server_backups.deleted IS NULL
                AND ($2 IS NULL OR server_backups.name ILIKE '%' || $2 || '%')
            ORDER BY server_backups.created
            LIMIT $3 OFFSET $4
            "#,
            Self::columns_sql(None)
        ))
        .bind(server_uuid)
        .bind(search)
        .bind(per_page)
        .bind(offset)
        .fetch_all(database.read())
        .await?;

        Ok(super::Pagination {
            total: rows
                .first()
                .map_or(Ok(0), |row| row.try_get("total_count"))?,
            per_page,
            page,
            data: rows
                .into_iter()
                .map(|row| Self::map(None, &row))
                .try_collect_vec()?,
        })
    }

    pub async fn by_server_uuid_node_uuid_with_pagination(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
        node_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(&format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM server_backups
            WHERE
                server_backups.server_uuid = $1
                AND server_backups.node_uuid = $2
                AND server_backups.deleted IS NULL
                AND ($3 IS NULL OR server_backups.name ILIKE '%' || $3 || '%')
            ORDER BY server_backups.created
            LIMIT $4 OFFSET $5
            "#,
            Self::columns_sql(None)
        ))
        .bind(server_uuid)
        .bind(node_uuid)
        .bind(search)
        .bind(per_page)
        .bind(offset)
        .fetch_all(database.read())
        .await?;

        Ok(super::Pagination {
            total: rows
                .first()
                .map_or(Ok(0), |row| row.try_get("total_count"))?,
            per_page,
            page,
            data: rows
                .into_iter()
                .map(|row| Self::map(None, &row))
                .try_collect_vec()?,
        })
    }

    pub async fn by_partially_detached_server_uuid_node_uuid_with_pagination(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
        node_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(&format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM server_backups
            WHERE
                server_backups.server_uuid = $1
                AND server_backups.node_uuid != $2
                AND server_backups.deleted IS NULL
                AND ($3 IS NULL OR server_backups.name ILIKE '%' || $3 || '%')
            ORDER BY server_backups.created
            LIMIT $4 OFFSET $5
            "#,
            Self::columns_sql(None)
        ))
        .bind(server_uuid)
        .bind(node_uuid)
        .bind(search)
        .bind(per_page)
        .bind(offset)
        .fetch_all(database.read())
        .await?;

        Ok(super::Pagination {
            total: rows
                .first()
                .map_or(Ok(0), |row| row.try_get("total_count"))?,
            per_page,
            page,
            data: rows
                .into_iter()
                .map(|row| Self::map(None, &row))
                .try_collect_vec()?,
        })
    }

    pub async fn by_node_uuid_with_pagination(
        database: &crate::database::Database,
        node_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(&format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM server_backups
            WHERE
                server_backups.node_uuid = $1
                AND server_backups.deleted IS NULL
                AND ($2 IS NULL OR server_backups.name ILIKE '%' || $2 || '%')
            ORDER BY server_backups.created
            LIMIT $3 OFFSET $4
            "#,
            Self::columns_sql(None)
        ))
        .bind(node_uuid)
        .bind(search)
        .bind(per_page)
        .bind(offset)
        .fetch_all(database.read())
        .await?;

        Ok(super::Pagination {
            total: rows
                .first()
                .map_or(Ok(0), |row| row.try_get("total_count"))?,
            per_page,
            page,
            data: rows
                .into_iter()
                .map(|row| Self::map(None, &row))
                .try_collect_vec()?,
        })
    }

    pub async fn by_backup_configuration_uuid_with_pagination(
        database: &crate::database::Database,
        backup_configuration_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(&format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM server_backups
            WHERE
                server_backups.backup_configuration_uuid = $1
                AND server_backups.deleted IS NULL
                AND ($2 IS NULL OR server_backups.name ILIKE '%' || $2 || '%')
            ORDER BY server_backups.created
            LIMIT $3 OFFSET $4
            "#,
            Self::columns_sql(None)
        ))
        .bind(backup_configuration_uuid)
        .bind(search)
        .bind(per_page)
        .bind(offset)
        .fetch_all(database.read())
        .await?;

        Ok(super::Pagination {
            total: rows
                .first()
                .map_or(Ok(0), |row| row.try_get("total_count"))?,
            per_page,
            page,
            data: rows
                .into_iter()
                .map(|row| Self::map(None, &row))
                .try_collect_vec()?,
        })
    }

    pub async fn by_detached_node_uuid_with_pagination(
        database: &crate::database::Database,
        node_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(&format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM server_backups
            WHERE
                server_backups.node_uuid = $1
                AND server_backups.server_uuid IS NULL
                AND server_backups.deleted IS NULL
                AND ($2 IS NULL OR server_backups.name ILIKE '%' || $2 || '%')
            ORDER BY server_backups.created
            LIMIT $3 OFFSET $4
            "#,
            Self::columns_sql(None)
        ))
        .bind(node_uuid)
        .bind(search)
        .bind(per_page)
        .bind(offset)
        .fetch_all(database.read())
        .await?;

        Ok(super::Pagination {
            total: rows
                .first()
                .map_or(Ok(0), |row| row.try_get("total_count"))?,
            per_page,
            page,
            data: rows
                .into_iter()
                .map(|row| Self::map(None, &row))
                .try_collect_vec()?,
        })
    }

    pub async fn all_uuids_by_server_uuid(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
    ) -> Result<Vec<uuid::Uuid>, crate::database::DatabaseError> {
        let rows = sqlx::query(
            r#"
            SELECT server_backups.uuid
            FROM server_backups
            WHERE server_backups.server_uuid = $1 AND server_backups.deleted IS NULL
            "#,
        )
        .bind(server_uuid)
        .fetch_all(database.read())
        .await?;

        Ok(rows
            .into_iter()
            .map(|row| row.get::<uuid::Uuid, _>("uuid"))
            .collect())
    }

    pub async fn all_by_server_uuid(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
    ) -> Result<Vec<Self>, crate::database::DatabaseError> {
        let rows = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM server_backups
            WHERE server_backups.server_uuid = $1 AND server_backups.deleted IS NULL
            "#,
            Self::columns_sql(None)
        ))
        .bind(server_uuid)
        .fetch_all(database.read())
        .await?;

        rows.into_iter()
            .map(|row| Self::map(None, &row))
            .try_collect_vec()
    }

    pub async fn count_by_server_uuid(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
    ) -> i64 {
        sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM server_backups
            WHERE server_backups.server_uuid = $1 AND server_backups.deleted IS NULL
            "#,
        )
        .bind(server_uuid)
        .fetch_one(database.read())
        .await
        .unwrap_or(0)
    }

    pub async fn download_url(
        &self,
        state: &crate::State,
        user: &super::user::User,
        node: &super::node::Node,
        archive_format: wings_api::StreamableArchiveFormat,
    ) -> Result<String, anyhow::Error> {
        let backup_configuration = self
            .backup_configuration
            .as_ref()
            .ok_or_else(|| {
                crate::response::DisplayError::new(
                    "no backup configuration available, unable to restore backup",
                )
                .with_status(StatusCode::EXPECTATION_FAILED)
            })?
            .fetch_cached(&state.database)
            .await?;

        if backup_configuration.maintenance_enabled {
            return Err(crate::response::DisplayError::new(
                "cannot restore backup while backup configuration is in maintenance mode",
            )
            .with_status(StatusCode::EXPECTATION_FAILED)
            .into());
        }

        if matches!(self.disk, BackupDisk::S3)
            && let Some(mut s3_configuration) = backup_configuration.backup_configs.s3
        {
            s3_configuration.decrypt(&state.database).await?;

            let client = match s3_configuration.into_client() {
                Ok(client) => client,
                Err(err) => {
                    return Err(anyhow::Error::from(err).context("failed to create s3 client"));
                }
            };
            let file_path = match &self.upload_path {
                Some(path) => path,
                None => {
                    return Err(crate::response::DisplayError::new(
                        "backup does not have an upload path",
                    )
                    .with_status(StatusCode::EXPECTATION_FAILED)
                    .into());
                }
            };

            let url = client.presign_get(file_path, 15 * 60, None).await?;

            return Ok(url);
        }

        #[derive(Serialize)]
        struct BackupDownloadJwt {
            #[serde(flatten)]
            base: BasePayload,

            backup_uuid: uuid::Uuid,
            unique_id: uuid::Uuid,
        }

        let token = node.create_jwt(
            &state.database,
            &state.jwt,
            &BackupDownloadJwt {
                base: BasePayload {
                    issuer: "panel".into(),
                    subject: None,
                    audience: Vec::new(),
                    expiration_time: Some(chrono::Utc::now().timestamp() + 900),
                    not_before: None,
                    issued_at: Some(chrono::Utc::now().timestamp()),
                    jwt_id: user.uuid.to_string(),
                },
                backup_uuid: self.uuid,
                unique_id: uuid::Uuid::new_v4(),
            },
        )?;

        let mut url = node.public_url(state, "/download/backup").await?;
        url.set_query(Some(&format!(
            "token={}&archive_format={}",
            urlencoding::encode(&token),
            archive_format
        )));

        Ok(url.to_string())
    }

    pub async fn restore(
        self,
        database: &crate::database::Database,
        server: super::server::Server,
        truncate_directory: bool,
    ) -> Result<(), anyhow::Error> {
        let backup_configuration = self
            .backup_configuration
            .ok_or_else(|| {
                crate::response::DisplayError::new(
                    "no backup configuration available, unable to restore backup",
                )
                .with_status(StatusCode::EXPECTATION_FAILED)
            })?
            .fetch_cached(database)
            .await?;

        if backup_configuration.maintenance_enabled {
            return Err(crate::response::DisplayError::new(
                "cannot restore backup while backup configuration is in maintenance mode",
            )
            .with_status(StatusCode::EXPECTATION_FAILED)
            .into());
        }

        server
            .node
            .fetch_cached(database)
            .await?
            .api_client(database)
            .await?
            .post_servers_server_backup_backup_restore(
                server.uuid,
                self.uuid,
                &wings_api::servers_server_backup_backup_restore::post::RequestBody {
                    adapter: self.disk.to_wings_adapter(),
                    download_url: match self.disk {
                        BackupDisk::S3 => {
                            if let Some(mut s3_configuration) =
                                backup_configuration.backup_configs.s3
                            {
                                s3_configuration.decrypt(database).await?;

                                let client = s3_configuration.into_client()?;
                                let file_path = match &self.upload_path {
                                    Some(path) => path.as_str(),
                                    None => &Self::s3_path(server.uuid, self.uuid),
                                };

                                Some(client.presign_get(file_path, 60 * 60, None).await?.into())
                            } else {
                                None
                            }
                        }
                        _ => None,
                    },
                    truncate_directory,
                },
            )
            .await?;

        Ok(())
    }

    pub async fn delete_oldest_by_server_uuid(
        state: &crate::State,
        server: &super::server::Server,
    ) -> Result<(), anyhow::Error> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM server_backups
            WHERE server_backups.server_uuid = $1
                AND server_backups.locked = false
                AND server_backups.completed IS NOT NULL
                AND server_backups.deleted IS NULL
            ORDER BY server_backups.created ASC
            LIMIT 1
            "#,
            Self::columns_sql(None)
        ))
        .bind(server.uuid)
        .fetch_optional(state.database.read())
        .await?;

        if let Some(row) = row {
            let backup = Self::map(None, &row)?;

            backup.delete(state, Default::default()).await
        } else {
            Err(sqlx::Error::RowNotFound.into())
        }
    }

    #[inline]
    pub fn default_name() -> compact_str::CompactString {
        let now = chrono::Local::now();

        now.format("%Y-%m-%d %H:%M:%S %z").to_compact_string()
    }

    #[inline]
    pub fn s3_path(server_uuid: uuid::Uuid, backup_uuid: uuid::Uuid) -> compact_str::CompactString {
        compact_str::format_compact!("{server_uuid}/{backup_uuid}.tar.gz")
    }

    #[inline]
    pub fn s3_content_type(name: &str) -> &'static str {
        if name.ends_with(".tar.gz") {
            "application/x-gzip"
        } else {
            "application/octet-stream"
        }
    }

    #[inline]
    pub fn is_remote(&self) -> bool {
        matches!(self.disk, BackupDisk::S3 | BackupDisk::Restic)
    }

    pub async fn into_admin_node_api_object(
        self,
        state: &crate::State,
        storage_url_retriever: &StorageUrlRetriever<'_>,
    ) -> Result<AdminApiNodeServerBackup, crate::database::DatabaseError> {
        let is_remote = self.is_remote();

        Ok(AdminApiNodeServerBackup {
            uuid: self.uuid,
            server: match self.server {
                Some(server) => Some(
                    server
                        .fetch_cached(&state.database)
                        .await?
                        .into_admin_api_object(state, storage_url_retriever)
                        .await?,
                ),
                None => None,
            },
            node: self
                .node
                .fetch_cached(&state.database)
                .await?
                .into_admin_api_object(state, ())
                .await?,
            name: self.name,
            ignored_files: self.ignored_files,
            is_successful: self.successful,
            is_locked: self.locked,
            is_browsable: self.browsable,
            is_streaming: self.streaming,
            is_remote,
            checksum: self.checksum,
            bytes: self.bytes,
            files: self.files,
            completed: self.completed.map(|dt| dt.and_utc()),
            created: self.created.and_utc(),
        })
    }
}

#[async_trait::async_trait]
impl IntoAdminApiObject for ServerBackup {
    type AdminApiObject = AdminApiServerBackup;
    type ExtraArgs<'a> = &'a crate::storage::StorageUrlRetriever<'a>;

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        storage_url_retriever: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiServerBackup::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            AdminApiServerBackup {
                uuid: self.uuid,
                server: match self.server {
                    Some(server) => Some(
                        server
                            .fetch_cached(&state.database)
                            .await?
                            .into_admin_api_object(state, storage_url_retriever)
                            .await?,
                    ),
                    None => None,
                },
                name: self.name,
                ignored_files: self.ignored_files,
                is_successful: self.successful,
                is_locked: self.locked,
                is_browsable: self.browsable,
                is_streaming: self.streaming,
                checksum: self.checksum,
                bytes: self.bytes,
                files: self.files,
                completed: self.completed.map(|dt| dt.and_utc()),
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[async_trait::async_trait]
impl IntoApiObject for ServerBackup {
    type ApiObject = ApiServerBackup;
    type ExtraArgs<'a> = ();

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::ApiObject, crate::database::DatabaseError> {
        let api_object = ApiServerBackup::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            ApiServerBackup {
                uuid: self.uuid,
                name: self.name,
                ignored_files: self.ignored_files,
                is_successful: self.successful,
                is_locked: self.locked,
                is_browsable: self.browsable,
                is_streaming: self.streaming,
                checksum: self.checksum,
                bytes: self.bytes,
                files: self.files,
                completed: self.completed.map(|dt| dt.and_utc()),
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[derive(Validate)]
pub struct CreateServerBackupOptions<'a> {
    #[garde(skip)]
    pub server: &'a super::server::Server,
    #[garde(length(chars, min = 1, max = 255))]
    pub name: compact_str::CompactString,
    #[garde(skip)]
    pub ignored_files: Vec<compact_str::CompactString>,
}

#[async_trait::async_trait]
impl CreatableModel for ServerBackup {
    type CreateOptions<'a> = CreateServerBackupOptions<'a>;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<ServerBackup>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        let backup_configuration = options
            .server
            .backup_configuration(&state.database)
            .await
            .ok_or_else(|| {
                anyhow::Error::new(
                    crate::response::DisplayError::new(
                        "no backup configuration available, unable to create backup",
                    )
                    .with_status(StatusCode::EXPECTATION_FAILED),
                )
            })?;

        if backup_configuration.maintenance_enabled {
            return Err(anyhow::Error::new(
                crate::response::DisplayError::new(
                    "cannot create backup while backup configuration is in maintenance mode",
                )
                .with_status(StatusCode::EXPECTATION_FAILED),
            )
            .into());
        }

        let mut transaction = state.database.write().begin().await?;

        let mut query_builder = InsertQueryBuilder::new("server_backups");

        Self::run_create_handlers(&mut options, &mut query_builder, state, &mut transaction)
            .await?;

        query_builder
            .set("server_uuid", options.server.uuid)
            .set("node_uuid", options.server.node.uuid)
            .set("backup_configuration_uuid", backup_configuration.uuid)
            .set("name", &options.name)
            .set("ignored_files", &options.ignored_files)
            .set("bytes", 0i64)
            .set("disk", backup_configuration.backup_disk);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut *transaction)
            .await?;
        let backup = Self::map(None, &row)?;

        transaction.commit().await?;

        let server = options.server.clone();
        let database = Arc::clone(&state.database);
        let backup_uuid = backup.uuid;
        let backup_disk = backup_configuration.backup_disk;
        let ignored_files_str = options
            .ignored_files
            .iter()
            .map(|s| s.as_str())
            .collect::<Vec<_>>()
            .join("\n");

        tokio::spawn(async move {
            tracing::debug!(backup = %backup_uuid, "creating server backup");

            let node = match server.node.fetch_cached(&database).await {
                Ok(node) => node,
                Err(err) => {
                    tracing::error!(backup = %backup_uuid, "failed to create server backup: {:?}", err);

                    if let Err(err) = sqlx::query!(
                        "UPDATE server_backups
                        SET successful = false, completed = NOW()
                        WHERE server_backups.uuid = $1",
                        backup_uuid
                    )
                    .execute(database.write())
                    .await
                    {
                        tracing::error!(backup = %backup_uuid, "failed to update server backup status: {:?}", err);
                    }

                    return;
                }
            };

            let api_client = match node.api_client(&database).await {
                Ok(api_client) => api_client,
                Err(err) => {
                    tracing::error!(backup = %backup_uuid, "failed to create server backup: {:?}", err);

                    if let Err(err) = sqlx::query!(
                        "UPDATE server_backups
                        SET successful = false, completed = NOW()
                        WHERE server_backups.uuid = $1",
                        backup_uuid
                    )
                    .execute(database.write())
                    .await
                    {
                        tracing::error!(backup = %backup_uuid, "failed to update server backup status: {:?}", err);
                    }

                    return;
                }
            };

            if let Err(err) = api_client
                .post_servers_server_backup(
                    server.uuid,
                    &wings_api::servers_server_backup::post::RequestBody {
                        adapter: backup_disk.to_wings_adapter(),
                        uuid: backup_uuid,
                        ignore: ignored_files_str.into(),
                    },
                )
                .await
            {
                tracing::error!(backup = %backup_uuid, "failed to create server backup: {:?}", err);

                if let Err(err) = sqlx::query!(
                    "UPDATE server_backups
                    SET successful = false, completed = NOW()
                    WHERE server_backups.uuid = $1",
                    backup_uuid
                )
                .execute(database.write())
                .await
                {
                    tracing::error!(backup = %backup_uuid, "failed to update server backup status: {:?}", err);
                }
            }
        });

        Ok(backup)
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Default)]
pub struct UpdateServerBackupOptions {
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: Option<compact_str::CompactString>,
    #[garde(skip)]
    pub locked: Option<bool>,
}

#[async_trait::async_trait]
impl UpdatableModel for ServerBackup {
    type UpdateOptions = UpdateServerBackupOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateListenerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateListenerList<ServerBackup>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &UPDATE_LISTENERS
    }

    async fn update(
        &mut self,
        state: &crate::State,
        mut options: Self::UpdateOptions,
    ) -> Result<(), crate::database::DatabaseError> {
        options.validate()?;

        let mut transaction = state.database.write().begin().await?;

        let mut query_builder = UpdateQueryBuilder::new("server_backups");

        Self::run_update_handlers(
            self,
            &mut options,
            &mut query_builder,
            state,
            &mut transaction,
        )
        .await?;

        query_builder
            .set("name", options.name.as_ref())
            .set("locked", options.locked)
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut *transaction).await?;

        if let Some(name) = options.name {
            self.name = name;
        }
        if let Some(locked) = options.locked {
            self.locked = locked;
        }

        transaction.commit().await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl ByUuid for ServerBackup {
    async fn by_uuid(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
    ) -> Result<Self, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM server_backups
            WHERE server_backups.uuid = $1
            "#,
            Self::columns_sql(None)
        ))
        .bind(uuid)
        .fetch_one(database.read())
        .await?;

        Self::map(None, &row)
    }
}

#[derive(Default)]
pub struct DeleteServerBackupOptions {
    pub force: bool,
}

#[async_trait::async_trait]
impl DeletableModel for ServerBackup {
    type DeleteOptions = DeleteServerBackupOptions;

    fn get_delete_handlers() -> &'static LazyLock<DeleteListenerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteListenerList<ServerBackup>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &DELETE_LISTENERS
    }

    async fn delete(
        &self,
        state: &crate::State,
        options: Self::DeleteOptions,
    ) -> Result<(), anyhow::Error> {
        let mut transaction = state.database.write().begin().await?;

        self.run_delete_handlers(&options, state, &mut transaction)
            .await?;

        let node = self.node.fetch_cached(&state.database).await?;

        let backup_configuration = match &self.backup_configuration {
            Some(backup_configuration) => {
                backup_configuration.fetch_cached(&state.database).await?
            }
            None if options.force => {
                let database = Arc::clone(&state.database);
                let backup_uuid = self.uuid;
                let backup_disk = self.disk;

                return tokio::spawn(async move {
                    if backup_disk != BackupDisk::S3
                        && let Err(err) = node
                            .api_client(&database)
                            .await?
                            .delete_backups_backup(
                                backup_uuid,
                                &wings_api::backups_backup::delete::RequestBody {
                                    adapter: backup_disk.to_wings_adapter(),
                                },
                            )
                            .await
                            && !matches!(
                                err,
                                wings_api::client::ApiHttpError::Http(StatusCode::NOT_FOUND, _)
                            )
                    {
                        tracing::error!(node = %node.uuid, backup = %backup_uuid, "unable to delete backup on node: {:?}", err)
                    }

                    sqlx::query(
                        r#"
                        UPDATE server_backups
                        SET deleted = NOW()
                        WHERE server_backups.uuid = $1
                        "#,
                    )
                    .bind(backup_uuid)
                    .execute(&mut *transaction)
                    .await?;

                    transaction.commit().await?;

                    Ok(())
                })
                .await?;
            }
            None => {
                return Err(crate::response::DisplayError::new(
                    "no backup configuration available, unable to delete backup",
                )
                .with_status(StatusCode::EXPECTATION_FAILED)
                .into());
            }
        };

        if backup_configuration.maintenance_enabled {
            return Err(crate::response::DisplayError::new(
                "cannot delete backup while backup configuration is in maintenance mode",
            )
            .with_status(StatusCode::EXPECTATION_FAILED)
            .into());
        }

        let database = Arc::clone(&state.database);
        let server_uuid = self.server.as_ref().map(|s| s.uuid);
        let backup_uuid = self.uuid;
        let backup_disk = self.disk;
        let backup_upload_path = self.upload_path.clone();

        tokio::spawn(async move {
            match backup_disk {
                BackupDisk::S3 => {
                    if let Some(mut s3_configuration) = backup_configuration.backup_configs.s3 {
                        s3_configuration.decrypt(&database).await?;

                        let client = s3_configuration
                            .into_client()
                            .map_err(|err| sqlx::Error::Io(std::io::Error::other(err)))?;
                        let file_path = match backup_upload_path {
                            Some(path) => path,
                            None => if let Some(server_uuid) = server_uuid {
                                Self::s3_path(server_uuid, backup_uuid)
                            } else {
                                return Err(anyhow::anyhow!("backup upload path not found"))
                            }
                        };

                        if let Err(err) = client.delete_object(file_path).await {
                            if options.force {
                                tracing::error!(server = ?server_uuid, backup = %backup_uuid, "failed to delete S3 backup, ignoring: {:?}", err);
                            } else {
                                return Err(err.into());
                            }
                        }
                    } else if options.force {
                        tracing::warn!(server = ?server_uuid, backup = %backup_uuid, "S3 backup deletion attempted but no S3 configuration found, ignoring");
                    } else {
                        return Err(anyhow::anyhow!("s3 backup deletion attempted but no S3 configuration found"));
                    }
                }
                _ => {
                    if let Err(err) = node
                        .api_client(&database)
                        .await?
                        .delete_backups_backup(
                            backup_uuid,
                            &wings_api::backups_backup::delete::RequestBody {
                                adapter: backup_disk.to_wings_adapter(),
                            },
                        )
                        .await
                        && !matches!(err, wings_api::client::ApiHttpError::Http(StatusCode::NOT_FOUND, _))
                    {
                        return Err(err.into());
                    }
                }
            }

            sqlx::query(
                r#"
                UPDATE server_backups
                SET deleted = NOW()
                WHERE server_backups.uuid = $1
                "#,
            )
            .bind(backup_uuid)
            .execute(&mut *transaction)
            .await?;

            transaction.commit().await?;

            Ok(())
        }).await?
    }
}

#[derive(ToSchema, Serialize)]
#[schema(title = "AdminNodeServerBackup")]
pub struct AdminApiNodeServerBackup {
    pub uuid: uuid::Uuid,
    pub server: Option<super::server::AdminApiServer>,
    pub node: super::node::AdminApiNode,

    pub name: compact_str::CompactString,
    pub ignored_files: Vec<compact_str::CompactString>,

    pub is_successful: bool,
    pub is_locked: bool,
    pub is_browsable: bool,
    pub is_streaming: bool,
    pub is_remote: bool,

    pub checksum: Option<compact_str::CompactString>,
    pub bytes: i64,
    pub files: i64,

    pub completed: Option<chrono::DateTime<chrono::Utc>>,
    pub created: chrono::DateTime<chrono::Utc>,
}

#[schema_extension_derive::extendible]
#[init_args(ServerBackup, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "AdminServerBackup")]
pub struct AdminApiServerBackup {
    pub uuid: uuid::Uuid,
    pub server: Option<super::server::AdminApiServer>,

    pub name: compact_str::CompactString,
    pub ignored_files: Vec<compact_str::CompactString>,

    pub is_successful: bool,
    pub is_locked: bool,
    pub is_browsable: bool,
    pub is_streaming: bool,

    pub checksum: Option<compact_str::CompactString>,
    pub bytes: i64,
    pub files: i64,

    pub completed: Option<chrono::DateTime<chrono::Utc>>,
    pub created: chrono::DateTime<chrono::Utc>,
}

#[schema_extension_derive::extendible]
#[init_args(ServerBackup, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "ServerBackup")]
pub struct ApiServerBackup {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub ignored_files: Vec<compact_str::CompactString>,

    pub is_successful: bool,
    pub is_locked: bool,
    pub is_browsable: bool,
    pub is_streaming: bool,

    pub checksum: Option<compact_str::CompactString>,
    pub bytes: i64,
    pub files: i64,

    pub completed: Option<chrono::DateTime<chrono::Utc>>,
    pub created: chrono::DateTime<chrono::Utc>,
}
