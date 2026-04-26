use crate::{
    State,
    models::{InsertQueryBuilder, UpdateQueryBuilder},
    prelude::*,
    response::DisplayError,
};
use compact_str::ToCompactString;
use garde::Validate;
use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow, prelude::Type};
use std::{
    collections::{BTreeMap, HashMap},
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

mod events;
pub use events::ServerEvent;

pub type GetServer = crate::extract::ConsumingExtension<Server>;
pub type GetServerActivityLogger = crate::extract::ConsumingExtension<ServerActivityLogger>;

#[derive(Clone)]
pub struct ServerActivityLogger {
    pub state: State,
    pub server_uuid: uuid::Uuid,
    pub user_uuid: uuid::Uuid,
    pub impersonator_uuid: Option<uuid::Uuid>,
    pub user_admin: bool,
    pub user_owner: bool,
    pub user_subuser: bool,
    pub api_key_uuid: Option<uuid::Uuid>,
    pub ip: std::net::IpAddr,
}

impl ServerActivityLogger {
    pub async fn log(&self, event: impl Into<compact_str::CompactString>, data: serde_json::Value) {
        let settings = match self.state.settings.get().await {
            Ok(settings) => settings,
            Err(_) => return,
        };

        if !settings.activity.server_log_admin_activity
            && self.user_admin
            && !self.user_owner
            && !self.user_subuser
        {
            return;
        }
        drop(settings);

        let options = super::server_activity::CreateServerActivityOptions {
            server_uuid: self.server_uuid,
            user_uuid: Some(self.user_uuid),
            impersonator_uuid: self.impersonator_uuid,
            api_key_uuid: self.api_key_uuid,
            schedule_uuid: None,
            event: event.into(),
            ip: Some(self.ip.into()),
            data,
            created: None,
        };
        if let Err(err) = super::server_activity::ServerActivity::create(&self.state, options).await
        {
            tracing::warn!(
                user = %self.user_uuid,
                "failed to log server activity: {:#?}",
                err
            );
        }
    }
}

#[derive(ToSchema, Serialize, Deserialize, Type, PartialEq, Eq, Hash, Clone, Copy)]
#[serde(rename_all = "snake_case")]
#[sqlx(type_name = "server_status", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ServerStatus {
    Installing,
    InstallFailed,
    RestoringBackup,
}

#[derive(ToSchema, Serialize, Deserialize, Type, PartialEq, Eq, Hash, Clone, Copy)]
#[serde(rename_all = "snake_case")]
#[sqlx(
    type_name = "server_auto_start_behavior",
    rename_all = "SCREAMING_SNAKE_CASE"
)]
pub enum ServerAutoStartBehavior {
    Always,
    UnlessStopped,
    Never,
}

impl From<ServerAutoStartBehavior> for wings_api::ServerAutoStartBehavior {
    fn from(value: ServerAutoStartBehavior) -> Self {
        match value {
            ServerAutoStartBehavior::Always => Self::Always,
            ServerAutoStartBehavior::UnlessStopped => Self::UnlessStopped,
            ServerAutoStartBehavior::Never => Self::Never,
        }
    }
}

pub struct ServerTransferOptions {
    pub destination_node: super::node::Node,

    pub allocation_uuid: Option<uuid::Uuid>,
    pub allocation_uuids: Vec<uuid::Uuid>,

