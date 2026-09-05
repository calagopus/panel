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
    pub fn from_wings_adapter(adapter: wings_api::BackupAdapter) -> Self {
        match adapter {
            wings_api::BackupAdapter::Wings => BackupDisk::Local,
            wings_api::BackupAdapter::S3 => BackupDisk::S3,
            wings_api::BackupAdapter::DdupBak => BackupDisk::DdupBak,
            wings_api::BackupAdapter::Btrfs => BackupDisk::Btrfs,
            wings_api::BackupAdapter::Zfs => BackupDisk::Zfs,
            wings_api::BackupAdapter::Restic => BackupDisk::Restic,
            wings_api::BackupAdapter::ProxmoxBackupServer => BackupDisk::ProxmoxBackupServer,
            wings_api::BackupAdapter::Kopia => BackupDisk::Kopia,
        }
    }

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

#[derive(Debug, ToSchema, Serialize, Deserialize, Type, PartialEq, Eq, Hash, Clone, Copy)]
#[serde(rename_all = "snake_case")]
#[sqlx(type_name = "server_backup_kind", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ServerBackupKind {
    Server,
    DatabaseInstance,
}

pub struct ServerBackupFilter {
    pub kind: Option<ServerBackupKind>,
    pub database_instance_uuid: Option<uuid::Uuid>,
    pub database_type: Option<db_agent_api::DatabaseAgentType>,
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

/// What the backup being evicted belonged to, for the eviction activity log.
#[derive(Debug, Clone, Copy)]
enum EvictionScope<'a> {
    Server,
    Group(&'a str),
    Policy(&'a str),
}

impl<'a> EvictionScope<'a> {
    #[inline]
    fn group_name(self) -> Option<&'a str> {
        match self {
            Self::Group(name) => Some(name),
            _ => None,
        }
    }

    #[inline]
    fn policy_name(self) -> Option<&'a str> {
        match self {
            Self::Policy(name) => Some(name),
            _ => None,
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ServerBackup {
    pub uuid: uuid::Uuid,
    pub server: Option<Fetchable<super::server::Server>>,
    pub node: Fetchable<super::node::Node>,
    pub backup_configuration: Option<Fetchable<super::backup_configuration::BackupConfiguration>>,
    pub backup_group_uuid: Option<uuid::Uuid>,
    pub system_backup_policy_uuid: Option<uuid::Uuid>,
    pub database_instance_uuid: Option<uuid::Uuid>,

    pub kind: ServerBackupKind,
    pub database_type: Option<db_agent_api::DatabaseAgentType>,
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
                "server_backups.system_backup_policy_uuid",
                compact_str::format_compact!("{prefix}system_backup_policy_uuid"),
            ),
            (
                "server_backups.database_instance_uuid",
                compact_str::format_compact!("{prefix}database_instance_uuid"),
            ),
            (
                "server_backups.kind",
                compact_str::format_compact!("{prefix}kind"),
            ),
            (
                "server_backups.database_type",
                compact_str::format_compact!("{prefix}database_type"),
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
            system_backup_policy_uuid: row.try_get(
                compact_str::format_compact!("{prefix}system_backup_policy_uuid").as_str(),
            )?,
            database_instance_uuid: row
                .try_get(compact_str::format_compact!("{prefix}database_instance_uuid").as_str())?,
            kind: row.try_get(compact_str::format_compact!("{prefix}kind").as_str())?,
            database_type: row
                .try_get(compact_str::format_compact!("{prefix}database_type").as_str())?,
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
        let backup_configuration = match options.backup_configuration.take() {
            Some(backup_configuration) => backup_configuration,
            None => options
                .server
                .backup_configuration(&state.database)
                .await
                .ok_or_else(|| {
                    crate::response::DisplayError::new(
                        "no backup configuration available, unable to create backup",
                    )
                    .with_status(StatusCode::EXPECTATION_FAILED)
                })?,
        };

        if backup_configuration.maintenance_enabled {
            return Err(crate::response::DisplayError::new(
                "cannot create backup while backup configuration is in maintenance mode",
            )
            .with_status(StatusCode::EXPECTATION_FAILED)
            .into());
        }

        if options.database_instance.is_some()
            && matches!(
                backup_configuration.backup_disk,
                BackupDisk::Btrfs | BackupDisk::Zfs
            )
        {
            return Err(crate::response::DisplayError::new(
                "database backups cannot be created on a btrfs or zfs backup configuration",
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
            .set(
                "system_backup_policy_uuid",
                options.system_backup_policy_uuid,
            )
            .set(
                "database_instance_uuid",
                options.database_instance.map(|instance| instance.uuid),
            )
            .set("kind", options.kind())
            .set(
                "database_type",
                options.database_instance.map(|instance| instance.r#type),
            )
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
        filter: &ServerBackupFilter,
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
                AND server_backups.system_backup_policy_uuid IS NULL
                AND ($2 IS NULL OR server_backups.name = $2)
                AND ($3::uuid IS NULL OR server_backups.backup_group_uuid = $3)
                AND ($4::server_backup_kind IS NULL OR server_backups.kind = $4)
                AND ($5::uuid IS NULL OR server_backups.database_instance_uuid = $5)
                AND ($6::database_agent_type IS NULL OR server_backups.database_type = $6)
            ORDER BY server_backups.created {}
            LIMIT 1
            "#,
            Self::columns_sql(None),
            if oldest { "ASC" } else { "DESC" }
        )))
        .bind(server_uuid)
        .bind(name)
        .bind(backup_group_uuid)
        .bind(filter.kind)
        .bind(filter.database_instance_uuid)
        .bind(filter.database_type)
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
        filter: &ServerBackupFilter,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM server_backups
            WHERE
                server_backups.server_uuid = $1
                AND server_backups.node_uuid = $2
                AND server_backups.system_backup_policy_uuid IS NULL
                AND server_backups.deleted IS NULL
                AND ($3 IS NULL OR server_backups.name ILIKE '%' || $3 || '%')
                AND ($4::server_backup_kind IS NULL OR server_backups.kind = $4)
                AND ($5::uuid IS NULL OR server_backups.database_instance_uuid = $5)
                AND ($6::database_agent_type IS NULL OR server_backups.database_type = $6)
            ORDER BY server_backups.created
            LIMIT $7 OFFSET $8
            "#,
            Self::columns_sql(None)
        )))
        .bind(server_uuid)
        .bind(node_uuid)
        .bind(search)
        .bind(filter.kind)
        .bind(filter.database_instance_uuid)
        .bind(filter.database_type)
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
        filter: &ServerBackupFilter,
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
                AND server_backups.system_backup_policy_uuid IS NULL
                AND server_backups.deleted IS NULL
                AND ($3 IS NULL OR server_backups.name ILIKE '%' || $3 || '%')
                AND ($4::server_backup_kind IS NULL OR server_backups.kind = $4)
                AND ($5::uuid IS NULL OR server_backups.database_instance_uuid = $5)
                AND ($6::database_agent_type IS NULL OR server_backups.database_type = $6)
            ORDER BY server_backups.created
            LIMIT $7 OFFSET $8
            "#,
            Self::columns_sql(None)
        )))
        .bind(server_uuid)
        .bind(node_uuid)
        .bind(search)
        .bind(filter.kind)
        .bind(filter.database_instance_uuid)
        .bind(filter.database_type)
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

    pub async fn usage_by_server_uuid(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
    ) -> Result<ServerBackupUsage, sqlx::Error> {
        let row = sqlx::query!(
            r#"
            SELECT
                COUNT(*) FILTER (WHERE server_backups.kind = 'SERVER') AS "server!",
                COUNT(*) FILTER (WHERE server_backups.kind = 'DATABASE_INSTANCE') AS "database_instance!"
            FROM server_backups
            WHERE
                server_backups.server_uuid = $1
                AND server_backups.system_backup_policy_uuid IS NULL
                AND server_backups.deleted IS NULL
            "#,
            server_uuid
        )
        .fetch_one(database.read())
        .await?;

        Ok(ServerBackupUsage {
            server: row.server,
            database_instance: row.database_instance,
        })
    }

    pub async fn by_system_server_uuid_node_uuid_with_pagination(
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
                AND server_backups.system_backup_policy_uuid IS NOT NULL
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

    pub async fn by_system_backup_policy_uuid_with_pagination(
        database: &crate::database::Database,
        system_backup_policy_uuid: uuid::Uuid,
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
                server_backups.system_backup_policy_uuid = $1
                AND server_backups.deleted IS NULL
                AND ($2 IS NULL OR server_backups.name ILIKE '%' || $2 || '%')
            ORDER BY server_backups.created
            LIMIT $3 OFFSET $4
            "#,
            Self::columns_sql(None)
        )))
        .bind(system_backup_policy_uuid)
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

    pub async fn all_by_system_backup_policy_uuid(
        database: &crate::database::Database,
        system_backup_policy_uuid: uuid::Uuid,
    ) -> Result<Vec<Self>, crate::database::DatabaseError> {
        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM server_backups
            WHERE
                server_backups.system_backup_policy_uuid = $1
                AND server_backups.deleted IS NULL
            "#,
            Self::columns_sql(None)
        )))
        .bind(system_backup_policy_uuid)
        .fetch_all(database.read())
        .await?;

        rows.into_iter()
            .map(|row| Self::map(None, &row))
            .try_collect_vec()
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
            WHERE
                server_backups.server_uuid = $1
                AND server_backups.system_backup_policy_uuid IS NULL
                AND server_backups.deleted IS NULL
            "#,
        )
        .bind(server_uuid)
        .fetch_one(database.read())
        .await
    }

    /// In-flight system backups for a single policy on a node, ignoring rows older than a day
    /// (those are only failed-out when the wings node resets and must not starve the scheduler
    /// forever).
    pub async fn count_system_inflight_by_system_backup_policy_uuid_node_uuid(
        database: &crate::database::Database,
        system_backup_policy_uuid: uuid::Uuid,
        node_uuid: uuid::Uuid,
    ) -> Result<i64, sqlx::Error> {
        sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM server_backups
            WHERE
                server_backups.system_backup_policy_uuid = $1
                AND server_backups.node_uuid = $2
                AND server_backups.completed IS NULL
                AND server_backups.deleted IS NULL
                AND server_backups.created >= NOW() - INTERVAL '1 day'
            "#,
        )
        .bind(system_backup_policy_uuid)
        .bind(node_uuid)
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

    #[inline]
    pub fn generate_database_metadata(
        database_instance: &super::server_database_instance::ServerDatabaseInstance,
    ) -> serde_json::Value {
        serde_json::json!({
            "source_instance": {
                "uuid": database_instance.uuid,
                "name": database_instance.name,
            },
            "image": database_instance.image,
            "template_version": database_instance.template_version,
        })
    }

    /// The file name (without compression suffix) wings stores a database dump under.
    #[inline]
    pub fn database_dump_name(&self) -> compact_str::CompactString {
        compact_str::format_compact!(
            "{}.{}",
            self.uuid,
            self.database_type
                .map_or("dump", db_agent_api::DatabaseAgentType::dump_extension)
        )
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
            database: bool,
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
                database: self.kind == ServerBackupKind::DatabaseInstance,
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
        if self.kind != ServerBackupKind::Server {
            return Err(crate::response::DisplayError::new(
                "database instance backups cannot be restored to server files",
            )
            .with_status(StatusCode::EXPECTATION_FAILED)
            .into());
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

    pub async fn restore_database(
        self,
        state: &crate::State,
        server: super::server::Server,
        database_instance: &super::server_database_instance::ServerDatabaseInstance,
        request_uuid: Option<uuid::Uuid>,
    ) -> Result<(), anyhow::Error> {
        if self.kind != ServerBackupKind::DatabaseInstance {
            return Err(crate::response::DisplayError::new(
                "only database instance backups can be restored into a database instance",
            )
            .with_status(StatusCode::EXPECTATION_FAILED)
            .into());
        }

        if self.server.as_ref().map(|server| server.uuid) != Some(database_instance.server.uuid) {
            return Err(crate::response::DisplayError::new(
                "backup does not belong to this database instance's server",
            )
            .with_status(StatusCode::EXPECTATION_FAILED)
            .into());
        }

        if self.database_type != Some(database_instance.r#type) {
            return Err(crate::response::DisplayError::new(
                "backup was taken from a different database engine",
            )
            .with_status(StatusCode::EXPECTATION_FAILED)
            .into());
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

        if backup_configuration.maintenance_enabled {
            return Err(crate::response::DisplayError::new(
                "cannot restore backup while backup configuration is in maintenance mode",
            )
            .with_status(StatusCode::EXPECTATION_FAILED)
            .into());
        }

        server
            .node
            .fetch_cached(&state.database)
            .await?
            .api_client(&state.database)
            .await?
            .post_servers_server_database_backup_backup_restore(
                server.uuid,
                self.uuid,
                &wings_api::servers_server_database_backup_backup_restore::post::RequestBody {
                    adapter: self.disk.to_wings_adapter(),
                    database_instance: database_instance.uuid,
                    download_url: self.wings_restore_download_url(state, server.uuid).await?,
                    request_uuid,
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
            None => &self.s3_path(server_uuid, compression_type),
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
            .await?
            .ignoring(server.subuser_ignored_files.clone().unwrap_or_default());

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

    pub async fn evict_one_by_server_uuid_kind(
        state: &crate::State,
        server: &super::server::Server,
        kind: ServerBackupKind,
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
                                AND b2.kind = $2
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
                    AND server_backups.kind = $2
                    AND server_backups.system_backup_policy_uuid IS NULL
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
        .bind(kind)
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
            &backup,
            rule,
            match row_group_name.as_deref() {
                Some(group_name) => EvictionScope::Group(group_name),
                None => EvictionScope::Server,
            },
        )
        .await;

        Ok(())
    }

    pub async fn rotate_group_for_create(
        state: &crate::State,
        group: &super::server_backup_group::ServerBackupGroup,
        kind: ServerBackupKind,
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
                        AND server_backups.kind = $2
                        AND server_backups.deleted IS NULL
                        AND server_backups.deleting IS NULL
                        AND server_backups.successful
                        AND server_backups.completed IS NOT NULL) AS usable,
                (SELECT server_backups.uuid
                    FROM server_backups
                    WHERE server_backups.backup_group_uuid = $1
                        AND server_backups.kind = $2
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
        .bind(kind)
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
            &backup,
            "group-rotation",
            EvictionScope::Group(group.name.as_str()),
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
                    &backup,
                    "retention-days",
                    EvictionScope::Group(group_name.as_str()),
                )
                .await;
            }

            pruned += 1;
        }

        Ok(pruned)
    }

    pub async fn rotate_system_for_create(
        state: &crate::State,
        system_backup_policy: &super::system_backup_policy::SystemBackupPolicy,
        server_uuid: uuid::Uuid,
    ) -> Result<(), anyhow::Error> {
        let failed_rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM server_backups
            WHERE server_backups.server_uuid = $1
                AND server_backups.system_backup_policy_uuid = $2
                AND server_backups.deleted IS NULL
                AND server_backups.deleting IS NULL
                AND server_backups.locked = false
                AND NOT server_backups.successful
                AND server_backups.completed IS NOT NULL
            "#,
            Self::columns_sql(None)
        )))
        .bind(server_uuid)
        .bind(system_backup_policy.uuid)
        .fetch_all(state.database.read())
        .await?;

        for row in failed_rows {
            let backup = Self::map(None, &row)?;

            if let Err(err) = backup.delete(state, Default::default()).await {
                tracing::error!(
                    backup = %backup.uuid,
                    "failed to delete failed system backup: {:#?}",
                    err
                );
                continue;
            }

            Self::log_eviction_activity(
                state,
                server_uuid,
                &backup,
                "system-failed",
                EvictionScope::Policy(system_backup_policy.name.as_str()),
            )
            .await;
        }

        let Some(retention_count) = system_backup_policy.retention_count else {
            return Ok(());
        };

        let row = sqlx::query(
            r#"
            SELECT
                (SELECT COUNT(*)
                    FROM server_backups
                    WHERE server_backups.server_uuid = $1
                        AND server_backups.system_backup_policy_uuid = $2
                        AND server_backups.deleted IS NULL
                        AND server_backups.deleting IS NULL
                        AND server_backups.successful
                        AND server_backups.completed IS NOT NULL) AS usable,
                (SELECT server_backups.uuid
                    FROM server_backups
                    WHERE server_backups.server_uuid = $1
                        AND server_backups.system_backup_policy_uuid = $2
                        AND server_backups.deleted IS NULL
                        AND server_backups.deleting IS NULL
                        AND server_backups.successful
                        AND server_backups.completed IS NOT NULL
                        AND server_backups.locked = false
                    ORDER BY server_backups.created ASC
                    LIMIT 1) AS oldest_unlocked
            "#,
        )
        .bind(server_uuid)
        .bind(system_backup_policy.uuid)
        .fetch_one(state.database.read())
        .await?;

        let usable: i64 = row.try_get("usable")?;
        let oldest_unlocked: Option<uuid::Uuid> = row.try_get("oldest_unlocked")?;

        if usable < retention_count as i64 {
            return Ok(());
        }

        let Some(oldest_unlocked) = oldest_unlocked else {
            return Ok(());
        };

        let Some(backup) =
            Self::by_server_uuid_uuid(&state.database, server_uuid, oldest_unlocked).await?
        else {
            return Ok(());
        };

        backup.delete(state, Default::default()).await?;

        Self::log_eviction_activity(
            state,
            server_uuid,
            &backup,
            "system-rotation",
            EvictionScope::Policy(system_backup_policy.name.as_str()),
        )
        .await;

        Ok(())
    }

    pub async fn prune_system_backups(state: &crate::State) -> Result<u64, anyhow::Error> {
        let expired_rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}, p.name AS policy_name, 'system-retention-days' AS rule
            FROM server_backups
            JOIN system_backup_policies p ON p.uuid = server_backups.system_backup_policy_uuid
            WHERE p.retention_days IS NOT NULL
                AND server_backups.deleted IS NULL
                AND server_backups.deleting IS NULL
                AND server_backups.locked = false
                AND server_backups.completed IS NOT NULL
                AND server_backups.created < NOW() - make_interval(days => p.retention_days)
            "#,
            Self::columns_sql(None)
        )))
        .fetch_all(state.database.read())
        .await?;

        let over_retention_rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}, p.name AS policy_name, 'system-over-retention' AS rule
            FROM (
                SELECT b.*, ROW_NUMBER() OVER (
                    PARTITION BY b.server_uuid, b.system_backup_policy_uuid
                    ORDER BY b.created DESC
                ) AS usable_position
                FROM server_backups b
                WHERE b.system_backup_policy_uuid IS NOT NULL
                    AND b.server_uuid IS NOT NULL
                    AND b.deleted IS NULL
                    AND b.deleting IS NULL
                    AND b.locked = false
                    AND b.successful
                    AND b.completed IS NOT NULL
            ) server_backups
            JOIN system_backup_policies p ON p.uuid = server_backups.system_backup_policy_uuid
            WHERE p.retention_count IS NOT NULL
                AND server_backups.usable_position > p.retention_count
            "#,
            Self::columns_sql(None)
        )))
        .fetch_all(state.database.read())
        .await?;

        let failed_rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}, p.name AS policy_name, 'system-failed' AS rule
            FROM server_backups
            JOIN system_backup_policies p ON p.uuid = server_backups.system_backup_policy_uuid
            WHERE server_backups.deleted IS NULL
                AND server_backups.deleting IS NULL
                AND server_backups.locked = false
                AND NOT server_backups.successful
                AND server_backups.completed IS NOT NULL
                AND server_backups.created < NOW() - INTERVAL '1 day'
            "#,
            Self::columns_sql(None)
        )))
        .fetch_all(state.database.read())
        .await?;

        let mut seen = std::collections::HashSet::new();
        let mut pruned = 0;
        for row in expired_rows
            .into_iter()
            .chain(over_retention_rows)
            .chain(failed_rows)
        {
            let policy_name: compact_str::CompactString = row.try_get("policy_name")?;
            let rule: String = row.try_get("rule")?;
            let server_uuid: Option<uuid::Uuid> = row.try_get("server_uuid")?;
            let backup = Self::map(None, &row)?;

            if !seen.insert(backup.uuid) {
                continue;
            }

            if let Err(err) = backup.delete(state, Default::default()).await {
                tracing::error!(
                    backup = %backup.uuid,
                    "failed to prune system backup: {:#?}",
                    err
                );
                continue;
            }

            if let Some(server_uuid) = server_uuid {
                Self::log_eviction_activity(
                    state,
                    server_uuid,
                    &backup,
                    &rule,
                    EvictionScope::Policy(policy_name.as_str()),
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
        backup: &Self,
        rule: &str,
        scope: EvictionScope<'_>,
    ) {
        if let Err(err) = super::server_activity::ServerActivity::create(
            state,
            super::server_activity::CreateServerActivityOptions {
                server_uuid,
                user_uuid: None,
                impersonator_uuid: None,
                api_key_uuid: None,
                schedule_uuid: None,
                event: match backup.kind {
                    ServerBackupKind::Server => "server:backup.delete".into(),
                    ServerBackupKind::DatabaseInstance => "server:database-backup.delete".into(),
                },
                ip: None,
                data: serde_json::json!({
                    "source": "eviction",
                    "uuid": backup.uuid,
                    "name": backup.name,
                    "database_instance_uuid": backup.database_instance_uuid,
                    "rule": rule,
                    "group": scope.group_name(),
                    "policy": scope.policy_name(),
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
        &self,
        server_uuid: uuid::Uuid,
        compression_type: wings_api::CompressionType,
    ) -> compact_str::CompactString {
        let base_name = match self.kind {
            ServerBackupKind::Server => compact_str::format_compact!("{}.tar", self.uuid),
            ServerBackupKind::DatabaseInstance => self.database_dump_name(),
        };

        compact_str::format_compact!(
            "{server_uuid}/{base_name}{}",
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
        if name.ends_with(".tar") {
            "application/x-tar"
        } else if name.ends_with(".gz") {
            "application/x-gzip"
        } else if name.ends_with(".xz") {
            "application/x-xz"
        } else if name.ends_with(".lz") {
            "application/x-lzip"
        } else if name.ends_with(".bz2") {
            "application/x-bzip2"
        } else if name.ends_with(".lz4") {
            "application/x-lz4"
        } else if name.ends_with(".zst") {
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
            system_backup_policy_uuid: self.system_backup_policy_uuid,
            database_instance_uuid: self.database_instance_uuid,
            kind: self.kind,
            database_type: self.database_type,
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
                system_backup_policy_uuid: self.system_backup_policy_uuid,
                database_instance_uuid: self.database_instance_uuid,
                kind: self.kind,
                database_type: self.database_type,
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
                database_instance_uuid: self.database_instance_uuid,
                kind: self.kind,
                database_type: self.database_type,
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
    pub system_backup_policy_uuid: Option<uuid::Uuid>,
    #[garde(skip)]
    pub database_instance: Option<&'a super::server_database_instance::ServerDatabaseInstance>,
    #[garde(skip)]
    pub backup_configuration: Option<super::backup_configuration::BackupConfiguration>,
    #[garde(skip)]
    pub ignored_files: Vec<compact_str::CompactString>,
    #[garde(skip)]
    pub metadata: serde_json::Value,
}

impl CreateServerBackupOptions<'_> {
    #[inline]
    pub fn kind(&self) -> ServerBackupKind {
        if self.database_instance.is_some() {
            ServerBackupKind::DatabaseInstance
        } else {
            ServerBackupKind::Server
        }
    }
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

        let backup_configuration = match options.backup_configuration.take() {
            Some(backup_configuration) => backup_configuration,
            None => options
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
                })?,
        };

        if backup_configuration.maintenance_enabled {
            return Err(anyhow::Error::new(
                crate::response::DisplayError::new(
                    "cannot create backup while backup configuration is in maintenance mode",
                )
                .with_status(StatusCode::EXPECTATION_FAILED),
            )
            .into());
        }

        if options.database_instance.is_some()
            && matches!(
                backup_configuration.backup_disk,
                BackupDisk::Btrfs | BackupDisk::Zfs
            )
        {
            return Err(anyhow::Error::new(
                crate::response::DisplayError::new(
                    "database backups cannot be created on a btrfs or zfs backup configuration",
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
            .set(
                "system_backup_policy_uuid",
                options.system_backup_policy_uuid,
            )
            .set(
                "database_instance_uuid",
                options.database_instance.map(|instance| instance.uuid),
            )
            .set("kind", options.kind())
            .set(
                "database_type",
                options.database_instance.map(|instance| instance.r#type),
            )
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
        let backup_disk = backup.disk;
        let database_dump = options
            .database_instance
            .map(|instance| (instance.uuid, instance.r#type.dump_extension()));
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

            let result = match database_dump {
                Some((database_instance, extension)) => api_client
                    .post_servers_server_database_backup(
                        server.uuid,
                        &wings_api::servers_server_database_backup::post::RequestBody {
                            adapter: backup_disk.to_wings_adapter(),
                            uuid: backup_uuid,
                            database_instance,
                            extension: extension.into(),
                        },
                    )
                    .await
                    .map(|_| ()),
                None => api_client
                    .post_servers_server_backup(
                        server.uuid,
                        &wings_api::servers_server_backup::post::RequestBody {
                            adapter: backup_disk.to_wings_adapter(),
                            uuid: backup_uuid,
                            ignore: ignored_files_str.into(),
                        },
                    )
                    .await
                    .map(|_| ()),
            };

            if let Err(err) = result {
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

        if let Some(Some(backup_group_uuid)) = options.backup_group_uuid {
            let group = super::server_backup_group::ServerBackupGroup::by_uuid_with_transaction(
                transaction,
                backup_group_uuid,
            )
            .await?;

            if Some(group.server_uuid) != self.server.as_ref().map(|server| server.uuid) {
                return Err(anyhow::Error::new(
                    crate::response::DisplayError::new(
                        "backup group does not belong to this backup's server",
                    )
                    .with_status(StatusCode::EXPECTATION_FAILED),
                )
                .into());
            }
        }

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
                        &self.s3_path(server.uuid, compression_type)
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
                        event: match self.kind {
                            ServerBackupKind::Server => "server:backup.delete-failed",
                            ServerBackupKind::DatabaseInstance => {
                                "server:database-backup.delete-failed"
                            }
                        }
                        .into(),
                        ip: None,
                        data: serde_json::json!({
                            "uuid": self.uuid,
                            "name": self.name,
                            "database_instance_uuid": self.database_instance_uuid,
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
    pub system_backup_policy_uuid: Option<uuid::Uuid>,
    pub database_instance_uuid: Option<uuid::Uuid>,

    pub kind: ServerBackupKind,
    pub database_type: Option<db_agent_api::DatabaseAgentType>,
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
    pub system_backup_policy_uuid: Option<uuid::Uuid>,
    pub database_instance_uuid: Option<uuid::Uuid>,

    pub kind: ServerBackupKind,
    pub database_type: Option<db_agent_api::DatabaseAgentType>,
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

#[derive(ToSchema, Serialize)]
#[schema(title = "ServerBackupUsage")]
pub struct ServerBackupUsage {
    pub server: i64,
    pub database_instance: i64,
}

#[schema_extension_derive::extendible]
#[init_args(ServerBackup, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "ServerBackup")]
pub struct ApiServerBackup {
    pub uuid: uuid::Uuid,
    pub backup_group_uuid: Option<uuid::Uuid>,
    pub database_instance_uuid: Option<uuid::Uuid>,

    pub kind: ServerBackupKind,
    pub database_type: Option<db_agent_api::DatabaseAgentType>,
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
