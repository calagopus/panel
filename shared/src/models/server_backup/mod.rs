mod events;
pub use events::ServerBackupEvent;

use crate::{
    jwt::BasePayload,
    models::{InsertQueryBuilder, UpdateQueryBuilder, server_variable::ServerVariable},
    prelude::*,
    storage::StorageUrlRetriever,
};
use compact_str::ToCompactString;
use garde::Validate;
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow, prelude::Type};
use std::{
    collections::{BTreeMap, HashMap},
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
    ProxmoxBackupServer,
    Kopia,
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
            BackupDisk::ProxmoxBackupServer => wings_api::BackupAdapter::ProxmoxBackupServer,
            BackupDisk::Kopia => wings_api::BackupAdapter::Kopia,
        }
    }
}

pub struct ServerBackupRestoreOptions {
    pub truncate_directory: bool,
    pub restore_startup: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GroupRotationOutcome {
    /// The group has no `retention_count`, so count-based rotation does not apply.
    NotConfigured,
    /// The group is still under its `retention_count`; nothing was evicted.
    WithinRetention,
    /// The oldest unlocked usable backup in the group was evicted to make room.
    Evicted,
    /// The group is at/over `retention_count` but every usable backup is locked.
    BlockedAllLocked,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ServerBackup {
    pub uuid: uuid::Uuid,
    pub server: Option<Fetchable<super::server::Server>>,
    pub node: Fetchable<super::node::Node>,
    pub backup_configuration: Option<Fetchable<super::backup_configuration::BackupConfiguration>>,
    pub backup_group_uuid: Option<uuid::Uuid>,

    pub name: compact_str::CompactString,
    pub successful: bool,
    pub browsable: bool,
    pub streaming: bool,
    pub locked: bool,
    pub shared: bool,

    pub ignored_files: Vec<compact_str::CompactString>,
    pub checksum: Option<compact_str::CompactString>,
    pub bytes: i64,
    pub files: i64,

    pub disk: BackupDisk,
    pub upload_id: Option<compact_str::CompactString>,
    pub upload_path: Option<compact_str::CompactString>,
    pub metadata: serde_json::Value,

    pub completed: Option<chrono::NaiveDateTime>,
    pub deleting: Option<chrono::NaiveDateTime>,
    pub deletion_retries: i32,
    pub deleted: Option<chrono::NaiveDateTime>,
    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

#[derive(Debug, ToSchema, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ServerBackupDeletionStatus {
    Deleting,
    Failed,
}

impl BaseModel for ServerBackup {
    const NAME: &'static str = "server_backup";

    fn get_extension_list() -> &'static super::ModelExtensionList {
        static EXTENSIONS: LazyLock<super::ModelExtensionList> =
            LazyLock::new(|| parking_lot::RwLock::new(Vec::new()));

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
                "server_backups.backup_group_uuid",
                compact_str::format_compact!("{prefix}backup_group_uuid"),
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
                "server_backups.shared",
                compact_str::format_compact!("{prefix}shared"),
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
                "server_backups.metadata",
                compact_str::format_compact!("{prefix}metadata"),
            ),
            (
                "server_backups.completed",
                compact_str::format_compact!("{prefix}completed"),
            ),
            (
                "server_backups.deleting",
                compact_str::format_compact!("{prefix}deleting"),
            ),
            (
                "server_backups.deletion_retries",
                compact_str::format_compact!("{prefix}deletion_retries"),
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
            backup_group_uuid: row
                .try_get(compact_str::format_compact!("{prefix}backup_group_uuid").as_str())?,
            name: row.try_get(compact_str::format_compact!("{prefix}name").as_str())?,
            successful: row.try_get(compact_str::format_compact!("{prefix}successful").as_str())?,
            browsable: row.try_get(compact_str::format_compact!("{prefix}browsable").as_str())?,
            streaming: row.try_get(compact_str::format_compact!("{prefix}streaming").as_str())?,
            locked: row.try_get(compact_str::format_compact!("{prefix}locked").as_str())?,
            shared: row.try_get(compact_str::format_compact!("{prefix}shared").as_str())?,
            ignored_files: row
                .try_get(compact_str::format_compact!("{prefix}ignored_files").as_str())?,
            checksum: row.try_get(compact_str::format_compact!("{prefix}checksum").as_str())?,
            bytes: row.try_get(compact_str::format_compact!("{prefix}bytes").as_str())?,
            files: row.try_get(compact_str::format_compact!("{prefix}files").as_str())?,
            disk: row.try_get(compact_str::format_compact!("{prefix}disk").as_str())?,
            upload_id: row.try_get(compact_str::format_compact!("{prefix}upload_id").as_str())?,
            upload_path: row
                .try_get(compact_str::format_compact!("{prefix}upload_path").as_str())?,
            metadata: row.try_get(compact_str::format_compact!("{prefix}metadata").as_str())?,
            completed: row.try_get(compact_str::format_compact!("{prefix}completed").as_str())?,
            deleting: row.try_get(compact_str::format_compact!("{prefix}deleting").as_str())?,
            deletion_retries: row
                .try_get(compact_str::format_compact!("{prefix}deletion_retries").as_str())?,
            deleted: row.try_get(compact_str::format_compact!("{prefix}deleted").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl ServerBackup {
    pub async fn create_raw(
        state: &crate::State,
        mut options: CreateServerBackupOptions<'_>,
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

        let mut transaction = state.database.write().begin().await?;

        let mut query_builder = InsertQueryBuilder::new("server_backups");

        Self::run_create_handlers(&mut options, &mut query_builder, state, &mut transaction)
            .await?;

        query_builder
            .set("server_uuid", options.server.uuid)
            .set("node_uuid", options.server.node.uuid)
            .set("backup_configuration_uuid", backup_configuration.uuid)
            .set("backup_group_uuid", options.backup_group_uuid)
            .set("name", &options.name)
            .set("ignored_files", &options.ignored_files)
            .set("bytes", 0i64)
            .set("disk", backup_configuration.backup_disk)
            .set("shared", backup_configuration.shared)
            .set("metadata", &options.metadata);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut *transaction)
            .await?;
        let mut backup = Self::map(None, &row)?;

        Self::run_after_create_handlers(&mut backup, &options, state, &mut transaction).await?;

        transaction.commit().await?;

        Ok(backup)
    }

    pub async fn by_server_uuid_uuid(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM server_backups
            WHERE server_backups.server_uuid = $1 AND server_backups.uuid = $2
            "#,
            Self::columns_sql(None)
        )))
        .bind(server_uuid)
        .bind(uuid)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn select_completed_by_server_uuid(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
        name: Option<&str>,
        backup_group_uuid: Option<uuid::Uuid>,
        oldest: bool,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM server_backups
            WHERE
                server_backups.server_uuid = $1
                AND server_backups.deleted IS NULL
                AND server_backups.deleting IS NULL
                AND server_backups.completed IS NOT NULL
                AND server_backups.successful
                AND ($2 IS NULL OR server_backups.name = $2)
                AND ($3::uuid IS NULL OR server_backups.backup_group_uuid = $3)
            ORDER BY server_backups.created {}
            LIMIT 1
            "#,
            Self::columns_sql(None),
            if oldest { "ASC" } else { "DESC" }
        )))
        .bind(server_uuid)
        .bind(name)
        .bind(backup_group_uuid)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn by_node_uuid_uuid(
        database: &crate::database::Database,
        node_uuid: uuid::Uuid,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM server_backups
            WHERE server_backups.node_uuid = $1 AND server_backups.uuid = $2
            "#,
            Self::columns_sql(None)
        )))
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

        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
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
        )))
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

        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
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
        )))
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

    pub async fn by_server_uuid_node_uuid_backup_group_uuid_with_pagination(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
        node_uuid: uuid::Uuid,
        backup_group_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM server_backups
            WHERE
                server_backups.server_uuid = $1
                AND server_backups.node_uuid = $2
                AND server_backups.backup_group_uuid = $3
                AND server_backups.deleted IS NULL
                AND ($4 IS NULL OR server_backups.name ILIKE '%' || $4 || '%')
            ORDER BY server_backups.created
            LIMIT $5 OFFSET $6
            "#,
            Self::columns_sql(None)
        )))
        .bind(server_uuid)
        .bind(node_uuid)
        .bind(backup_group_uuid)
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

    pub async fn by_ungrouped_server_uuid_node_uuid_with_pagination(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
        node_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM server_backups
            WHERE
                server_backups.server_uuid = $1
                AND server_backups.node_uuid = $2
                AND server_backups.backup_group_uuid IS NULL
                AND server_backups.deleted IS NULL
                AND ($3 IS NULL OR server_backups.name ILIKE '%' || $3 || '%')
            ORDER BY server_backups.created
            LIMIT $4 OFFSET $5
            "#,
            Self::columns_sql(None)
        )))
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

        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
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
        )))
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

        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
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
        )))
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

        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
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
        )))
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

        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
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
        )))
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

    pub async fn all_uuids_by_server_uuid_not_shared(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
    ) -> Result<Vec<uuid::Uuid>, crate::database::DatabaseError> {
        let rows = sqlx::query(
            r#"
            SELECT server_backups.uuid
            FROM server_backups
            WHERE server_backups.server_uuid = $1 AND server_backups.deleted IS NULL AND server_backups.shared = false
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
        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM server_backups
            WHERE server_backups.server_uuid = $1 AND server_backups.deleted IS NULL
            "#,
            Self::columns_sql(None)
        )))
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
    ) -> Result<i64, sqlx::Error> {
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
    }

    pub async fn generate_metadata(
        state: &crate::State,
        server: &super::server::Server,
    ) -> Result<serde_json::Value, anyhow::Error> {
        let mut variables = serde_json::Map::new();

        for variable in ServerVariable::all_by_server_uuid_egg_uuid(
            &state.database,
            server.uuid,
            server.egg.uuid,
        )
        .await?
        {
            variables.insert(variable.variable.env_variable.into(), variable.value.into());
        }

        Ok(serde_json::json!({
            "startup": server.startup,
            "image": server.image,
            "variables": variables,
        }))
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

            let (client, bucket) = s3_configuration.into_client();

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

            let presigning_config = aws_sdk_s3::presigning::PresigningConfig::expires_in(
                std::time::Duration::from_mins(15),
            )?;
            let presigned = client
                .get_object()
                .bucket(bucket)
                .key(&**file_path)
                .presigned(presigning_config)
                .await?;

            return Ok(presigned.uri().to_string());
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
                    scope: "backup-download".into(),
                    issuer: "panel".into(),
                    subject: None,
                    audience: Vec::new(),
                    expiration_time: Some(chrono::Utc::now().timestamp() + 900),
                    not_before: None,
                    issued_at: Some(chrono::Utc::now().timestamp()),
                    jwt_id: user.uuid.to_compact_string(),
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
        state: &crate::State,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        mut server: super::server::Server,
        options: ServerBackupRestoreOptions,
    ) -> Result<(), anyhow::Error> {
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

        if options.restore_startup {
            self.restore_startup(state, transaction, &mut server)
                .await?;
        }

        server
            .node
            .fetch_cached(&state.database)
            .await?
            .api_client(&state.database)
            .await?
            .post_servers_server_backup_backup_restore(
                server.uuid,
                self.uuid,
                &wings_api::servers_server_backup_backup_restore::post::RequestBody {
                    adapter: self.disk.to_wings_adapter(),
                    download_url: self.wings_restore_download_url(state, server.uuid).await?,
                    truncate_directory: options.truncate_directory,
                },
            )
            .await?;

        Self::get_event_emitter().emit(
            state.clone(),
            ServerBackupEvent::RestoreStarted {
                backup: Box::new(self),
                server: Box::new(server),
            },
        );

        Ok(())
    }

    pub async fn restore_startup(
        &self,
        state: &crate::State,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        server: &mut super::server::Server,
    ) -> Result<(), anyhow::Error> {
        let startup_cmd = self
            .metadata
            .get("startup")
            .and_then(|v| v.as_str())
            .map(|s| s.to_compact_string());
        let image_str = self
            .metadata
            .get("image")
            .and_then(|v| v.as_str())
            .map(|s| s.to_compact_string());
        let variables = self
            .metadata
            .get("variables")
            .and_then(|v| v.as_object())
            .cloned()
            .unwrap_or_default();

        if let Some(startup) = startup_cmd
            && let Ok(egg_config) = server.egg.configuration(&state.database).await
        {
            let is_predefined = server
                .egg
                .startup_commands
                .values()
                .any(|cmd| cmd == startup.as_str());
            let custom_allowed = egg_config
                .config_startup
                .as_ref()
                .is_some_and(|c| c.allow_custom_startup_command);
            if is_predefined || custom_allowed {
                server
                    .update_with_transaction(
                        state,
                        super::server::UpdateServerOptions {
                            startup: Some(startup),
                            ..Default::default()
                        },
                        transaction,
                    )
                    .await?;
            }
        }

        if let Some(image) = image_str {
            let is_valid_image = server
                .egg
                .docker_images
                .values()
                .any(|img| img == image.as_str());
            if is_valid_image {
                let current_is_custom = !server
                    .egg
                    .docker_images
                    .values()
                    .any(|img| img == server.image.as_str());
                let allow_overwrite = state
                    .settings
                    .get()
                    .await
                    .map(|s| s.server.allow_overwriting_custom_docker_image)
                    .unwrap_or(false);
                if !current_is_custom || allow_overwrite {
                    server
                        .update_with_transaction(
                            state,
                            super::server::UpdateServerOptions {
                                image: Some(image),
                                ..Default::default()
                            },
                            transaction,
                        )
                        .await?;
                }
            }
        }

        if !variables.is_empty() {
            let existing_variables = ServerVariable::all_by_server_uuid_egg_uuid(
                &state.database,
                server.uuid,
                server.egg.uuid,
            )
            .await?;

            let mut validator_variables = HashMap::new();
            for variable in existing_variables.iter() {
                validator_variables.insert(
                    variable.variable.env_variable.as_str(),
                    (
                        variable.variable.rules.as_slice(),
                        if let Some(value) = variables
                            .iter()
                            .find(|v| v.0 == variable.variable.env_variable)
                            && variable.variable.user_editable
                            && let Some(value) = value.1.as_str()
                        {
                            value
                        } else {
                            variable.value.as_str()
                        },
                    ),
                );
            }

            let validator = match rule_validator::Validator::new(validator_variables) {
                Ok(validator) => validator,
                Err(error) => {
                    return Err(crate::response::DisplayError::new(error)
                        .with_status(StatusCode::EXPECTATION_FAILED)
                        .into());
                }
            };
            if let Err(error) = validator.validate() {
                return Err(crate::response::DisplayError::new(error)
                    .with_status(StatusCode::EXPECTATION_FAILED)
                    .into());
            }

            for (env_var, value) in &variables {
                let Some(value) = value.as_str() else {
                    continue;
                };
                let variable_uuid = match existing_variables
                    .iter()
                    .find(|v| v.variable.env_variable == env_var)
                {
                    Some(variable) if variable.variable.user_editable => variable.variable.uuid,
                    _ => continue,
                };

                ServerVariable::create_with_transaction(
                    transaction,
                    server.uuid,
                    variable_uuid,
                    value,
                )
                .await?;
            }
        }

        Ok(())
    }

    pub async fn wings_restore_download_url(
        &self,
        state: &crate::State,
        server_uuid: uuid::Uuid,
    ) -> Result<Option<compact_str::CompactString>, anyhow::Error> {
        if !matches!(self.disk, BackupDisk::S3) {
            return Ok(None);
        }

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

        let Some(mut s3_configuration) = backup_configuration.backup_configs.s3 else {
            return Ok(None);
        };

        s3_configuration.decrypt(&state.database).await?;

        let compression_type = s3_configuration.compression_type;
        let (client, bucket) = s3_configuration.into_client();

        let file_path = match &self.upload_path {
            Some(path) => path.as_str(),
            None => &Self::s3_path(server_uuid, self.uuid, compression_type),
        };

        let presigning_config = aws_sdk_s3::presigning::PresigningConfig::expires_in(
            std::time::Duration::from_mins(60),
        )?;
        let presigned = client
            .get_object()
            .bucket(bucket)
            .key(file_path)
            .presigned(presigning_config)
            .await?;

        Ok(Some(presigned.uri().to_compact_string()))
    }

    pub async fn export(
        &self,
        state: &crate::State,
        server: &super::server::Server,
        path: compact_str::CompactString,
        archive_format: wings_api::StreamableArchiveFormat,
        foreground: bool,
    ) -> Result<wings_api::backups_backup_export::post::Response, anyhow::Error> {
        let backup_configuration = self
            .backup_configuration
            .as_ref()
            .ok_or_else(|| {
                crate::response::DisplayError::new(
                    "no backup configuration available, unable to export backup",
                )
                .with_status(StatusCode::EXPECTATION_FAILED)
            })?
            .fetch_cached(&state.database)
            .await?;

        if backup_configuration.maintenance_enabled {
            return Err(crate::response::DisplayError::new(
                "cannot export backup while backup configuration is in maintenance mode",
            )
            .with_status(StatusCode::EXPECTATION_FAILED)
            .into());
        }

        let client = server
            .node
            .fetch_cached(&state.database)
            .await?
            .api_client(&state.database)
            .await?;

        match client
            .post_backups_backup_export(
                self.uuid,
                &wings_api::backups_backup_export::post::RequestBody {
                    adapter: self.disk.to_wings_adapter(),
                    server: server.uuid,
                    path,
                    archive_format,
                    foreground,
                },
            )
            .await
        {
            Ok(response) => Ok(response),
            Err(wings_api::client::ApiHttpError::Http(
                status @ (StatusCode::NOT_FOUND | StatusCode::EXPECTATION_FAILED),
                err,
            )) => Err(crate::response::DisplayError::new(
                crate::ApiError::new_wings_value(err).to_string(),
            )
            .with_status(status)
            .into()),
            Err(err) => Err(err.into()),
        }
    }

    pub async fn query(
        &self,
        state: &crate::State,
        node: &super::node::Node,
    ) -> Result<wings_api::backups_backup_query::get::Response, anyhow::Error> {
        let client = node.api_client(&state.database).await?;

        match client
            .get_backups_backup_query(
                self.uuid,
                &wings_api::backups_backup_query::get::Query {
                    adapter: Some(self.disk.to_wings_adapter()),
                    __priv: (),
                },
            )
            .await
        {
            Ok(response) => Ok(response),
            Err(wings_api::client::ApiHttpError::Http(StatusCode::NOT_FOUND, err)) => {
                Err(crate::response::DisplayError::new(
                    crate::ApiError::new_wings_value(err).to_string(),
                )
                .with_status(StatusCode::NOT_FOUND)
                .into())
            }
            Err(err) => Err(err.into()),
        }
    }

    pub async fn evict_one_by_server_uuid(
        state: &crate::State,
        server: &super::server::Server,
    ) -> Result<(), anyhow::Error> {
        let row = sqlx::query(
            r#"
            SELECT candidates.uuid, candidates.tier, candidates.group_name
            FROM (
                SELECT
                    server_backups.uuid,
                    server_backups.created,
                    (CASE
                        WHEN NOT server_backups.successful THEN 0
                        WHEN g.retention_count IS NOT NULL AND (
                            SELECT COUNT(*)
                            FROM server_backups b2
                            WHERE b2.backup_group_uuid = server_backups.backup_group_uuid
                                AND b2.deleted IS NULL
                                AND b2.deleting IS NULL
                                AND b2.successful
                                AND b2.completed IS NOT NULL
                                AND b2.created >= server_backups.created
                        ) > g.retention_count THEN 1
                        WHEN server_backups.backup_group_uuid IS NULL THEN 2
                        ELSE 3
                    END) AS tier,
                    g.name AS group_name
                FROM server_backups
                LEFT JOIN server_backup_groups g ON g.uuid = server_backups.backup_group_uuid
                WHERE server_backups.server_uuid = $1
                    AND server_backups.locked = false
                    AND server_backups.completed IS NOT NULL
                    AND server_backups.deleted IS NULL
                    AND server_backups.deleting IS NULL
            ) candidates
            ORDER BY candidates.tier ASC, candidates.created ASC
            LIMIT 1
            "#,
        )
        .bind(server.uuid)
        .fetch_optional(state.database.read())
        .await?;

        let Some(row) = row else {
            return Err(sqlx::Error::RowNotFound.into());
        };

        let row_uuid: uuid::Uuid = row.try_get("uuid")?;
        let row_tier: i32 = row.try_get("tier")?;
        let row_group_name: Option<String> = row.try_get("group_name")?;

        let rule = match row_tier {
            0 => "failed",
            1 => "over-retention",
            2 => "ungrouped",
            _ => "in-retention",
        };

        if row_tier == 3 {
            tracing::warn!(
                server = %server.uuid,
                backup = %row_uuid,
                group = ?row_group_name,
                "evicting an in-retention grouped backup to satisfy backup_limit; retention quota exceeds backup_limit"
            );
        }

        let Some(backup) =
            Self::by_server_uuid_uuid(&state.database, server.uuid, row_uuid).await?
        else {
            return Err(sqlx::Error::RowNotFound.into());
        };

        backup.delete(state, Default::default()).await?;

        Self::log_eviction_activity(
            state,
            server.uuid,
            backup.uuid,
            &backup.name,
            rule,
            row_group_name.as_deref(),
        )
        .await;

        Ok(())
    }

    pub async fn rotate_group_for_create(
        state: &crate::State,
        group: &super::server_backup_group::ServerBackupGroup,
    ) -> Result<GroupRotationOutcome, anyhow::Error> {
        let Some(retention_count) = group.retention_count else {
            return Ok(GroupRotationOutcome::NotConfigured);
        };

        let row = sqlx::query(
            r#"
            SELECT
                (SELECT COUNT(*)
                    FROM server_backups
                    WHERE server_backups.backup_group_uuid = $1
                        AND server_backups.deleted IS NULL
                        AND server_backups.deleting IS NULL
                        AND server_backups.successful
                        AND server_backups.completed IS NOT NULL) AS usable,
                (SELECT server_backups.uuid
                    FROM server_backups
                    WHERE server_backups.backup_group_uuid = $1
                        AND server_backups.deleted IS NULL
                        AND server_backups.deleting IS NULL
                        AND server_backups.successful
                        AND server_backups.completed IS NOT NULL
                        AND server_backups.locked = false
                    ORDER BY server_backups.created ASC
                    LIMIT 1) AS oldest_unlocked
            "#,
        )
        .bind(group.uuid)
        .fetch_one(state.database.read())
        .await?;

        let usable: i64 = row.try_get("usable")?;
        let oldest_unlocked: Option<uuid::Uuid> = row.try_get("oldest_unlocked")?;

        if usable < retention_count as i64 {
            return Ok(GroupRotationOutcome::WithinRetention);
        }

        let Some(oldest_unlocked) = oldest_unlocked else {
            return Ok(GroupRotationOutcome::BlockedAllLocked);
        };

        let Some(backup) =
            Self::by_server_uuid_uuid(&state.database, group.server_uuid, oldest_unlocked).await?
        else {
            return Ok(GroupRotationOutcome::WithinRetention);
        };

        backup.delete(state, Default::default()).await?;

        Self::log_eviction_activity(
            state,
            group.server_uuid,
            backup.uuid,
            &backup.name,
            "group-rotation",
            Some(group.name.as_str()),
        )
        .await;

        Ok(GroupRotationOutcome::Evicted)
    }

    pub async fn prune_expired_group_backups(state: &crate::State) -> Result<u64, anyhow::Error> {
        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}, g.name AS group_name
            FROM server_backups
            JOIN server_backup_groups g ON g.uuid = server_backups.backup_group_uuid
            WHERE g.retention_days IS NOT NULL
                AND server_backups.deleted IS NULL
                AND server_backups.deleting IS NULL
                AND server_backups.locked = false
                AND server_backups.completed IS NOT NULL
                AND server_backups.created < NOW() - make_interval(days => g.retention_days)
            "#,
            Self::columns_sql(None)
        )))
        .fetch_all(state.database.read())
        .await?;

        let mut pruned = 0;
        for row in rows {
            let group_name: compact_str::CompactString = row.try_get("group_name")?;
            let server_uuid: Option<uuid::Uuid> = row.try_get("server_uuid")?;
            let backup = Self::map(None, &row)?;

            if let Err(err) = backup.delete(state, Default::default()).await {
                tracing::error!(
                    backup = %backup.uuid,
                    "failed to prune expired group backup: {:#?}",
                    err
                );
                continue;
            }

            if let Some(server_uuid) = server_uuid {
                Self::log_eviction_activity(
                    state,
                    server_uuid,
                    backup.uuid,
                    &backup.name,
                    "retention-days",
                    Some(group_name.as_str()),
                )
                .await;
            }

            pruned += 1;
        }

        Ok(pruned)
    }

    async fn log_eviction_activity(
        state: &crate::State,
        server_uuid: uuid::Uuid,
        backup_uuid: uuid::Uuid,
        backup_name: &str,
        rule: &str,
        group_name: Option<&str>,
    ) {
        if let Err(err) = super::server_activity::ServerActivity::create(
            state,
            super::server_activity::CreateServerActivityOptions {
                server_uuid,
                user_uuid: None,
                impersonator_uuid: None,
                api_key_uuid: None,
                schedule_uuid: None,
                event: "server:backup.delete".into(),
                ip: None,
                data: serde_json::json!({
                    "source": "eviction",
                    "uuid": backup_uuid,
                    "name": backup_name,
                    "rule": rule,
                    "group": group_name,
                }),
                created: None,
            },
        )
        .await
        {
            tracing::warn!(
                server = %server_uuid,
                "failed to log backup eviction activity: {:#?}",
                err
            );
        }
    }

    #[inline]
    pub fn default_name() -> compact_str::CompactString {
        let now = chrono::Local::now();

        now.format("%Y-%m-%d %H:%M:%S %z").to_compact_string()
    }

    #[inline]
    pub fn s3_path(
        server_uuid: uuid::Uuid,
        backup_uuid: uuid::Uuid,
        compression_type: wings_api::CompressionType,
    ) -> compact_str::CompactString {
        compact_str::format_compact!(
            "{server_uuid}/{backup_uuid}.tar{}",
            match compression_type {
                wings_api::CompressionType::None => "",
                wings_api::CompressionType::Gz => ".gz",
                wings_api::CompressionType::Xz => ".xz",
                wings_api::CompressionType::Lzip => ".lz",
                wings_api::CompressionType::Bz2 => ".bz2",
                wings_api::CompressionType::Lz4 => ".lz4",
                wings_api::CompressionType::Zstd => ".zst",
            }
        )
    }

    #[inline]
    pub fn s3_content_type(name: &str) -> &'static str {
        if name.ends_with("tar") {
            "application/x-tar"
        } else if name.ends_with(".tar.gz") {
            "application/x-gzip"
        } else if name.ends_with(".tar.xz") {
            "application/x-xz"
        } else if name.ends_with(".tar.lz") {
            "application/x-lzip"
        } else if name.ends_with(".tar.bz2") {
            "application/x-bzip2"
        } else if name.ends_with(".tar.lz4") {
            "application/x-lz4"
        } else if name.ends_with(".tar.zst") {
            "application/zstd"
        } else {
            "application/octet-stream"
        }
    }

    pub async fn into_admin_node_api_object(
        self,
        state: &crate::State,
        storage_url_retriever: &StorageUrlRetriever<'_>,
    ) -> Result<AdminApiNodeServerBackup, crate::database::DatabaseError> {
        let deletion_status = self.deletion_status();

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
            backup_group_uuid: self.backup_group_uuid,
            name: self.name,
            ignored_files: self.ignored_files,
            is_successful: self.successful,
            is_locked: self.locked,
            is_browsable: self.browsable,
            is_streaming: self.streaming,
            is_shared: self.shared,
            checksum: self.checksum,
            bytes: self.bytes,
            files: self.files,
            deletion_status,
            metadata: self.metadata,
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
        let deletion_status = self.deletion_status();
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
                backup_group_uuid: self.backup_group_uuid,
                name: self.name,
                ignored_files: self.ignored_files,
                is_successful: self.successful,
                is_locked: self.locked,
                is_browsable: self.browsable,
                is_streaming: self.streaming,
                is_shared: self.shared,
                checksum: self.checksum,
                bytes: self.bytes,
                files: self.files,
                deletion_status,
                metadata: self.metadata,
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
        let deletion_status = self.deletion_status();
        let api_object = ApiServerBackup::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            ApiServerBackup {
                uuid: self.uuid,
                backup_group_uuid: self.backup_group_uuid,
                name: self.name,
                ignored_files: self.ignored_files,
                is_successful: self.successful,
                is_locked: self.locked,
                is_browsable: self.browsable,
                is_streaming: self.streaming,
                checksum: self.checksum,
                bytes: self.bytes,
                files: self.files,
                deletion_status,
                metadata: self.metadata,
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
    pub backup_group_uuid: Option<uuid::Uuid>,
    #[garde(skip)]
    pub ignored_files: Vec<compact_str::CompactString>,
    #[garde(skip)]
    pub metadata: serde_json::Value,
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

    async fn create_with_transaction(
        _state: &crate::State,
        _options: Self::CreateOptions<'_>,
        _transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self, crate::database::DatabaseError> {
        Err(anyhow::anyhow!("create_with_transaction is not supported for ServerBackup").into())
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
            .set("backup_group_uuid", options.backup_group_uuid)
            .set("name", &options.name)
            .set("ignored_files", &options.ignored_files)
            .set("bytes", 0i64)
            .set("disk", backup_configuration.backup_disk)
            .set("shared", backup_configuration.shared)
            .set("metadata", &options.metadata);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut *transaction)
            .await?;
        let mut backup = Self::map(None, &row)?;

        Self::run_after_create_handlers(&mut backup, &options, state, &mut transaction).await?;

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
    #[serde(default, with = "::serde_with::rust::double_option")]
    pub backup_group_uuid: Option<Option<uuid::Uuid>>,
    #[garde(skip)]
    pub locked: Option<bool>,
}

#[async_trait::async_trait]
impl UpdatableModel for ServerBackup {
    type UpdateOptions = UpdateServerBackupOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateHandlerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateHandlerList<ServerBackup>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &UPDATE_LISTENERS
    }

    async fn update_with_transaction(
        &mut self,
        state: &crate::State,
        mut options: Self::UpdateOptions,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<(), crate::database::DatabaseError> {
        options.validate()?;

        let mut query_builder = UpdateQueryBuilder::new("server_backups");

        self.run_update_handlers(&mut options, &mut query_builder, state, transaction)
            .await?;

        query_builder
            .set("name", options.name.as_ref())
            .set("backup_group_uuid", options.backup_group_uuid)
            .set("locked", options.locked)
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut **transaction).await?;

        if let Some(name) = options.name {
            self.name = name;
        }
        if let Some(backup_group_uuid) = options.backup_group_uuid {
            self.backup_group_uuid = backup_group_uuid;
        }
        if let Some(locked) = options.locked {
            self.locked = locked;
        }

        self.run_after_update_handlers(state, transaction).await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl ByUuid for ServerBackup {
    async fn by_uuid(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
    ) -> Result<Self, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM server_backups
            WHERE server_backups.uuid = $1
            "#,
            Self::columns_sql(None)
        )))
        .bind(uuid)
        .fetch_one(database.read())
        .await?;

        Self::map(None, &row)
    }

    async fn by_uuid_with_transaction(
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        uuid: uuid::Uuid,
    ) -> Result<Self, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM server_backups
            WHERE server_backups.uuid = $1
            "#,
            Self::columns_sql(None)
        )))
        .bind(uuid)
        .fetch_one(&mut **transaction)
        .await?;

        Self::map(None, &row)
    }
}