    pub backups: Vec<uuid::Uuid>,
    pub delete_source_backups: bool,
    pub archive_format: wings_api::TransferArchiveFormat,
    pub compression_level: Option<wings_api::CompressionLevel>,
    pub multiplex_channels: u64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Server {
    pub uuid: uuid::Uuid,
    pub uuid_short: i32,
    pub external_id: Option<compact_str::CompactString>,
    pub allocation: Option<super::server_allocation::ServerAllocation>,
    pub destination_allocation_uuid: Option<uuid::Uuid>,
    pub node: Fetchable<super::node::Node>,
    pub destination_node: Option<Fetchable<super::node::Node>>,
    pub owner: super::user::User,
    pub egg: Box<super::nest_egg::NestEgg>,
    pub nest: Box<super::nest::Nest>,
    pub backup_configuration: Option<Fetchable<super::backup_configuration::BackupConfiguration>>,

    pub status: Option<ServerStatus>,
    pub suspended: bool,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,

    pub memory: i64,
    pub memory_overhead: i64,
    pub swap: i64,
    pub disk: i64,
    pub io_weight: Option<i16>,
    pub cpu: i32,
    pub pinned_cpus: Vec<i16>,

    pub startup: compact_str::CompactString,
    pub image: compact_str::CompactString,
    pub auto_kill: wings_api::ServerConfigurationAutoKill,
    pub auto_start_behavior: ServerAutoStartBehavior,
    pub timezone: Option<compact_str::CompactString>,

    pub hugepages_passthrough_enabled: bool,
    pub kvm_passthrough_enabled: bool,

    pub allocation_limit: i32,
    pub database_limit: i32,
    pub backup_limit: i32,
    pub schedule_limit: i32,

    pub subuser_permissions: Option<Arc<Vec<compact_str::CompactString>>>,
    pub subuser_ignored_files: Option<Vec<compact_str::CompactString>>,
    #[serde(skip_serializing, skip_deserializing)]
    subuser_ignored_files_overrides: Option<Box<ignore::overrides::Override>>,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for Server {
    const NAME: &'static str = "server";

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

        let mut columns = BTreeMap::from([
            ("servers.uuid", compact_str::format_compact!("{prefix}uuid")),
            (
                "servers.uuid_short",
                compact_str::format_compact!("{prefix}uuid_short"),
            ),
            (
                "servers.external_id",
                compact_str::format_compact!("{prefix}external_id"),
            ),
            (
                "servers.destination_allocation_uuid",
                compact_str::format_compact!("{prefix}destination_allocation_uuid"),
            ),
            (
                "servers.node_uuid",
                compact_str::format_compact!("{prefix}node_uuid"),
            ),
            (
                "servers.destination_node_uuid",
                compact_str::format_compact!("{prefix}destination_node_uuid"),
            ),
            (
                "servers.backup_configuration_uuid",
                compact_str::format_compact!("{prefix}backup_configuration_uuid"),
            ),
            (
                "servers.status",
                compact_str::format_compact!("{prefix}status"),
            ),
            (
                "servers.suspended",
                compact_str::format_compact!("{prefix}suspended"),
            ),
            ("servers.name", compact_str::format_compact!("{prefix}name")),
            (
                "servers.description",
                compact_str::format_compact!("{prefix}description"),
            ),
            (
                "servers.memory",
                compact_str::format_compact!("{prefix}memory"),
            ),
            (
                "servers.memory_overhead",
                compact_str::format_compact!("{prefix}memory_overhead"),
            ),
            ("servers.swap", compact_str::format_compact!("{prefix}swap")),
            ("servers.disk", compact_str::format_compact!("{prefix}disk")),
            (
                "servers.io_weight",
                compact_str::format_compact!("{prefix}io_weight"),
            ),
            ("servers.cpu", compact_str::format_compact!("{prefix}cpu")),
            (
                "servers.pinned_cpus",
                compact_str::format_compact!("{prefix}pinned_cpus"),
            ),
            (
                "servers.startup",
                compact_str::format_compact!("{prefix}startup"),
            ),
            (
                "servers.image",
                compact_str::format_compact!("{prefix}image"),
            ),
            (
                "servers.auto_kill",
                compact_str::format_compact!("{prefix}auto_kill"),
            ),
            (
                "servers.auto_start_behavior",
                compact_str::format_compact!("{prefix}auto_start_behavior"),
            ),
            (
                "servers.timezone",
                compact_str::format_compact!("{prefix}timezone"),
            ),
            (
                "servers.hugepages_passthrough_enabled",
                compact_str::format_compact!("{prefix}hugepages_passthrough_enabled"),
            ),
            (
                "servers.kvm_passthrough_enabled",
                compact_str::format_compact!("{prefix}kvm_passthrough_enabled"),
            ),
            (
                "servers.allocation_limit",
                compact_str::format_compact!("{prefix}allocation_limit"),
            ),
            (
                "servers.database_limit",
                compact_str::format_compact!("{prefix}database_limit"),
            ),
            (
                "servers.backup_limit",
                compact_str::format_compact!("{prefix}backup_limit"),
            ),
            (
                "servers.schedule_limit",
                compact_str::format_compact!("{prefix}schedule_limit"),
            ),
            (
                "servers.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ]);

        columns.extend(super::server_allocation::ServerAllocation::base_columns(
            Some("allocation_"),
        ));
        columns.extend(super::user::User::base_columns(Some("owner_")));
        columns.extend(super::nest_egg::NestEgg::base_columns(Some("egg_")));
        columns.extend(super::nest::Nest::base_columns(Some("nest_")));

        columns
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            uuid: row.try_get(compact_str::format_compact!("{prefix}uuid").as_str())?,
            uuid_short: row.try_get(compact_str::format_compact!("{prefix}uuid_short").as_str())?,
            external_id: row
                .try_get(compact_str::format_compact!("{prefix}external_id").as_str())?,
            allocation: if row
                .try_get::<uuid::Uuid, _>(
                    compact_str::format_compact!("{prefix}allocation_uuid").as_str(),
                )
                .is_ok()
            {
                Some(super::server_allocation::ServerAllocation::map(
                    Some("allocation_"),
                    row,
                )?)
            } else {
                None
            },
            destination_allocation_uuid: row
                .try_get::<uuid::Uuid, _>(
                    compact_str::format_compact!("{prefix}destination_allocation_uuid").as_str(),
                )
                .ok(),
            node: super::node::Node::get_fetchable(
                row.try_get(compact_str::format_compact!("{prefix}node_uuid").as_str())?,
            ),
            destination_node: super::node::Node::get_fetchable_from_row(
                row,
                compact_str::format_compact!("{prefix}destination_node_uuid"),
            ),
            owner: super::user::User::map(Some("owner_"), row)?,
            egg: Box::new(super::nest_egg::NestEgg::map(Some("egg_"), row)?),
            nest: Box::new(super::nest::Nest::map(Some("nest_"), row)?),
            backup_configuration:
                super::backup_configuration::BackupConfiguration::get_fetchable_from_row(
                    row,
                    compact_str::format_compact!("{prefix}backup_configuration_uuid"),
                ),
            status: row.try_get(compact_str::format_compact!("{prefix}status").as_str())?,
            suspended: row.try_get(compact_str::format_compact!("{prefix}suspended").as_str())?,
            name: row.try_get(compact_str::format_compact!("{prefix}name").as_str())?,
            description: row
                .try_get(compact_str::format_compact!("{prefix}description").as_str())?,
            memory: row.try_get(compact_str::format_compact!("{prefix}memory").as_str())?,
            memory_overhead: row
                .try_get(compact_str::format_compact!("{prefix}memory_overhead").as_str())?,
            swap: row.try_get(compact_str::format_compact!("{prefix}swap").as_str())?,
            disk: row.try_get(compact_str::format_compact!("{prefix}disk").as_str())?,
            io_weight: row.try_get(compact_str::format_compact!("{prefix}io_weight").as_str())?,
            cpu: row.try_get(compact_str::format_compact!("{prefix}cpu").as_str())?,
            pinned_cpus: row
                .try_get(compact_str::format_compact!("{prefix}pinned_cpus").as_str())?,
            startup: row.try_get(compact_str::format_compact!("{prefix}startup").as_str())?,
            image: row.try_get(compact_str::format_compact!("{prefix}image").as_str())?,
            auto_kill: serde_json::from_value(row.try_get::<serde_json::Value, _>(
                compact_str::format_compact!("{prefix}auto_kill").as_str(),
            )?)?,
            auto_start_behavior: row
                .try_get(compact_str::format_compact!("{prefix}auto_start_behavior").as_str())?,
            timezone: row.try_get(compact_str::format_compact!("{prefix}timezone").as_str())?,
            hugepages_passthrough_enabled: row.try_get(
                compact_str::format_compact!("{prefix}hugepages_passthrough_enabled").as_str(),
            )?,
            kvm_passthrough_enabled: row.try_get(
                compact_str::format_compact!("{prefix}kvm_passthrough_enabled").as_str(),
            )?,
            allocation_limit: row
                .try_get(compact_str::format_compact!("{prefix}allocation_limit").as_str())?,
            database_limit: row
                .try_get(compact_str::format_compact!("{prefix}database_limit").as_str())?,
            backup_limit: row
                .try_get(compact_str::format_compact!("{prefix}backup_limit").as_str())?,
            schedule_limit: row
                .try_get(compact_str::format_compact!("{prefix}schedule_limit").as_str())?,
            subuser_permissions: row
                .try_get::<Vec<compact_str::CompactString>, _>("permissions")
                .map(Arc::new)
                .ok(),
            subuser_ignored_files: row
                .try_get::<Vec<compact_str::CompactString>, _>("ignored_files")
                .ok(),
            subuser_ignored_files_overrides: None,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl Server {
    pub async fn by_node_uuid_uuid(
        database: &crate::database::Database,
        node_uuid: uuid::Uuid,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM servers
            LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
            LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
            JOIN users ON users.uuid = servers.owner_uuid
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
            JOIN nests ON nests.uuid = nest_eggs.nest_uuid
            WHERE (servers.node_uuid = $1 OR servers.destination_node_uuid = $1) AND servers.uuid = $2
            "#,
            Self::columns_sql(None)
        ))
        .bind(node_uuid)
        .bind(uuid)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn by_external_id(
        database: &crate::database::Database,
        external_id: &str,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM servers
            LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
            LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
            JOIN users ON users.uuid = servers.owner_uuid
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
            JOIN nests ON nests.uuid = nest_eggs.nest_uuid
            WHERE servers.external_id = $1
            "#,
            Self::columns_sql(None)
        ))
        .bind(external_id)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn by_identifier(
        database: &crate::database::Database,
        identifier: &str,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let query = format!(
            r#"
            SELECT {}
            FROM servers
            LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
            LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
            JOIN users ON users.uuid = servers.owner_uuid
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
            JOIN nests ON nests.uuid = nest_eggs.nest_uuid
            WHERE servers.{} = $1
            "#,
            Self::columns_sql(None),
            match identifier.len() {
                8 => "uuid_short",
                36 => "uuid",
                _ => return Ok(None),
            }
        );

        let mut row = sqlx::query(&query);
        row = match identifier.len() {
            8 => row.bind(u32::from_str_radix(identifier, 16).map_err(anyhow::Error::new)? as i32),
            36 => row.bind(uuid::Uuid::parse_str(identifier).map_err(anyhow::Error::new)?),
            _ => return Ok(None),
        };
        let row = row.fetch_optional(database.read()).await?;

        row.try_map(|row| Self::map(None, &row))
    }

    /// Get a server by its identifier, ensuring the user has access to it.
    ///
    /// Cached for 5 seconds.
    pub async fn by_user_identifier(
        database: &crate::database::Database,
        user: &super::user::User,
        identifier: &str,
    ) -> Result<Option<Self>, anyhow::Error> {
        database
            .cache
            .cached(&format!("user::{}::server::{identifier}", user.uuid), 5, || async {
                let query = format!(
                    r#"
                    SELECT {}, server_subusers.permissions, server_subusers.ignored_files
                    FROM servers
                    LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
                    LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
                    JOIN users ON users.uuid = servers.owner_uuid
                    LEFT JOIN roles ON roles.uuid = users.role_uuid
                    JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
                    LEFT JOIN server_subusers ON server_subusers.server_uuid = servers.uuid AND server_subusers.user_uuid = $1
                    JOIN nests ON nests.uuid = nest_eggs.nest_uuid
                    WHERE servers.{} = $3 AND (servers.owner_uuid = $1 OR server_subusers.user_uuid = $1 OR $2)
                    "#,
                    Self::columns_sql(None),
                    match identifier.len() {
                        8 => "uuid_short",
                        36 => "uuid",
                        _ => return Ok::<_, anyhow::Error>(None),
                    }
                );

                let mut row = sqlx::query(&query)
                    .bind(user.uuid)
                    .bind(
                        user.admin
                            || user.role.as_ref().is_some_and(|r| r.admin_permissions.iter().any(|p| p == "servers.read"))
                    );
                row = match identifier.len() {
                    8 => row.bind(u32::from_str_radix(identifier, 16)? as i32),
                    36 => row.bind(uuid::Uuid::parse_str(identifier)?),
                    _ => return Ok(None),
                };
                let row = row.fetch_optional(database.read()).await?;

                Ok(row.try_map(|row| Self::map(None, &row))?)
            })
            .await
    }

    pub async fn by_owner_uuid_with_pagination(
        database: &crate::database::Database,
        owner_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(&format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM servers
            LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
            LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
            JOIN users ON users.uuid = servers.owner_uuid
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
            JOIN nests ON nests.uuid = nest_eggs.nest_uuid
            WHERE servers.owner_uuid = $1 AND ($2 IS NULL OR servers.name ILIKE '%' || $2 || '%')
            ORDER BY servers.created
            LIMIT $3 OFFSET $4
            "#,
            Self::columns_sql(None)
        ))
        .bind(owner_uuid)
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

    pub async fn by_user_uuid_server_order_with_pagination(
        database: &crate::database::Database,
        owner_uuid: uuid::Uuid,
        server_order: &[uuid::Uuid],
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(&format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM servers
            LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
            LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
            JOIN users ON users.uuid = servers.owner_uuid
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
            JOIN nests ON nests.uuid = nest_eggs.nest_uuid
            LEFT JOIN server_subusers ON server_subusers.server_uuid = servers.uuid AND server_subusers.user_uuid = $1
            WHERE servers.uuid = ANY($2)
                AND (servers.owner_uuid = $1 OR server_subusers.user_uuid = $1)
                AND ($3 IS NULL OR servers.name ILIKE '%' || $3 || '%' OR users.username ILIKE '%' || $3 || '%' OR users.email ILIKE '%' || $3 || '%')
            ORDER BY array_position($2, servers.uuid), servers.created
            LIMIT $4 OFFSET $5
            "#,
            Self::columns_sql(None)
        ))
        .bind(owner_uuid)
        .bind(server_order)
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

    pub async fn by_user_uuid_with_pagination(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(&format!(
            r#"
            SELECT DISTINCT ON (servers.uuid, servers.created) {}, server_subusers.permissions, server_subusers.ignored_files, COUNT(*) OVER() AS total_count
            FROM servers
            LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
            LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
            JOIN users ON users.uuid = servers.owner_uuid
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
            JOIN nests ON nests.uuid = nest_eggs.nest_uuid
            LEFT JOIN server_subusers ON server_subusers.server_uuid = servers.uuid AND server_subusers.user_uuid = $1
            WHERE
                (servers.owner_uuid = $1 OR server_subusers.user_uuid = $1)
                AND ($2 IS NULL OR servers.name ILIKE '%' || $2 || '%' OR users.username ILIKE '%' || $2 || '%' OR users.email ILIKE '%' || $2 || '%')
            ORDER BY servers.created
            LIMIT $3 OFFSET $4
            "#,
            Self::columns_sql(None)
        ))
        .bind(user_uuid)
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

    pub async fn all_uuids_by_node_uuid_user_uuid(
        database: &crate::database::Database,
        node_uuid: uuid::Uuid,
        user_uuid: uuid::Uuid,
    ) -> Result<Vec<uuid::Uuid>, crate::database::DatabaseError> {
        let rows = sqlx::query(
            r#"
            SELECT DISTINCT ON (servers.uuid, servers.created) servers.uuid
            FROM servers
            LEFT JOIN server_subusers ON server_subusers.server_uuid = servers.uuid AND server_subusers.user_uuid = $2
            WHERE servers.node_uuid = $1 AND (servers.owner_uuid = $2 OR server_subusers.user_uuid = $2)
            ORDER BY servers.created
            "#
        )
        .bind(node_uuid)
        .bind(user_uuid)
        .fetch_all(database.read())
        .await?;

        Ok(rows
            .into_iter()
            .map(|row| row.get::<uuid::Uuid, _>("uuid"))
            .collect())
    }

    pub async fn by_not_user_uuid_with_pagination(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(&format!(
            r#"
            SELECT DISTINCT ON (servers.uuid, servers.created) {}, server_subusers.permissions, server_subusers.ignored_files, COUNT(*) OVER() AS total_count
            FROM servers
            LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
            LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
            JOIN users ON users.uuid = servers.owner_uuid
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
            JOIN nests ON nests.uuid = nest_eggs.nest_uuid
            LEFT JOIN server_subusers ON server_subusers.server_uuid = servers.uuid AND server_subusers.user_uuid = $1
            WHERE
                servers.owner_uuid != $1 AND (server_subusers.user_uuid IS NULL OR server_subusers.user_uuid != $1)
                AND ($2 IS NULL OR servers.name ILIKE '%' || $2 || '%' OR users.username ILIKE '%' || $2 || '%' OR users.email ILIKE '%' || $2 || '%')
            ORDER BY servers.created
            LIMIT $3 OFFSET $4
            "#,
            Self::columns_sql(None)
        ))
        .bind(user_uuid)
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
            FROM servers
            LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
            LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
            JOIN users ON users.uuid = servers.owner_uuid
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
            JOIN nests ON nests.uuid = nest_eggs.nest_uuid
            WHERE servers.node_uuid = $1 AND ($2 IS NULL OR servers.name ILIKE '%' || $2 || '%')
            ORDER BY servers.created
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

    pub async fn by_node_uuid_transferring_with_pagination(
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
            FROM servers
            LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
            LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
            JOIN users ON users.uuid = servers.owner_uuid
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
            JOIN nests ON nests.uuid = nest_eggs.nest_uuid
            WHERE servers.node_uuid = $1 AND servers.destination_node_uuid IS NOT NULL
                AND ($2 IS NULL OR servers.name ILIKE '%' || $2 || '%')
            ORDER BY servers.created
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

    pub async fn by_egg_uuid_with_pagination(
        database: &crate::database::Database,
        egg_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(&format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM servers
            LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
            LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
            JOIN users ON users.uuid = servers.owner_uuid
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
            JOIN nests ON nests.uuid = nest_eggs.nest_uuid
            WHERE servers.egg_uuid = $1 AND ($2 IS NULL OR servers.name ILIKE '%' || $2 || '%')
            ORDER BY servers.created
            LIMIT $3 OFFSET $4
            "#,
            Self::columns_sql(None)
        ))
        .bind(egg_uuid)
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
            FROM servers
            LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
            LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
            JOIN users ON users.uuid = servers.owner_uuid
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
            JOIN nests ON nests.uuid = nest_eggs.nest_uuid
            WHERE servers.backup_configuration_uuid = $1 AND ($2 IS NULL OR servers.name ILIKE '%' || $2 || '%')
            ORDER BY servers.created
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

    pub async fn all_with_pagination(
        database: &crate::database::Database,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(&format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM servers
            LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
            LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
            JOIN users ON users.uuid = servers.owner_uuid
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
            JOIN nests ON nests.uuid = nest_eggs.nest_uuid
            WHERE $1 IS NULL OR servers.name ILIKE '%' || $1 || '%'
            ORDER BY servers.created
            LIMIT $2 OFFSET $3
            "#,
            Self::columns_sql(None)
        ))
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

    pub async fn count_by_user_uuid(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
    ) -> i64 {
        sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM servers
            WHERE servers.owner_uuid = $1
            "#,
        )
        .bind(user_uuid)
        .fetch_one(database.read())
        .await
        .unwrap_or(0)
    }

    pub async fn count_by_node_uuid(
        database: &crate::database::Database,
        node_uuid: uuid::Uuid,
    ) -> i64 {
        sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM servers
            WHERE servers.node_uuid = $1
            "#,
        )
        .bind(node_uuid)
        .fetch_one(database.read())
        .await
        .unwrap_or(0)
    }

    pub async fn count_by_egg_uuid(
        database: &crate::database::Database,
        egg_uuid: uuid::Uuid,
    ) -> i64 {
        sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM servers
            WHERE servers.egg_uuid = $1
            "#,
        )
        .bind(egg_uuid)
        .fetch_one(database.read())
        .await
        .unwrap_or(0)
    }

    /// Fetches the current status of the server from the database. This is the most up-to-date status, as opposed to the potentially cached status in the `Server` struct.
    pub async fn fetch_status(
        &self,
        database: &crate::database::Database,
    ) -> Result<Option<ServerStatus>, crate::database::DatabaseError> {
        let status = sqlx::query_scalar(
            r#"
            SELECT status
            FROM servers
            WHERE servers.uuid = $1
            "#,
        )
        .bind(self.uuid)
        .fetch_one(database.read())
        .await?;

        Ok(status)
    }

    /// Syncs the server with the node. This will update server resources, schedules, name, etc.
    pub async fn sync(self, database: &crate::database::Database) -> Result<(), anyhow::Error> {
        self.node
            .fetch_cached(database)
            .await?
            .api_client(database)
            .await?
            .post_servers_server_sync(
                self.uuid,
                &wings_api::servers_server_sync::post::RequestBody {
                    server: serde_json::to_value(self.into_remote_api_object(database).await?)?,
                },
            )
            .await?;

        Ok(())
    }

    /// Same as [`sync`](Self::sync) but runs in a background task, is deduplicated and is not awaited. Any errors will be logged but not returned.
    ///
    /// This method is meant to be used in 90% of cases where you want to sync the server with low priority.
    pub async fn batch_sync(self, database: &Arc<crate::database::Database>) {
        database
            .batch_action("sync_server", self.uuid, {
                let database = database.clone();

                async move { self.sync(&database).await }
            })
            .await;
    }

    /// Triggers a re-installation of the server on the node.
    /// This will only work if the server is in a state that allows re-installation. (None status)
    /// If this is not the case, a `DisplayError` will be returned.
    pub async fn install(
        &self,
        state: &crate::State,
        truncate_directory: bool,
        installation_script: Option<wings_api::InstallationScript>,
    ) -> Result<(), anyhow::Error> {
        let mut transaction = state.database.write().begin().await?;

        let rows_affected = sqlx::query!(
            "UPDATE servers
            SET status = 'INSTALLING'
            WHERE servers.uuid = $1 AND servers.status IS NULL",
            self.uuid
        )
        .execute(&mut *transaction)
        .await?
        .rows_affected();

        if rows_affected == 0 {
            transaction.rollback().await?;

            return Err(DisplayError::new(
                "server is already installing or in an invalid state for reinstalling",
            )
            .into());
        }

        match self
            .node
            .fetch_cached(&state.database)
            .await?
            .api_client(&state.database)
            .await?
            .post_servers_server_reinstall(
                self.uuid,
                &wings_api::servers_server_reinstall::post::RequestBody {
                    truncate_directory,
                    installation_script: Some(
                        if let Some(installation_script) = &installation_script {
                            installation_script.clone()
                        } else {
                            wings_api::InstallationScript {
                                container_image: self.egg.config_script.container.clone(),
                                entrypoint: self.egg.config_script.entrypoint.clone(),
                                script: self.egg.config_script.content.to_compact_string(),
                                environment: Default::default(),
                            }
                        },
                    ),
                },
            )
            .await
        {
            Ok(_) => {}
            Err(err) => {
                transaction.rollback().await?;

                return Err(err.into());
            }
        };

        transaction.commit().await?;

        Self::get_event_emitter().emit(
            state.clone(),
            events::ServerEvent::InstallStarted {
                server: Box::new(self.clone()),
                installation_script: Box::new(
                    if let Some(installation_script) = installation_script {
                        installation_script
                    } else {
                        wings_api::InstallationScript {
                            container_image: self.egg.config_script.container.clone(),
                            entrypoint: self.egg.config_script.entrypoint.clone(),
                            script: self.egg.config_script.content.to_compact_string(),
                            environment: Default::default(),
                        }
                    },
                ),
            },
        );

        Ok(())
    }

    /// Triggers a transfer of the server to another node.
    /// This will only work if the server is in a state that allows transferring. (None status)
    /// If this is not the case, a `DisplayError` will be returned.
    pub async fn transfer(
        self,
        state: &crate::State,
        options: ServerTransferOptions,
    ) -> Result<(), anyhow::Error> {
        if self.destination_node.is_some() {
            return Err(DisplayError::new("server is already being transferred")
                .with_status(axum::http::StatusCode::CONFLICT)
                .into());
        }

        if self.node.uuid == options.destination_node.uuid {
            return Err(DisplayError::new(
                "destination node must be different from the current node",
            )
            .with_status(axum::http::StatusCode::CONFLICT)
            .into());
        }

        if options.destination_node.is_all_in_one_node() {
            return Err(DisplayError::new("cannot transfer to an all-in-one node")
                .with_status(axum::http::StatusCode::CONFLICT)
                .into());
        }

        let mut transaction = state.database.write().begin().await?;

        let destination_allocation_uuid = if let Some(allocation_uuid) = options.allocation_uuid {
            Some(
                sqlx::query!(
                    "INSERT INTO server_allocations (server_uuid, allocation_uuid)
                    VALUES ($1, $2)
                    ON CONFLICT DO NOTHING
                    RETURNING uuid",
                    self.uuid,
                    allocation_uuid
                )
                .fetch_one(&mut *transaction)
                .await?
                .uuid,
            )
        } else {
            None
        };

        sqlx::query!(
            "UPDATE servers
            SET destination_node_uuid = $2, destination_allocation_uuid = $3
            WHERE servers.uuid = $1",
            self.uuid,
            options.destination_node.uuid,
            destination_allocation_uuid
        )
        .execute(&mut *transaction)
        .await?;

        if !options.allocation_uuids.is_empty() {
            sqlx::query!(
                "INSERT INTO server_allocations (server_uuid, allocation_uuid)
                SELECT $1, UNNEST($2::uuid[])
                ON CONFLICT DO NOTHING",
                self.uuid,
                &options.allocation_uuids
            )
            .execute(&mut *transaction)
            .await?;
        }

        let token = options.destination_node.create_jwt(
            &state.database,
            &state.jwt,
            &crate::jwt::BasePayload {
                issuer: "panel".into(),
                subject: Some(self.uuid.to_string()),
                audience: Vec::new(),
                expiration_time: Some(chrono::Utc::now().timestamp() + 600),
                not_before: None,
                issued_at: Some(chrono::Utc::now().timestamp()),
                jwt_id: self.node.uuid.to_string(),
            },
        )?;

        transaction.commit().await?;

        let url = options.destination_node.url("/api/transfers");

        self.node
            .fetch_cached(&state.database)
            .await?
            .api_client(&state.database)
            .await?
            .post_servers_server_transfer(
                self.uuid,
                &wings_api::servers_server_transfer::post::RequestBody {
                    url: url.to_compact_string(),
                    token: format!("Bearer {token}").into(),
                    backups: options.backups,
                    delete_backups: options.delete_source_backups,
                    archive_format: options.archive_format,
                    compression_level: options.compression_level,
                    multiplex_streams: options.multiplex_channels,
                },
            )
            .await?;

        Server::get_event_emitter().emit(
            state.clone(),
            ServerEvent::TransferStarted {
                server: Box::new(self),
                destination_node: Box::new(options.destination_node),
                destination_allocation: destination_allocation_uuid,
                destination_allocations: options.allocation_uuids,
            },
        );

        Ok(())
    }

    pub fn wings_permissions(
        &self,
        settings: &crate::settings::AppSettings,
        user: &super::user::User,
    ) -> Vec<&str> {
        let mut permissions = vec!["websocket.connect", "meta.calagopus"];
        if user.admin {
            permissions.reserve_exact(4);

            permissions.push("*");
            permissions.push("admin.websocket.errors");
            permissions.push("admin.websocket.install");
            permissions.push("admin.websocket.transfer");

            return permissions;
        }

        if let Some(subuser_permissions) = &self.subuser_permissions {
            permissions.reserve(subuser_permissions.len());

            for permission in subuser_permissions.iter() {
                if permission == "control.read-console" {
                    if settings.server.allow_viewing_installation_logs {
                        permissions.push("admin.websocket.install");
                    }
                    if settings.server.allow_viewing_transfer_progress {
                        permissions.push("admin.websocket.transfer");
                    }
                }

                permissions.push(permission.as_str());
            }
        } else {
            permissions.reserve(3);

            if settings.server.allow_viewing_installation_logs {
                permissions.push("admin.websocket.install");
            }
            if settings.server.allow_viewing_transfer_progress {
                permissions.push("admin.websocket.transfer");
            }

            permissions.push("*");
        }

        permissions
    }

    pub fn wings_subuser_permissions<'a>(
        &self,
        settings: &crate::settings::AppSettings,
        subuser: &'a super::server_subuser::ServerSubuser,
    ) -> Vec<&'a str> {
        let mut permissions = vec!["websocket.connect", "meta.calagopus"];
        if subuser.user.admin {
            permissions.reserve_exact(4);

            permissions.push("*");
            permissions.push("admin.websocket.errors");
            permissions.push("admin.websocket.install");
            permissions.push("admin.websocket.transfer");

            return permissions;
        }

        permissions.reserve(subuser.permissions.len() + 1);

        for permission in subuser.permissions.iter() {
            if permission == "control.read-console" {
                if settings.server.allow_viewing_installation_logs {
                    permissions.push("admin.websocket.install");
                }
                if settings.server.allow_viewing_transfer_progress {
                    permissions.push("admin.websocket.transfer");
                }
            }

            permissions.push(permission.as_str());
        }

        permissions
    }

    pub async fn backup_configuration(
        &self,
        database: &crate::database::Database,
    ) -> Option<super::backup_configuration::BackupConfiguration> {
        if let Some(backup_configuration) = &self.backup_configuration
            && let Ok(backup_configuration) = backup_configuration.fetch_cached(database).await
        {
            return Some(backup_configuration);
        }

        let node = self.node.fetch_cached(database).await.ok()?;

        if let Some(backup_configuration) = node.backup_configuration
            && let Ok(backup_configuration) = backup_configuration.fetch_cached(database).await
        {
            return Some(backup_configuration);
        }

        if let Some(backup_configuration) = node.location.backup_configuration
            && let Ok(backup_configuration) = backup_configuration.fetch_cached(database).await
        {
            return Some(backup_configuration);
        }

        None
    }

    pub fn is_ignored(&mut self, path: impl AsRef<std::path::Path>, is_dir: bool) -> bool {
        if let Some(ignored_files) = &self.subuser_ignored_files {
            if let Some(overrides) = &self.subuser_ignored_files_overrides {
                return overrides.matched(path, is_dir).is_whitelist();
            }

            let mut override_builder = ignore::overrides::OverrideBuilder::new("/");

            for file in ignored_files {
                override_builder.add(file).ok();
            }

            if let Ok(override_builder) = override_builder.build() {
                let ignored = override_builder.matched(path, is_dir).is_whitelist();
                self.subuser_ignored_files_overrides = Some(Box::new(override_builder));

                return ignored;
            }
        }

        false
    }

    #[inline]
    pub async fn into_remote_api_object(
        self,
        database: &crate::database::Database,
    ) -> Result<RemoteApiServer, anyhow::Error> {
        let (variables, backups, schedules, mounts, allocations) = tokio::try_join!(
            sqlx::query!(
                "SELECT nest_egg_variables.env_variable, COALESCE(server_variables.value, nest_egg_variables.default_value) AS value
                FROM nest_egg_variables
                LEFT JOIN server_variables ON server_variables.variable_uuid = nest_egg_variables.uuid AND server_variables.server_uuid = $1
                WHERE nest_egg_variables.egg_uuid = $2",
                self.uuid,
                self.egg.uuid
            )
            .fetch_all(database.read()),
            sqlx::query!(
                "SELECT server_backups.uuid
                FROM server_backups
                WHERE server_backups.server_uuid = $1",
                self.uuid
            )
            .fetch_all(database.read()),
            sqlx::query!(
                "SELECT server_schedules.uuid, server_schedules.triggers, server_schedules.condition
                FROM server_schedules
                WHERE server_schedules.server_uuid = $1 AND server_schedules.enabled",
                self.uuid
            )
            .fetch_all(database.read()),
            sqlx::query!(
                "SELECT mounts.source, mounts.target, mounts.read_only
                FROM server_mounts
                JOIN mounts ON mounts.uuid = server_mounts.mount_uuid
                WHERE server_mounts.server_uuid = $1",
                self.uuid
            )
            .fetch_all(database.read()),
            sqlx::query!(
                "SELECT node_allocations.ip, node_allocations.port
                FROM server_allocations
                JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
                WHERE server_allocations.server_uuid = $1",
                self.uuid
            )
            .fetch_all(database.read()),
        )?;

        let mut futures = Vec::new();
        futures.reserve_exact(schedules.len());

        for schedule in &schedules {
            futures.push(
                sqlx::query!(
                    "SELECT server_schedule_steps.uuid, server_schedule_steps.schedule_uuid, server_schedule_steps.action
                    FROM server_schedule_steps
                    WHERE server_schedule_steps.schedule_uuid = $1
                    ORDER BY server_schedule_steps.order_, server_schedule_steps.created",
                    schedule.uuid
                )
                .fetch_all(database.read()),
            );
        }

        let results = futures_util::future::try_join_all(futures).await?;
        let mut schedule_steps = HashMap::new();
        schedule_steps.reserve(schedules.len());

        for (i, steps) in results.into_iter().enumerate() {
            schedule_steps.insert(schedules[i].uuid, steps);
        }

        Ok(RemoteApiServer {
            settings: wings_api::ServerConfiguration {
                uuid: self.uuid,
                start_on_completion: None,
                meta: wings_api::ServerConfigurationMeta {
                    name: self.name,
                    description: self.description.unwrap_or_default(),
                },
                suspended: self.suspended,
                invocation: self.startup,
                entrypoint: None,
                skip_egg_scripts: false,
                environment: variables
                    .into_iter()
                    .map(|v| {
                        (
                            v.env_variable.into(),
                            serde_json::Value::String(v.value.unwrap_or_default()),
                        )
                    })
                    .collect(),
                labels: IndexMap::new(),
                backups: backups.into_iter().map(|b| b.uuid).collect(),
                schedules: schedules
                    .into_iter()
                    .map(|s| {
                        Ok::<_, serde_json::Error>(wings_api::Schedule {
                            uuid: s.uuid,
                            triggers: s.triggers,
                            condition: s.condition,
                            actions: schedule_steps
                                .remove(&s.uuid)
                                .unwrap_or_default()
                                .into_iter()
                                .map(|step| {
                                    serde_json::to_value(wings_api::ScheduleAction {
                                        uuid: step.uuid,
                                        inner: serde_json::from_value(step.action)?,
                                    })
                                })
                                .try_collect_vec()?,
                        })
                    })
                    .try_collect_vec()?,
                allocations: wings_api::ServerConfigurationAllocations {
                    force_outgoing_ip: self.egg.force_outgoing_ip,
                    default: self.allocation.map(|a| {
                        wings_api::ServerConfigurationAllocationsDefault {
                            ip: compact_str::format_compact!("{}", a.allocation.ip.ip()),
                            port: a.allocation.port as u32,
                        }
                    }),
                    mappings: {
                        let mut mappings = IndexMap::new();
                        for allocation in allocations {
                            mappings
                                .entry(compact_str::format_compact!("{}", allocation.ip.ip()))
                                .or_insert_with(Vec::new)
                                .push(allocation.port as u32);
                        }

                        mappings
                    },
                },
                build: wings_api::ServerConfigurationBuild {
                    memory_limit: self.memory,
                    overhead_memory: self.memory_overhead,
                    swap: self.swap,
                    io_weight: self.io_weight.map(|w| w as u32),
                    cpu_limit: self.cpu as i64,
                    disk_space: self.disk as u64,
                    threads: {
                        let mut threads = compact_str::CompactString::default();
                        for cpu in &self.pinned_cpus {
                            if !threads.is_empty() {
                                threads.push(',');
                            }
                            threads.push_str(&cpu.to_string());
                        }

                        if threads.is_empty() {
                            None
                        } else {
                            Some(threads)
                        }
                    },
                    oom_disabled: true,
                },
                mounts: mounts
                    .into_iter()
                    .map(|m| wings_api::Mount {
                        source: m.source.into(),
                        target: m.target.into(),
                        read_only: m.read_only,
                    })
                    .collect(),
                egg: wings_api::ServerConfigurationEgg {
                    id: self.egg.uuid,
                    file_denylist: self.egg.file_denylist,
                },
                container: wings_api::ServerConfigurationContainer {
                    image: self.image,
                    timezone: self.timezone,
                    hugepages_passthrough_enabled: self.hugepages_passthrough_enabled,
                    kvm_passthrough_enabled: self.kvm_passthrough_enabled,
                    seccomp: wings_api::ServerConfigurationContainerSeccomp {
                        remove_allowed: vec![],
                    },
                },
                auto_kill: self.auto_kill,
                auto_start_behavior: self.auto_start_behavior.into(),
            },
            process_configuration: super::nest_egg::ProcessConfiguration {
                startup: self.egg.config_startup,
                stop: self.egg.config_stop,
                configs: self.egg.config_files,
            },
        })
    }
}

#[async_trait::async_trait]
impl super::IntoAdminApiObject for Server {
    type AdminApiObject = AdminApiServer;
    type ExtraArgs<'a> = &'a crate::storage::StorageUrlRetriever<'a>;

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        storage_url_retriever: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let feature_limits = ApiServerFeatureLimits::init_hooks(&self, state).await?;
        let api_object = AdminApiServer::init_hooks(&self, state).await?;

        let allocation_uuid = self.allocation.as_ref().map(|a| a.uuid);
        let allocation = match self.allocation {
            Some(a) => Some(a.into_api_object(state, allocation_uuid).await?),
            None => None,
        };

        let feature_limits = finish_extendible!(
            ApiServerFeatureLimits {
                allocations: self.allocation_limit,
                databases: self.database_limit,
                backups: self.backup_limit,
                schedules: self.schedule_limit,
            },
            feature_limits,
            state
        )?;

        let (node, backup_configuration, egg) = tokio::join!(
            async {
                match self.node.fetch_cached(&state.database).await {
                    Ok(node) => Ok(node.into_admin_api_object(state, ()).await?),
                    Err(err) => Err(err),
                }
            },
            async {
                if let Some(backup_configuration) = self.backup_configuration {
                    if let Ok(backup_configuration) =
                        backup_configuration.fetch_cached(&state.database).await
                    {
                        backup_configuration
                            .into_admin_api_object(state, ())
                            .await
                            .ok()
                    } else {
                        None
                    }
                } else {
                    None
                }
            },
            self.egg.into_admin_api_object(state, ())
        );

        let api_objct = finish_extendible!(
            AdminApiServer {
                uuid: self.uuid,
                uuid_short: format!("{:08x}", self.uuid_short).into(),
                external_id: self.external_id,
                allocation,
                node: node?,
                owner: self
                    .owner
                    .into_api_full_object(state, storage_url_retriever)
                    .await?,
                egg: egg?,
                nest: self.nest.into_admin_api_object(state, ()).await?,
                backup_configuration,
                status: self.status,
                is_suspended: self.suspended,
                is_transferring: self.destination_node.is_some(),
                name: self.name,
                description: self.description,
                limits: AdminApiServerLimits {
                    cpu: self.cpu,
                    memory: self.memory,
                    memory_overhead: self.memory_overhead,
                    swap: self.swap,
                    disk: self.disk,
                    io_weight: self.io_weight,
                },
                pinned_cpus: self.pinned_cpus,
                feature_limits,
                startup: self.startup,
                image: self.image,
                auto_kill: self.auto_kill,
                auto_start_behavior: self.auto_start_behavior,
                timezone: self.timezone,
                hugepages_passthrough_enabled: self.hugepages_passthrough_enabled,
                kvm_passthrough_enabled: self.kvm_passthrough_enabled,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_objct)
    }
}

#[async_trait::async_trait]
impl super::IntoApiObject for Server {
    type ApiObject = ApiServer;
    type ExtraArgs<'a> = &'a super::user::User;

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        user: Self::ExtraArgs<'a>,
    ) -> Result<Self::ApiObject, crate::database::DatabaseError> {
        let feature_limits = ApiServerFeatureLimits::init_hooks(&self, state).await?;
        let api_object = ApiServer::init_hooks(&self, state).await?;

        let allocation_uuid = self.allocation.as_ref().map(|a| a.uuid);
        let allocation = match self.allocation {
            Some(a) => Some(a.into_api_object(state, allocation_uuid).await?),
            None => None,
        };

        let (node, egg_configuration) = tokio::try_join!(
            self.node.fetch_cached(&state.database),
            self.egg.configuration(&state.database)
        )?;

        let feature_limits = finish_extendible!(
            ApiServerFeatureLimits {
                allocations: self.allocation_limit,
                databases: self.database_limit,
                backups: self.backup_limit,
                schedules: self.schedule_limit,
            },
            feature_limits,
            state
        )?;

        let api_object = finish_extendible!(
            ApiServer {
                uuid: self.uuid,
                uuid_short: format!("{:08x}", self.uuid_short).into(),
                allocation,
                egg: self.egg.into_api_object(state, ()).await?,
                egg_configuration: egg_configuration.into_api_object(state, ()).await?,
                permissions: if user.admin {
                    vec!["*".into()]
                } else {
                    self.subuser_permissions
                        .map_or_else(|| vec!["*".into()], |p| p.to_vec())
                },
                location_uuid: node.location.uuid,
                location_name: node.location.name,
                node_uuid: node.uuid,
                node_name: node.name,
                node_maintenance_enabled: node.maintenance_enabled,
                sftp_host: node.sftp_host.unwrap_or_else(|| {
                    node.public_url
                        .unwrap_or(node.url)
                        .host_str()
                        .unwrap_or("unknown.sftp.host")
                        .into()
                }),
                sftp_port: node.sftp_port,
                status: self.status,
                is_suspended: self.suspended,
                is_owner: self.owner.uuid == user.uuid,
                is_transferring: self.destination_node.is_some(),
                name: self.name,
                description: self.description,
                limits: ApiServerLimits {
                    cpu: self.cpu,
                    memory: self.memory,
                    swap: self.swap,
                    disk: self.disk,
                },
                feature_limits,
                startup: self.startup,
                image: self.image,
                auto_kill: self.auto_kill,
                auto_start_behavior: self.auto_start_behavior,
                timezone: self.timezone,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[async_trait::async_trait]
impl ByUuid for Server {
    async fn by_uuid(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
    ) -> Result<Self, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM servers
            LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
            LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
            JOIN users ON users.uuid = servers.owner_uuid
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
            JOIN nests ON nests.uuid = nest_eggs.nest_uuid
            WHERE servers.uuid = $1
            "#,
            Self::columns_sql(None)
        ))
        .bind(uuid)
        .fetch_one(database.read())
        .await?;

        Self::map(None, &row)
    }
}

#[derive(ToSchema, Validate, Deserialize)]
pub struct CreateServerOptions {
    #[garde(skip)]
    pub node_uuid: uuid::Uuid,
    #[garde(skip)]
    pub owner_uuid: uuid::Uuid,
    #[garde(skip)]
    pub egg_uuid: uuid::Uuid,
    #[garde(skip)]
    pub backup_configuration_uuid: Option<uuid::Uuid>,

    #[garde(skip)]
    pub allocation_uuid: Option<uuid::Uuid>,
    #[garde(skip)]
    pub allocation_uuids: Vec<uuid::Uuid>,

    #[garde(skip)]
    pub start_on_completion: bool,
    #[garde(skip)]
    pub skip_installer: bool,

    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub external_id: Option<compact_str::CompactString>,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: compact_str::CompactString,
    #[garde(length(chars, min = 1, max = 1024))]
    #[schema(min_length = 1, max_length = 1024)]
    pub description: Option<compact_str::CompactString>,

    #[garde(dive)]
    pub limits: AdminApiServerLimits,
    #[garde(inner(range(min = 0)))]
    pub pinned_cpus: Vec<i16>,

    #[garde(length(chars, min = 1, max = 8192))]
    #[schema(min_length = 1, max_length = 8192)]
    pub startup: compact_str::CompactString,
    #[garde(length(chars, min = 2, max = 255))]
    #[schema(min_length = 2, max_length = 255)]
    pub image: compact_str::CompactString,
    #[garde(skip)]
    #[schema(value_type = Option<String>)]
    pub timezone: Option<chrono_tz::Tz>,

    #[garde(skip)]
    pub hugepages_passthrough_enabled: bool,
    #[garde(skip)]
    pub kvm_passthrough_enabled: bool,

    #[garde(dive)]
    pub feature_limits: ApiServerFeatureLimits,
    #[garde(skip)]
    pub variables: HashMap<uuid::Uuid, compact_str::CompactString>,
}

#[async_trait::async_trait]
impl CreatableModel for Server {
    type CreateOptions<'a> = CreateServerOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<Server>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        let node = super::node::Node::by_uuid_optional(&state.database, options.node_uuid)
            .await?
            .ok_or(crate::database::InvalidRelationError("node"))?;

        super::user::User::by_uuid_optional(&state.database, options.owner_uuid)
            .await?
            .ok_or(crate::database::InvalidRelationError("owner"))?;

        super::nest_egg::NestEgg::by_uuid_optional(&state.database, options.egg_uuid)
            .await?
            .ok_or(crate::database::InvalidRelationError("egg"))?;

        if let Some(backup_configuration_uuid) = options.backup_configuration_uuid {
            super::backup_configuration::BackupConfiguration::by_uuid_optional(
                &state.database,
                backup_configuration_uuid,
            )
            .await?
            .ok_or(crate::database::InvalidRelationError(
                "backup_configuration",
            ))?;
        }

        let mut transaction = state.database.write().begin().await?;
        let mut attempts = 0;

        loop {
            let server_uuid = uuid::Uuid::new_v4();
            let uuid_short = server_uuid.as_fields().0 as i32;

            let mut query_builder = InsertQueryBuilder::new("servers");

            Self::run_create_handlers(&mut options, &mut query_builder, state, &mut transaction)
                .await?;

            query_builder
                .set("uuid", server_uuid)
                .set("uuid_short", uuid_short)
                .set("external_id", &options.external_id)
                .set("node_uuid", options.node_uuid)
                .set("owner_uuid", options.owner_uuid)
                .set("egg_uuid", options.egg_uuid)
                .set(
                    "backup_configuration_uuid",
                    options.backup_configuration_uuid,
                )
                .set("name", &options.name)
                .set("description", &options.description)
                .set(
                    "status",
                    if options.skip_installer {
                        None::<ServerStatus>
                    } else {
                        Some(ServerStatus::Installing)
                    },
                )
                .set("memory", options.limits.memory)
                .set("memory_overhead", options.limits.memory_overhead)
                .set("swap", options.limits.swap)
                .set("disk", options.limits.disk)
                .set("io_weight", options.limits.io_weight)
                .set("cpu", options.limits.cpu)
                .set("pinned_cpus", &options.pinned_cpus)
                .set("startup", &options.startup)
                .set("image", &options.image)
                .set("timezone", options.timezone.as_ref().map(|t| t.name()))
                .set(
                    "hugepages_passthrough_enabled",
                    options.hugepages_passthrough_enabled,
                )
                .set("kvm_passthrough_enabled", options.kvm_passthrough_enabled)
                .set("allocation_limit", options.feature_limits.allocations)
                .set("database_limit", options.feature_limits.databases)
                .set("backup_limit", options.feature_limits.backups)
                .set("schedule_limit", options.feature_limits.schedules);

            match query_builder
                .returning("uuid")
                .fetch_one(&mut *transaction)
                .await
            {
                Ok(_) => {
                    let allocation_uuid: Option<uuid::Uuid> =
                        if let Some(allocation_uuid) = options.allocation_uuid {
                            let row = sqlx::query(
                                r#"
                                INSERT INTO server_allocations (server_uuid, allocation_uuid)
                                VALUES ($1, $2)
                                RETURNING uuid
                                "#,
                            )
                            .bind(server_uuid)
                            .bind(allocation_uuid)
                            .fetch_one(&mut *transaction)
                            .await?;

                            Some(row.get("uuid"))
                        } else {
                            None
                        };

                    for allocation_uuid in &options.allocation_uuids {
                        sqlx::query(
                            r#"
                            INSERT INTO server_allocations (server_uuid, allocation_uuid)
                            VALUES ($1, $2)
                            "#,
                        )
                        .bind(server_uuid)
                        .bind(allocation_uuid)
                        .execute(&mut *transaction)
                        .await?;
                    }

                    sqlx::query(
                        r#"
                        UPDATE servers
                        SET allocation_uuid = $1
                        WHERE servers.uuid = $2
                        "#,
                    )
                    .bind(allocation_uuid)
                    .bind(server_uuid)
                    .execute(&mut *transaction)
                    .await?;

                    for (variable_uuid, value) in &options.variables {
                        sqlx::query(
                            r#"
                            INSERT INTO server_variables (server_uuid, variable_uuid, value)
                            VALUES ($1, $2, $3)
                            "#,
                        )
                        .bind(server_uuid)
                        .bind(variable_uuid)
                        .bind(value.as_str())
                        .execute(&mut *transaction)
                        .await?;
                    }

                    transaction.commit().await?;

                    if let Err(err) = node
                        .api_client(&state.database)
                        .await?
                        .post_servers(&wings_api::servers::post::RequestBody {
                            uuid: server_uuid,
                            start_on_completion: options.start_on_completion,
                            skip_scripts: options.skip_installer,
                        })
                        .await
                    {
                        tracing::error!(server = %server_uuid, node = %node.uuid, "failed to create server: {:?}", err);

                        sqlx::query!("DELETE FROM servers WHERE servers.uuid = $1", server_uuid)
                            .execute(state.database.write())
                            .await?;

                        return Err(err.into());
                    }

                    return Self::by_uuid(&state.database, server_uuid).await;
                }
                Err(_) if attempts < 8 => {
                    attempts += 1;
                    continue;
                }
                Err(err) => {
                    transaction.rollback().await?;
                    return Err(err.into());
                }
            }
        }
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Clone, Default)]
pub struct UpdateServerOptions {
    #[garde(skip)]
    pub owner_uuid: Option<uuid::Uuid>,
    #[garde(skip)]
    pub egg_uuid: Option<uuid::Uuid>,
    #[garde(skip)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub backup_configuration_uuid: Option<Option<uuid::Uuid>>,

