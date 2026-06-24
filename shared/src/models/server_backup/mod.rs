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
    pub deleted: Option<chrono::NaiveDateTime>,
    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
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
                    download_url: match self.disk {
                        BackupDisk::S3 => {
                            if let Some(mut s3_configuration) =
                                backup_configuration.backup_configs.s3
                            {
                                s3_configuration.decrypt(&state.database).await?;

                                let compression_type = s3_configuration.compression_type;
                                let (client, bucket) = s3_configuration.into_client();

                                let file_path = match &self.upload_path {
                                    Some(path) => path.as_str(),
                                    None => {
                                        &Self::s3_path(server.uuid, self.uuid, compression_type)
                                    }
                                };

                                let presigning_config =
                                    aws_sdk_s3::presigning::PresigningConfig::expires_in(
                                        std::time::Duration::from_mins(60),
                                    )?;
                                let presigned = client
                                    .get_object()
                                    .bucket(bucket)
                                    .key(file_path)
                                    .presigned(presigning_config)
                                    .await?;

                                Some(presigned.uri().to_compact_string())
                            } else {
                                None
                            }
                        }
                        _ => None,
                    },
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

    pub async fn delete_oldest_by_server_uuid(
        state: &crate::State,
        server: &super::server::Server,
    ) -> Result<(), anyhow::Error> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
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
        )))
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
            is_shared: self.shared,
            checksum: self.checksum,
            bytes: self.bytes,
            files: self.files,
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
                is_shared: self.shared,
                checksum: self.checksum,
                bytes: self.bytes,
                files: self.files,
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
            .set("locked", options.locked)
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut **transaction).await?;

        if let Some(name) = options.name {
            self.name = name;
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

        let backup = self.clone();
        let state = state.clone();

        tokio::spawn(async move {
            match backup.disk {
                BackupDisk::S3 => {
                    if let Some(mut s3_configuration) = backup_configuration.backup_configs.s3 {
                        s3_configuration.decrypt(&state.database).await?;

                        let compression_type = s3_configuration.compression_type;
                        let (client, bucket) = s3_configuration.into_client();

                        let file_path = match &backup.upload_path {
                            Some(path) => path,
                            None => if let Some(server) = &backup.server {
                                &Self::s3_path(server.uuid, backup.uuid, compression_type)
                            } else {
                                return Err(anyhow::anyhow!("backup upload path not found"))
                            }
                        };

                        if let Err(err) = client.delete_object().bucket(bucket).key(&**file_path).send().await {
                            if options.force {
                                tracing::error!(server = ?backup.server.as_ref().map(|s| s.uuid), backup = %backup.uuid, "failed to delete S3 backup, ignoring: {:?}", err);
                            } else {
                                return Err(err.into());
                            }
                        }
                    } else if options.force {
                        tracing::warn!(server = ?backup.server.as_ref().map(|s| s.uuid), backup = %backup.uuid, "S3 backup deletion attempted but no S3 configuration found, ignoring");
                    } else {
                        return Err(anyhow::anyhow!("s3 backup deletion attempted but no S3 configuration found"));
                    }
                }
                _ => {
                    if let Err(err) = node
                        .api_client(&state.database)
                        .await?
                        .delete_backups_backup(
                            backup.uuid,
                            &wings_api::backups_backup::delete::RequestBody {
                                adapter: backup.disk.to_wings_adapter(),
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
            .bind(backup.uuid)
            .execute(&mut *transaction)
            .await?;

            backup.run_after_delete_handlers(&options, &state, &mut transaction).await?;

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
    pub is_shared: bool,

    pub checksum: Option<compact_str::CompactString>,
    pub bytes: i64,
    pub files: i64,

    pub metadata: serde_json::Value,

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
    pub is_shared: bool,

    pub checksum: Option<compact_str::CompactString>,
    pub bytes: i64,
    pub files: i64,

    pub metadata: serde_json::Value,

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

    pub metadata: serde_json::Value,

    pub completed: Option<chrono::DateTime<chrono::Utc>>,
    pub created: chrono::DateTime<chrono::Utc>,
}