#[derive(Clone, Default)]
pub struct DeleteServerBackupOptions {
    pub force: bool,
}

impl ServerBackup {
    pub const MAX_DELETION_RETRIES: i32 = 8;

    #[inline]
    pub fn deletion_status(&self) -> Option<ServerBackupDeletionStatus> {
        if self.deleted.is_some() || self.deleting.is_none() {
            return None;
        }

        if self.deletion_retries >= Self::MAX_DELETION_RETRIES {
            Some(ServerBackupDeletionStatus::Failed)
        } else {
            Some(ServerBackupDeletionStatus::Deleting)
        }
    }

    pub async fn dispatch_deletion(
        &self,
        state: &crate::State,
        options: &DeleteServerBackupOptions,
    ) -> Result<bool, anyhow::Error> {
        let node = self.node.fetch_cached(&state.database).await?;

        let backup_configuration = match &self.backup_configuration {
            Some(backup_configuration) => {
                Some(backup_configuration.fetch_cached(&state.database).await?)
            }
            None if options.force => None,
            None => {
                return Err(crate::response::DisplayError::new(
                    "no backup configuration available, unable to delete backup",
                )
                .with_status(StatusCode::EXPECTATION_FAILED)
                .into());
            }
        };

        if let Some(backup_configuration) = &backup_configuration
            && backup_configuration.maintenance_enabled
        {
            return Err(crate::response::DisplayError::new(
                "cannot delete backup while backup configuration is in maintenance mode",
            )
            .with_status(StatusCode::EXPECTATION_FAILED)
            .into());
        }

        if self.disk == BackupDisk::S3 {
            let Some(mut s3_configuration) =
                backup_configuration.and_then(|c| c.backup_configs.s3.clone())
            else {
                if options.force {
                    tracing::warn!(server = ?self.server.as_ref().map(|s| s.uuid), backup = %self.uuid, "S3 backup deletion attempted but no S3 configuration found, ignoring");

                    return Ok(true);
                }

                return Err(anyhow::anyhow!(
                    "s3 backup deletion attempted but no S3 configuration found"
                ));
            };

            s3_configuration.decrypt(&state.database).await?;

            let compression_type = s3_configuration.compression_type;
            let (client, bucket) = s3_configuration.into_client();

            let file_path = match &self.upload_path {
                Some(path) => path,
                None => {
                    if let Some(server) = &self.server {
                        &Self::s3_path(server.uuid, self.uuid, compression_type)
                    } else {
                        return Err(anyhow::anyhow!("backup upload path not found"));
                    }
                }
            };

            if let Err(err) = client
                .delete_object()
                .bucket(bucket)
                .key(&**file_path)
                .send()
                .await
            {
                if options.force {
                    tracing::error!(server = ?self.server.as_ref().map(|s| s.uuid), backup = %self.uuid, "failed to delete S3 backup, ignoring: {:?}", err);
                } else {
                    return Err(err.into());
                }
            }

            return Ok(true);
        }

        match node
            .api_client(&state.database)
            .await?
            .delete_backups_backup(
                self.uuid,
                &wings_api::backups_backup::delete::RequestBody {
                    adapter: self.disk.to_wings_adapter(),
                    foreground: false,
                    server: self.server.as_ref().map(|s| s.uuid),
                },
            )
            .await
        {
            Ok(_) => Ok(false),
            Err(wings_api::client::ApiHttpError::Http(StatusCode::NOT_FOUND, _)) => Ok(true),
            Err(err) if options.force => {
                tracing::error!(node = %node.uuid, backup = %self.uuid, "unable to delete backup on node, finalizing anyway: {:?}", err);

                Ok(true)
            }
            Err(err) => Err(err.into()),
        }
    }