    #[garde(skip)]
    pub suspended: Option<bool>,

    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub external_id: Option<Option<compact_str::CompactString>>,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: Option<compact_str::CompactString>,
    #[garde(length(chars, min = 1, max = 1024))]
    #[schema(min_length = 1, max_length = 1024)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub description: Option<Option<compact_str::CompactString>>,

    #[garde(dive)]
    pub limits: Option<AdminApiServerLimits>,
    #[garde(inner(inner(range(min = 0))))]
    pub pinned_cpus: Option<Vec<i16>>,

    #[garde(length(chars, min = 1, max = 8192))]
    #[schema(min_length = 1, max_length = 8192)]
    pub startup: Option<compact_str::CompactString>,
    #[garde(length(chars, min = 2, max = 255))]
    #[schema(min_length = 2, max_length = 255)]
    pub image: Option<compact_str::CompactString>,
    #[garde(skip)]
    #[schema(value_type = Option<Option<String>>)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub timezone: Option<Option<chrono_tz::Tz>>,

    #[garde(skip)]
    pub hugepages_passthrough_enabled: Option<bool>,
    #[garde(skip)]
    pub kvm_passthrough_enabled: Option<bool>,

    #[garde(dive)]
    pub feature_limits: Option<ApiServerFeatureLimits>,
}

#[async_trait::async_trait]
impl UpdatableModel for Server {
    type UpdateOptions = UpdateServerOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateListenerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateListenerList<Server>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &UPDATE_LISTENERS
    }