    pub async fn finish_deletion(
        &self,
        state: &crate::State,
        options: &DeleteServerBackupOptions,
    ) -> Result<(), anyhow::Error> {
        let mut transaction = state.database.write().begin().await?;

        let finalized = sqlx::query(
            r#"
            UPDATE server_backups
            SET deleted = NOW(), deleting = NULL
            WHERE server_backups.uuid = $1 AND server_backups.deleted IS NULL
            "#,
        )
        .bind(self.uuid)
        .execute(&mut *transaction)
        .await?
        .rows_affected();

        if finalized == 0 {
            return Ok(());
        }

        self.run_after_delete_handlers(options, state, &mut transaction)
            .await?;

        transaction.commit().await?;

        Self::get_event_emitter().emit(
            state.clone(),
            ServerBackupEvent::DeletionCompleted {
                backup: Box::new(self.clone()),
                successful: true,
            },
        );

        Ok(())
    }

    pub async fn fail_deletion_attempt(&self, state: &crate::State) -> Result<i32, anyhow::Error> {
        let deletion_retries: Option<i32> = sqlx::query_scalar(
            r#"
            UPDATE server_backups
            SET deletion_retries = deletion_retries + 1
            WHERE
                server_backups.uuid = $1
                AND server_backups.deleted IS NULL
                AND server_backups.deleting IS NOT NULL
            RETURNING server_backups.deletion_retries
            "#,
        )
        .bind(self.uuid)
        .fetch_optional(state.database.write())
        .await?;

        let Some(deletion_retries) = deletion_retries else {
            return Ok(0);
        };

        if deletion_retries >= Self::MAX_DELETION_RETRIES {
            if let Some(server) = &self.server
                && let Err(err) = super::server_activity::ServerActivity::create(
                    state,
                    super::server_activity::CreateServerActivityOptions {
                        server_uuid: server.uuid,
                        user_uuid: None,
                        impersonator_uuid: None,
                        api_key_uuid: None,
                        schedule_uuid: None,
                        event: "server:backup.delete-failed".into(),
                        ip: None,
                        data: serde_json::json!({
                            "uuid": self.uuid,
                            "name": self.name,
                        }),
                        created: None,
                    },
                )
                .await
            {
                tracing::warn!(
                    backup = %self.uuid,
                    "failed to log backup deletion failure activity: {:#?}",
                    err
                );
            }

            Self::get_event_emitter().emit(
                state.clone(),
                ServerBackupEvent::DeletionCompleted {
                    backup: Box::new(self.clone()),
                    successful: false,
                },
            );
        }

        Ok(deletion_retries)
    }