    async fn update(
        &mut self,
        state: &crate::State,
        mut options: Self::UpdateOptions,
    ) -> Result<(), crate::database::DatabaseError> {
        options.validate()?;

        let owner = if let Some(owner_uuid) = options.owner_uuid {
            Some(
                super::user::User::by_uuid_optional(&state.database, owner_uuid)
                    .await?
                    .ok_or(crate::database::InvalidRelationError("owner"))?,
            )
        } else {
            None
        };

        let egg = if let Some(egg_uuid) = options.egg_uuid {
            Some(
                super::nest_egg::NestEgg::by_uuid_optional(&state.database, egg_uuid)
                    .await?
                    .ok_or(crate::database::InvalidRelationError("egg"))?,
            )
        } else {
            None
        };

        let backup_configuration =
            if let Some(backup_configuration_uuid) = &options.backup_configuration_uuid {
                match backup_configuration_uuid {
                    Some(uuid) => {
                        super::backup_configuration::BackupConfiguration::by_uuid_optional(
                            &state.database,
                            *uuid,
                        )
                        .await?
                        .ok_or(crate::database::InvalidRelationError(
                            "backup_configuration",
                        ))?;

                        Some(Some(
                            super::backup_configuration::BackupConfiguration::get_fetchable(*uuid),
                        ))
                    }
                    None => Some(None),
                }
            } else {
                None
            };

        let mut transaction = state.database.write().begin().await?;

        let mut query_builder = UpdateQueryBuilder::new("servers");

        Self::run_update_handlers(
            self,
            &mut options,
            &mut query_builder,
            state,
            &mut transaction,
        )
        .await?;

        query_builder
            .set("owner_uuid", options.owner_uuid.as_ref())
            .set("egg_uuid", options.egg_uuid.as_ref())
            .set(
                "backup_configuration_uuid",
                options
                    .backup_configuration_uuid
                    .as_ref()
                    .map(|u| u.as_ref()),
            )
            .set("suspended", options.suspended)
            .set(
                "external_id",
                options.external_id.as_ref().map(|e| e.as_ref()),
            )
            .set("name", options.name.as_ref())
            .set(
                "description",
                options.description.as_ref().map(|d| d.as_ref()),
            )
            .set("pinned_cpus", options.pinned_cpus.as_ref())
            .set("startup", options.startup.as_ref())
            .set("image", options.image.as_ref())
            .set(
                "timezone",
                options
                    .timezone
                    .as_ref()
                    .map(|t| t.as_ref().map(|t| t.name())),
            )
            .set(
                "hugepages_passthrough_enabled",
                options.hugepages_passthrough_enabled,
            )
            .set("kvm_passthrough_enabled", options.kvm_passthrough_enabled);

        if let Some(limits) = &options.limits {
            query_builder
                .set("cpu", Some(limits.cpu))
                .set("memory", Some(limits.memory))
                .set("memory_overhead", Some(limits.memory_overhead))
                .set("swap", Some(limits.swap))
                .set("disk", Some(limits.disk))
                .set("io_weight", Some(limits.io_weight));
        }

        if let Some(feature_limits) = &options.feature_limits {
            query_builder
                .set("allocation_limit", Some(feature_limits.allocations))
                .set("database_limit", Some(feature_limits.databases))
                .set("backup_limit", Some(feature_limits.backups))
                .set("schedule_limit", Some(feature_limits.schedules));
        }

        query_builder.where_eq("uuid", self.uuid);

        query_builder.execute(&mut *transaction).await?;

        if let Some(owner) = owner {
            self.owner = owner;
        }
        if let Some(egg) = egg {
            *self.egg = egg;
        }
        if let Some(backup_configuration) = backup_configuration {
            self.backup_configuration = backup_configuration;
        }
        if let Some(suspended) = options.suspended {
            self.suspended = suspended;
        }
        if let Some(external_id) = options.external_id {
            self.external_id = external_id;
        }
        if let Some(name) = options.name {
            self.name = name;
        }
        if let Some(description) = options.description {
            self.description = description;
        }
        if let Some(limits) = options.limits {
            self.cpu = limits.cpu;
            self.memory = limits.memory;
            self.memory_overhead = limits.memory_overhead;
            self.swap = limits.swap;
            self.disk = limits.disk;
            self.io_weight = limits.io_weight;
        }
        if let Some(pinned_cpus) = options.pinned_cpus {
            self.pinned_cpus = pinned_cpus;
        }
        if let Some(startup) = options.startup {
            self.startup = startup;
        }
        if let Some(image) = options.image {
            self.image = image;
        }
        if let Some(timezone) = options.timezone {
            self.timezone = timezone.map(|t| t.name().into());
        }
        if let Some(hugepages_passthrough_enabled) = options.hugepages_passthrough_enabled {
            self.hugepages_passthrough_enabled = hugepages_passthrough_enabled;
        }
        if let Some(kvm_passthrough_enabled) = options.kvm_passthrough_enabled {
            self.kvm_passthrough_enabled = kvm_passthrough_enabled;
        }
        if let Some(feature_limits) = options.feature_limits {
            self.allocation_limit = feature_limits.allocations;
            self.database_limit = feature_limits.databases;
            self.backup_limit = feature_limits.backups;
            self.schedule_limit = feature_limits.schedules;
        }

        transaction.commit().await?;

        Ok(())
    }
}