    pub async fn redispatch_stale_deletions(state: &crate::State) -> Result<u64, anyhow::Error> {
        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM server_backups
            WHERE
                server_backups.deleted IS NULL
                AND server_backups.deleting IS NOT NULL
                AND server_backups.deletion_retries < $1
                AND server_backups.deleting < NOW() - make_interval(mins => LEAST(60.0, 5.0 * POWER(2.0, server_backups.deletion_retries))::int)
            ORDER BY server_backups.deleting
            LIMIT 32
            "#,
            Self::columns_sql(None)
        )))
        .bind(Self::MAX_DELETION_RETRIES)
        .fetch_all(state.database.read())
        .await?;

        let mut redispatched = 0;
        for row in rows {
            let backup = Self::map(None, &row)?;

            if let Some(backup_configuration) = &backup.backup_configuration
                && let Ok(backup_configuration) =
                    backup_configuration.fetch_cached(&state.database).await
                && backup_configuration.maintenance_enabled
            {
                sqlx::query(
                    "UPDATE server_backups
                    SET deleting = NOW()
                    WHERE server_backups.uuid = $1 AND server_backups.deleted IS NULL",
                )
                .bind(backup.uuid)
                .execute(state.database.write())
                .await?;

                continue;
            }

            let deletion_retries: i32 = sqlx::query_scalar(
                r#"
                UPDATE server_backups
                SET deleting = NOW(), deletion_retries = deletion_retries + 1
                WHERE server_backups.uuid = $1 AND server_backups.deleted IS NULL
                RETURNING server_backups.deletion_retries
                "#,
            )
            .bind(backup.uuid)
            .fetch_one(state.database.write())
            .await?;

            match backup
                .dispatch_deletion(state, &DeleteServerBackupOptions::default())
                .await
            {
                Ok(true) => {
                    backup
                        .finish_deletion(state, &DeleteServerBackupOptions::default())
                        .await?;
                }
                Ok(false) => {}
                Err(err) => {
                    tracing::error!(
                        backup = %backup.uuid,
                        deletion_retries,
                        "failed to redispatch backup deletion: {:#?}",
                        err
                    );

                    if deletion_retries >= Self::MAX_DELETION_RETRIES {
                        Self::get_event_emitter().emit(
                            state.clone(),
                            ServerBackupEvent::DeletionCompleted {
                                backup: Box::new(backup.clone()),
                                successful: false,
                            },
                        );
                    }

                    continue;
                }
            }

            redispatched += 1;
        }

        Ok(redispatched)
    }
}