#[derive(Default)]
pub struct DeleteServerOptions {
    pub force: bool,
}

#[async_trait::async_trait]
impl DeletableModel for Server {
    type DeleteOptions = DeleteServerOptions;

    fn get_delete_handlers() -> &'static LazyLock<DeleteListenerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteListenerList<Server>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &DELETE_LISTENERS
    }

    async fn delete(
        &self,
        state: &crate::State,
        options: Self::DeleteOptions,
    ) -> Result<(), anyhow::Error> {
        let node = self.node.fetch_cached(&state.database).await?;
        let databases =
            super::server_database::ServerDatabase::all_by_server_uuid(&state.database, self.uuid)
                .await?;

        let mut transaction = state.database.write().begin().await?;
        self.run_delete_handlers(&options, state, &mut transaction)
            .await?;

        let state = state.clone();
        let server_uuid = self.uuid;

        tokio::spawn(async move {
            for db in databases {
                match db.delete(&state, super::server_database::DeleteServerDatabaseOptions { force: options.force }).await {
                    Ok(_) => {}
                    Err(err) => {
                        tracing::error!(server = %server_uuid, "failed to delete database: {:?}", err);

                        if !options.force {
                            return Err(err);
                        }
                    }
                }
            }

            sqlx::query!("DELETE FROM servers WHERE servers.uuid = $1", server_uuid)
                .execute(&mut *transaction)
                .await?;

            match node
                .api_client(&state.database)
                .await?
                .delete_servers_server(server_uuid)
                .await
            {
                Ok(_) => {
                    transaction.commit().await?;
                    Ok(())
                }
                Err(err) => {
                    tracing::error!(server = %server_uuid, node = %node.uuid, "failed to delete server: {:?}", err);

                    if options.force {
                        transaction.commit().await?;
                        Ok(())
                    } else {
                        transaction.rollback().await?;
                        Err(err.into())
                    }
                }
            }
        }).await?
    }
}