#[async_trait::async_trait]
impl DeletableModel for ServerBackup {
    type DeleteOptions = DeleteServerBackupOptions;

    fn get_delete_handlers() -> &'static LazyLock<DeleteHandlerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteHandlerList<ServerBackup>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &DELETE_LISTENERS
    }

    async fn delete_with_transaction(
        &self,
        _state: &crate::State,
        _options: Self::DeleteOptions,
        _transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<(), anyhow::Error> {
        Err(anyhow::anyhow!(
            "delete_with_transaction is not supported for ServerBackup"
        ))
    }

    async fn delete(
        &self,
        state: &crate::State,
        options: Self::DeleteOptions,
    ) -> Result<(), anyhow::Error> {
        if let Some(backup_configuration) = &self.backup_configuration
            && backup_configuration
                .fetch_cached(&state.database)
                .await?
                .maintenance_enabled
        {
            return Err(crate::response::DisplayError::new(
                "cannot delete backup while backup configuration is in maintenance mode",
            )
            .with_status(StatusCode::EXPECTATION_FAILED)
            .into());
        }

        let mut transaction = state.database.write().begin().await?;

        self.run_delete_handlers(&options, state, &mut transaction)
            .await?;

        let claimed = sqlx::query(
            r#"
            UPDATE server_backups
            SET deleting = NOW(), deletion_retries = 0
            WHERE
                server_backups.uuid = $1
                AND server_backups.deleted IS NULL
                AND (server_backups.deleting IS NULL OR server_backups.deletion_retries >= $2)
            "#,
        )
        .bind(self.uuid)
        .bind(Self::MAX_DELETION_RETRIES)
        .execute(&mut *transaction)
        .await?
        .rows_affected();

        if claimed == 0 {
            return Err(
                crate::response::DisplayError::new("backup is already being deleted")
                    .with_status(StatusCode::EXPECTATION_FAILED)
                    .into(),
            );
        }

        transaction.commit().await?;

        match self.dispatch_deletion(state, &options).await {
            Ok(true) => self.finish_deletion(state, &options).await,
            Ok(false) => Ok(()),
            Err(err) => {
                sqlx::query(
                    r#"
                    UPDATE server_backups
                    SET deleting = NULL, deletion_retries = 0
                    WHERE server_backups.uuid = $1 AND server_backups.deleted IS NULL
                    "#,
                )
                .bind(self.uuid)
                .execute(state.database.write())
                .await?;

                Err(err)
            }
        }
    }
}