#[derive(ToSchema, Serialize)]
#[schema(title = "RemoteServer")]
pub struct RemoteApiServer {
    settings: wings_api::ServerConfiguration,
    process_configuration: super::nest_egg::ProcessConfiguration,
}

#[derive(ToSchema, Validate, Serialize, Deserialize, Clone, Copy)]
pub struct AdminApiServerLimits {
    #[garde(range(min = 0))]
    #[schema(minimum = 0)]
    pub cpu: i32,
    #[garde(range(min = 0))]
    #[schema(minimum = 0)]
    pub memory: i64,
    #[garde(range(min = 0))]
    #[schema(minimum = 0)]
    pub memory_overhead: i64,
    #[garde(range(min = -1))]
    #[schema(minimum = -1)]
    pub swap: i64,
    #[garde(range(min = 0))]
    #[schema(minimum = 0)]
    pub disk: i64,
    #[garde(range(min = 0, max = 1000))]
    #[schema(minimum = 0, maximum = 1000)]
    pub io_weight: Option<i16>,
}

#[derive(ToSchema, Validate, Serialize, Deserialize, Clone, Copy)]
pub struct ApiServerLimits {
    #[garde(range(min = 0))]
    #[schema(minimum = 0)]
    pub cpu: i32,
    #[garde(range(min = 0))]
    #[schema(minimum = 0)]
    pub memory: i64,
    #[garde(range(min = -1))]
    #[schema(minimum = -1)]
    pub swap: i64,
    #[garde(range(min = 0))]
    #[schema(minimum = 0)]
    pub disk: i64,
}

#[schema_extension_derive::extendible]
#[init_args(Server, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Validate, Serialize, Deserialize, Clone)]
pub struct ApiServerFeatureLimits {
    #[garde(range(min = 0))]
    #[schema(minimum = 0)]
    pub allocations: i32,
    #[garde(range(min = 0))]
    #[schema(minimum = 0)]
    pub databases: i32,
    #[garde(range(min = 0))]
    #[schema(minimum = 0)]
    pub backups: i32,
    #[garde(range(min = 0))]
    #[schema(minimum = 0)]
    pub schedules: i32,
}

#[schema_extension_derive::extendible]
#[init_args(Server, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "AdminServer")]
pub struct AdminApiServer {
    pub uuid: uuid::Uuid,
    pub uuid_short: compact_str::CompactString,
    pub external_id: Option<compact_str::CompactString>,
    pub allocation: Option<super::server_allocation::ApiServerAllocation>,
    pub node: super::node::AdminApiNode,
    pub owner: super::user::ApiFullUser,
    pub egg: super::nest_egg::AdminApiNestEgg,
    pub nest: super::nest::AdminApiNest,
    pub backup_configuration: Option<super::backup_configuration::AdminApiBackupConfiguration>,

    pub status: Option<ServerStatus>,

    pub is_suspended: bool,
    pub is_transferring: bool,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,