#[derive(ToSchema, Serialize)]
#[schema(title = "AdminNodeServerBackup")]
pub struct AdminApiNodeServerBackup {
    pub uuid: uuid::Uuid,
    pub server: Option<super::server::AdminApiServer>,
    pub node: super::node::AdminApiNode,
    pub backup_group_uuid: Option<uuid::Uuid>,

    pub name: compact_str::CompactString,
    pub ignored_files: Vec<compact_str::CompactString>,

    pub is_successful: bool,
    pub is_locked: bool,
    pub is_browsable: bool,
    pub is_streaming: bool,
    pub is_shared: bool,

    pub checksum: Option<compact_str::CompactString>,
    pub bytes: i64,
    pub files: i64,

    pub metadata: serde_json::Value,
    pub deletion_status: Option<ServerBackupDeletionStatus>,

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
    pub backup_group_uuid: Option<uuid::Uuid>,

    pub name: compact_str::CompactString,
    pub ignored_files: Vec<compact_str::CompactString>,

    pub is_successful: bool,
    pub is_locked: bool,
    pub is_browsable: bool,
    pub is_streaming: bool,
    pub is_shared: bool,

    pub checksum: Option<compact_str::CompactString>,
    pub bytes: i64,
    pub files: i64,

    pub metadata: serde_json::Value,
    pub deletion_status: Option<ServerBackupDeletionStatus>,

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
    pub backup_group_uuid: Option<uuid::Uuid>,

    pub name: compact_str::CompactString,
    pub ignored_files: Vec<compact_str::CompactString>,

    pub is_successful: bool,
    pub is_locked: bool,
    pub is_browsable: bool,
    pub is_streaming: bool,

    pub checksum: Option<compact_str::CompactString>,
    pub bytes: i64,
    pub files: i64,

    pub metadata: serde_json::Value,
    pub deletion_status: Option<ServerBackupDeletionStatus>,

    pub completed: Option<chrono::DateTime<chrono::Utc>>,
    pub created: chrono::DateTime<chrono::Utc>,
}