    #[schema(inline)]
    pub limits: AdminApiServerLimits,
    pub pinned_cpus: Vec<i16>,
    #[schema(inline)]
    pub feature_limits: ApiServerFeatureLimits,

    pub startup: compact_str::CompactString,
    pub image: compact_str::CompactString,
    #[schema(inline)]
    pub auto_kill: wings_api::ServerConfigurationAutoKill,
    pub auto_start_behavior: ServerAutoStartBehavior,
    pub timezone: Option<compact_str::CompactString>,

    pub hugepages_passthrough_enabled: bool,
    pub kvm_passthrough_enabled: bool,

    pub created: chrono::DateTime<chrono::Utc>,
}

#[schema_extension_derive::extendible]
#[init_args(Server, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "Server")]
pub struct ApiServer {
    pub uuid: uuid::Uuid,
    pub uuid_short: compact_str::CompactString,
    pub allocation: Option<super::server_allocation::ApiServerAllocation>,
    pub egg: super::nest_egg::ApiNestEgg,
    pub egg_configuration: super::egg_configuration::ApiEggConfiguration,

    pub status: Option<ServerStatus>,

    pub is_owner: bool,
    pub is_suspended: bool,
    pub is_transferring: bool,
    pub permissions: Vec<compact_str::CompactString>,

    pub location_uuid: uuid::Uuid,
    pub location_name: compact_str::CompactString,
    pub node_uuid: uuid::Uuid,
    pub node_name: compact_str::CompactString,
    pub node_maintenance_enabled: bool,

    pub sftp_host: compact_str::CompactString,
    pub sftp_port: i32,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,

    #[schema(inline)]
    pub limits: ApiServerLimits,
    #[schema(inline)]
    pub feature_limits: ApiServerFeatureLimits,

    pub startup: compact_str::CompactString,
    pub image: compact_str::CompactString,
    #[schema(inline)]
    pub auto_kill: wings_api::ServerConfigurationAutoKill,
    pub auto_start_behavior: ServerAutoStartBehavior,
    pub timezone: Option<compact_str::CompactString>,

    pub created: chrono::DateTime<chrono::Utc>,
}
