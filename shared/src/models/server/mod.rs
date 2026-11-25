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
    collections::{BTreeMap, HashMap, HashSet},
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

mod events;
pub use events::ServerEvent;

pub mod firewall;

pub type GetServer = crate::extract::ConsumingExtension<Server>;
pub type GetServerActivityLogger = crate::extract::ConsumingExtension<ServerActivityLogger>;

const WINGS_REQUEST_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(30);

/// The path is resolved before matching so that alternative spellings of the same file
/// (`/./x`, `//x`, `/a/../x`) cannot slip past an anchored pattern, since wings collapses
/// those components before touching the filesystem.
fn ignore_match_path(path: &std::path::Path) -> std::path::PathBuf {
    let path = crate::cap::CapFilesystem::resolve_path(path);

    match path.strip_prefix("/") {
        Ok(relative) => relative.to_path_buf(),
        Err(_) => path,
    }
}

fn is_path_ignored(
    list: &crate::ignore_list::IgnoreList,
    path: impl AsRef<std::path::Path>,
    is_dir: bool,
) -> bool {
    list.is_ignored(&ignore_match_path(path.as_ref()), is_dir)
}

fn is_path_ignored_subtree(
    list: &crate::ignore_list::IgnoreList,
    path: impl AsRef<std::path::Path>,
    is_dir: bool,
) -> bool {
    list.is_ignored_subtree(&ignore_match_path(path.as_ref()), is_dir)
}

type ServerAccess = (
    Vec<compact_str::CompactString>,
    Vec<compact_str::CompactString>,
);

/// Combines two grants (permissions, ignored files) on the same server.
fn merge_access(a: Option<ServerAccess>, b: Option<ServerAccess>) -> Option<ServerAccess> {
    let (a, b) = match (a, b) {
        (Some(a), Some(b)) => (a, b),
        (a, b) => return a.or(b),
    };

    let dominates = |x: &ServerAccess, y: &ServerAccess| {
        y.0.iter().all(|permission| x.0.contains(permission)) && y.1.ends_with(&x.1)
    };
    if dominates(&a, &b) {
        return Some(a);
    }
    if dominates(&b, &a) {
        return Some(b);
    }

    let ((mut permissions, mut a_ignored), (b_permissions, b_ignored)) = (a, b);
    permissions.extend(b_permissions);
    permissions.sort_unstable();
    permissions.dedup();

    let negates = |line: &compact_str::CompactString| line.trim().starts_with('!');
    let ignored_files = if a_ignored.ends_with(&b_ignored) {
        a_ignored
    } else if b_ignored.ends_with(&a_ignored) {
        b_ignored
    } else if !a_ignored.iter().chain(&b_ignored).any(negates) {
        a_ignored.extend(b_ignored);
        a_ignored
    } else {
        // a `!` re-include from one list could expose what the other one hides
        a_ignored
            .into_iter()
            .chain(b_ignored)
            .filter(|line| !negates(line))
            .collect()
    };

    Some((permissions, ignored_files))
}

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
    BackupRestoreFailed,
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

pub const MAX_TRANSFER_MULTIPLEX_CHANNELS: u64 = 16;

#[derive(Clone, Default)]
pub struct ServerInstallOptions {
    pub truncate_directory: bool,
    pub installation_script: Option<wings_api::InstallationScript>,
    pub start_on_completion: bool,
}

pub struct ServerTransferOptions {
    pub destination_node: super::node::Node,

    pub allocation_uuid: Option<uuid::Uuid>,
    pub allocation_uuids: Vec<uuid::Uuid>,
    pub variables: HashMap<uuid::Uuid, compact_str::CompactString>,

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
    pub team_uuid: Option<uuid::Uuid>,
    pub team_name: Option<compact_str::CompactString>,
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
    pub bandwidth_upload: i64,
    pub bandwidth_download: i64,
    pub io_weight: Option<i16>,
    pub cpu: i32,
    pub pinned_cpus: Vec<i16>,

    pub startup: compact_str::CompactString,
    pub image: compact_str::CompactString,
    pub labels: IndexMap<compact_str::CompactString, compact_str::CompactString>,
    pub auto_kill: wings_api::ServerConfigurationAutoKill,
    pub auto_start_behavior: ServerAutoStartBehavior,
    pub timezone: Option<compact_str::CompactString>,
    pub trash: Option<TrashSettings>,

    pub hugepages_passthrough_enabled: bool,
    pub kvm_passthrough_enabled: bool,

    pub allocation_limit: i32,
    pub database_limit: i32,
    pub backup_limit: i32,
    pub schedule_limit: i32,

    pub subuser_permissions: Option<Arc<Vec<compact_str::CompactString>>>,
    pub subuser_ignored_files: Option<Vec<compact_str::CompactString>>,
    #[serde(skip_serializing, skip_deserializing)]
    subuser_ignored_files_list: Option<Box<crate::ignore_list::IgnoreList>>,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl PreviewSample for Server {
    fn preview_sample(settings: &crate::settings::AppSettings) -> Self {
        let egg = super::nest_egg::NestEgg::preview_sample(settings);
        let nest = super::nest::Nest::preview_sample(settings);

        Self {
            uuid: uuid::Uuid::nil(),
            uuid_short: 0,
            external_id: None,
            allocation: None,
            destination_allocation_uuid: None,
            node: super::node::Node::get_fetchable(uuid::Uuid::nil()),
            destination_node: None,
            owner: super::user::User::preview_sample(settings),
            team_uuid: None,
            team_name: None,
            egg: Box::new(egg),
            nest: Box::new(nest),
            backup_configuration: None,
            status: None,
            suspended: false,
            name: "Example Server".into(),
            description: None,
            memory: 4096,
            memory_overhead: 0,
            swap: 0,
            disk: 10240,
            bandwidth_upload: 0,
            bandwidth_download: 0,
            io_weight: None,
            cpu: 200,
            pinned_cpus: Vec::new(),
            startup: "java -Xms128M -jar server.jar".into(),
            image: "ghcr.io/example/java:21".into(),
            labels: IndexMap::new(),
            auto_kill: wings_api::ServerConfigurationAutoKill {
                enabled: false,
                seconds: 30,
            },
            auto_start_behavior: ServerAutoStartBehavior::UnlessStopped,
            timezone: None,
            trash: None,
            hugepages_passthrough_enabled: false,
            kvm_passthrough_enabled: false,
            allocation_limit: 1,
            database_limit: 1,
            backup_limit: 3,
            schedule_limit: 5,
            subuser_permissions: None,
            subuser_ignored_files: None,
            subuser_ignored_files_list: None,
            created: chrono::Utc::now().naive_utc(),
            extension_data: Vec::new(),
        }
    }
}

impl BaseModel for Server {
    const NAME: &'static str = "server";

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
                "servers.team_uuid",
                compact_str::format_compact!("{prefix}team_uuid"),
            ),
            (
                "teams.name",
                compact_str::format_compact!("{prefix}team_name"),
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
                "servers.bandwidth_upload",
                compact_str::format_compact!("{prefix}bandwidth_upload"),
            ),
            (
                "servers.bandwidth_download",
                compact_str::format_compact!("{prefix}bandwidth_download"),
            ),
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
                "servers.labels",
                compact_str::format_compact!("{prefix}labels"),
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
                "servers.trash",
                compact_str::format_compact!("{prefix}trash"),
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

        let read_access = |permissions: &str, ignored_files: &str| {
            row.try_get::<Vec<compact_str::CompactString>, _>(permissions)
                .ok()
                .map(|permissions| (permissions, row.try_get(ignored_files).unwrap_or_default()))
        };
        let access = merge_access(
            read_access("subuser_permissions", "subuser_ignored_files"),
            read_access("team_preset_permissions", "team_preset_ignored_files"),
        );
        let (subuser_permissions, subuser_ignored_files) = access.unzip();

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
            team_uuid: row.try_get(compact_str::format_compact!("{prefix}team_uuid").as_str())?,
            team_name: row.try_get(compact_str::format_compact!("{prefix}team_name").as_str())?,
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
            bandwidth_upload: row
                .try_get(compact_str::format_compact!("{prefix}bandwidth_upload").as_str())?,
            bandwidth_download: row
                .try_get(compact_str::format_compact!("{prefix}bandwidth_download").as_str())?,
            io_weight: row.try_get(compact_str::format_compact!("{prefix}io_weight").as_str())?,
            cpu: row.try_get(compact_str::format_compact!("{prefix}cpu").as_str())?,
            pinned_cpus: row
                .try_get(compact_str::format_compact!("{prefix}pinned_cpus").as_str())?,
            startup: row.try_get(compact_str::format_compact!("{prefix}startup").as_str())?,
            image: row.try_get(compact_str::format_compact!("{prefix}image").as_str())?,
            labels: row
                .try_get::<sqlx::types::Json<_>, _>(
                    compact_str::format_compact!("{prefix}labels").as_str(),
                )?
                .0,
            auto_kill: row
                .try_get::<sqlx::types::Json<_>, _>(
                    compact_str::format_compact!("{prefix}auto_kill").as_str(),
                )?
                .0,
            auto_start_behavior: row
                .try_get(compact_str::format_compact!("{prefix}auto_start_behavior").as_str())?,
            timezone: row.try_get(compact_str::format_compact!("{prefix}timezone").as_str())?,
            trash: row
                .try_get::<Option<sqlx::types::Json<_>>, _>(
                    compact_str::format_compact!("{prefix}trash").as_str(),
                )?
                .map(|trash| trash.0),
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
            subuser_permissions: subuser_permissions.map(Arc::new),
            subuser_ignored_files,
            subuser_ignored_files_list: None,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }

    fn cache_invalidation_keys(&self) -> Vec<compact_str::CompactString> {
        vec![compact_str::format_compact!(
            "{}::{}",
            Self::NAME,
            self.uuid
        )]
    }
}

#[async_trait::async_trait]
impl ResolvableModel for Server {
    type Fingerprint = i32;

    fn uuid(&self) -> uuid::Uuid {
        self.uuid
    }

    fn fingerprint(&self) -> Self::Fingerprint {
        self.uuid_short
    }

    async fn resolve(
        database: &crate::database::Database,
        identifier: &str,
    ) -> Result<Option<Self>, anyhow::Error> {
        let Ok(uuid_short) = u32::from_str_radix(identifier, 16) else {
            return Ok(None);
        };

        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM servers
            LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
            LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
            JOIN users ON users.uuid = servers.owner_uuid
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
            JOIN nests ON nests.uuid = nest_eggs.nest_uuid
            LEFT JOIN teams ON teams.uuid = servers.team_uuid
            WHERE servers.uuid_short = $1
            "#,
            Self::columns_sql(None)
        )))
        .bind(uuid_short as i32)
        .fetch_optional(database.read())
        .await?;

        Ok(row.try_map(|row| Self::map(None, &row))?)
    }
}

impl Server {
    /// What `$1` holds on a server someone else owns: their own subuser entry and the preset of
    /// the team the server belongs to, merged by [`merge_access`].
    pub(super) const ACCESS_JOINS_SQL: &'static str = r#"
        LEFT JOIN server_subusers ON server_subusers.server_uuid = servers.uuid AND server_subusers.user_uuid = $1
        LEFT JOIN team_members ON team_members.team_uuid = servers.team_uuid AND team_members.user_uuid = $1 AND team_members.accepted IS NOT NULL
        LEFT JOIN team_presets ON team_presets.uuid = team_members.preset_uuid
    "#;

    const ACCESS_COLUMNS_SQL: &'static str = r#"
        CASE WHEN servers.owner_uuid = $1 THEN NULL ELSE server_subusers.permissions END AS subuser_permissions,
        CASE WHEN servers.owner_uuid = $1 THEN NULL ELSE server_subusers.ignored_files END AS subuser_ignored_files,
        CASE WHEN servers.owner_uuid = $1 THEN NULL ELSE team_presets.permissions END AS team_preset_permissions,
        CASE WHEN servers.owner_uuid = $1 THEN NULL ELSE team_presets.ignored_files END AS team_preset_ignored_files
    "#;

    /// Needs [`Self::ACCESS_JOINS_SQL`].
    pub(super) const ACCESSIBLE_SQL: &'static str = r#"
        (servers.owner_uuid = $1 OR server_subusers.user_uuid IS NOT NULL OR team_members.user_uuid IS NOT NULL)
    "#;

    const ACCESSIBLE_UUIDS_SQL: &'static str = r#"
        SELECT owned.uuid FROM servers owned WHERE owned.owner_uuid = $1
        UNION ALL
        SELECT server_subusers.server_uuid FROM server_subusers WHERE server_subusers.user_uuid = $1
        UNION ALL
        SELECT team_servers.uuid
        FROM team_members memberships
        JOIN servers team_servers ON team_servers.team_uuid = memberships.team_uuid
        WHERE memberships.user_uuid = $1 AND memberships.accepted IS NOT NULL
    "#;

    /// Why the client API refuses to act on this server, if it does. Checked in the order the
    /// client route guard uses, so a suspended server never reports anything past that.
    pub fn unavailable_reason(&self) -> Option<&'static str> {
        if self.suspended {
            Some("server is suspended")
        } else if self.destination_node.is_some() {
            Some("server is being transferred")
        } else {
            match self.status? {
                ServerStatus::Installing => Some("server is currently installing"),
                ServerStatus::InstallFailed => Some("server has failed its installation process"),
                ServerStatus::RestoringBackup => Some("server is restoring from a backup"),
                ServerStatus::BackupRestoreFailed => Some("server has failed to restore a backup"),
            }
        }
    }

    pub async fn by_node_uuid_uuid(
        database: &crate::database::Database,
        node_uuid: uuid::Uuid,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM servers
            LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
            LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
            JOIN users ON users.uuid = servers.owner_uuid
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
            JOIN nests ON nests.uuid = nest_eggs.nest_uuid
            LEFT JOIN teams ON teams.uuid = servers.team_uuid
            WHERE (servers.node_uuid = $1 OR servers.destination_node_uuid = $1) AND servers.uuid = $2
            "#,
            Self::columns_sql(None)
        )))
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
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM servers
            LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
            LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
            JOIN users ON users.uuid = servers.owner_uuid
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
            JOIN nests ON nests.uuid = nest_eggs.nest_uuid
            LEFT JOIN teams ON teams.uuid = servers.team_uuid
            WHERE servers.external_id = $1
            "#,
            Self::columns_sql(None)
        )))
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
            LEFT JOIN teams ON teams.uuid = servers.team_uuid
            WHERE servers.{} = $1
            "#,
            Self::columns_sql(None),
            match identifier.len() {
                8 => "uuid_short",
                36 => "uuid",
                _ => return Ok(None),
            }
        );

        let mut row = sqlx::query(sqlx::AssertSqlSafe(query));
        row = match identifier.len() {
            8 => match u32::from_str_radix(identifier, 16) {
                Ok(uuid_short) => row.bind(uuid_short as i32),
                Err(_) => return Ok(None),
            },
            36 => match uuid::Uuid::parse_str(identifier) {
                Ok(uuid) => row.bind(uuid),
                Err(_) => return Ok(None),
            },
            _ => return Ok(None),
        };
        let row = row.fetch_optional(database.read()).await?;

        row.try_map(|row| Self::map(None, &row))
    }

    /// Get a server by its identifier, ensuring the user has access to it.
    ///
    /// The server, the caller's subuser entry and their team preset are cached until they are
    /// written to.
    pub async fn by_user_identifier(
        database: &crate::database::Database,
        permissions: &super::user::PermissionManager,
        identifier: &str,
    ) -> Result<Option<Self>, anyhow::Error> {
        let server = match identifier.len() {
            8 => Self::resolve_cached(database, identifier).await?,
            36 => match uuid::Uuid::parse_str(identifier) {
                Ok(uuid) => Self::by_uuid_optional_cached(database, uuid).await?,
                Err(_) => None,
            },
            _ => None,
        };

        let Some(mut server) = server else {
            return Ok(None);
        };

        if server.owner.uuid == permissions.user_uuid() {
            return Ok(Some(server));
        }

        let (subuser_access, team_access) = tokio::try_join!(
            super::server_subuser::ServerSubuser::permissions_by_server_uuid_user_uuid_cached(
                database,
                server.uuid,
                permissions.user_uuid(),
            ),
            async {
                match server.team_uuid {
                    Some(team_uuid) => {
                        super::team_member::TeamMember::permissions_by_team_uuid_user_uuid_cached(
                            database,
                            team_uuid,
                            permissions.user_uuid(),
                        )
                        .await
                    }
                    None => Ok(None),
                }
            },
        )?;

        if let Some((subuser_permissions, ignored_files)) =
            merge_access(subuser_access, team_access)
        {
            server.subuser_permissions = Some(Arc::new(subuser_permissions));
            server.subuser_ignored_files = Some(ignored_files);

            return Ok(Some(server));
        }

        Ok(permissions
            .has_admin_permission("servers.read")
            .is_ok()
            .then_some(server))
    }

    pub async fn by_user_uuids(
        database: &crate::database::Database,
        permissions: &super::user::PermissionManager,
        uuids: &[uuid::Uuid],
    ) -> Result<Vec<Self>, crate::database::DatabaseError> {
        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}, {access_columns}
            FROM servers
            LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
            LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
            JOIN users ON users.uuid = servers.owner_uuid
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
            JOIN nests ON nests.uuid = nest_eggs.nest_uuid
            LEFT JOIN teams ON teams.uuid = servers.team_uuid
            {access_joins}
            WHERE servers.uuid = ANY($3) AND ({accessible} OR $2)
            ORDER BY array_position($3, servers.uuid)
            "#,
            Self::columns_sql(None),
            access_columns = Self::ACCESS_COLUMNS_SQL,
            access_joins = Self::ACCESS_JOINS_SQL,
            accessible = Self::ACCESSIBLE_SQL,
        )))
        .bind(permissions.user_uuid())
        .bind(permissions.has_admin_permission("servers.read").is_ok())
        .bind(uuids)
        .fetch_all(database.read())
        .await?;

        rows.into_iter()
            .map(|row| Self::map(None, &row))
            .try_collect_vec()
    }

    pub async fn by_owner_uuid_with_pagination(
        database: &crate::database::Database,
        owner_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        super::PaginatedQueryBuilder::new(
            Self::columns_sql(None),
            format!(
                r#"
                FROM servers
                LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
                LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
                JOIN users ON users.uuid = servers.owner_uuid
                LEFT JOIN roles ON roles.uuid = users.role_uuid
                JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
                JOIN nests ON nests.uuid = nest_eggs.nest_uuid
                LEFT JOIN teams ON teams.uuid = servers.team_uuid
                WHERE servers.owner_uuid = $1 AND {search}
                "#,
                search = super::search_sql(2, &["servers.name"], &["servers.uuid"]),
            ),
            "servers.created, servers.uuid",
        )
        .bind(owner_uuid)
        .bind(search)
        .fetch(database, page, per_page)
        .await
    }

    /// The servers of a team, with the access `user_uuid` holds on each of them.
    pub async fn by_team_uuid_with_pagination(
        database: &crate::database::Database,
        team_uuid: uuid::Uuid,
        user_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        super::PaginatedQueryBuilder::new(
            format!("{}, {}", Self::columns_sql(None), Self::ACCESS_COLUMNS_SQL),
            format!(
                r#"
                FROM servers
                LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
                LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
                JOIN users ON users.uuid = servers.owner_uuid
                LEFT JOIN roles ON roles.uuid = users.role_uuid
                JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
                JOIN nests ON nests.uuid = nest_eggs.nest_uuid
                LEFT JOIN teams ON teams.uuid = servers.team_uuid
                {access_joins}
                WHERE servers.team_uuid = $2 AND {search}
                "#,
                access_joins = Self::ACCESS_JOINS_SQL,
                search = super::search_sql(3, &["servers.name"], &["servers.uuid"]),
            ),
            "servers.created, servers.uuid",
        )
        .bind(user_uuid)
        .bind(team_uuid)
        .bind(search)
        .fetch(database, page, per_page)
        .await
    }

    /// The servers of the owner that are not part of the team yet.
    pub async fn available_by_team_uuid_owner_uuid_with_pagination(
        database: &crate::database::Database,
        team_uuid: uuid::Uuid,
        owner_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        super::PaginatedQueryBuilder::new(
            Self::columns_sql(None),
            format!(
                r#"
                FROM servers
                LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
                LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
                JOIN users ON users.uuid = servers.owner_uuid
                LEFT JOIN roles ON roles.uuid = users.role_uuid
                JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
                JOIN nests ON nests.uuid = nest_eggs.nest_uuid
                LEFT JOIN teams ON teams.uuid = servers.team_uuid
                WHERE servers.owner_uuid = $1 AND servers.team_uuid IS DISTINCT FROM $2 AND {search}
                "#,
                search = super::search_sql(3, &["servers.name"], &["servers.uuid"]),
            ),
            "servers.created, servers.uuid",
        )
        .bind(owner_uuid)
        .bind(team_uuid)
        .bind(search)
        .fetch(database, page, per_page)
        .await
    }

    pub async fn by_user_uuid_server_order_with_pagination(
        database: &crate::database::Database,
        permissions: &super::user::PermissionManager,
        server_order: &[uuid::Uuid],
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        super::PaginatedQueryBuilder::new(
            format!("{}, {}", Self::columns_sql(None), Self::ACCESS_COLUMNS_SQL),
            format!(
                r#"
                FROM servers
                LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
                LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
                JOIN users ON users.uuid = servers.owner_uuid
                LEFT JOIN roles ON roles.uuid = users.role_uuid
                JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
                JOIN nests ON nests.uuid = nest_eggs.nest_uuid
                LEFT JOIN teams ON teams.uuid = servers.team_uuid
                {access_joins}
                WHERE servers.uuid = ANY($2)
                    AND ({accessible} OR $4)
                    AND {search}
                "#,
                access_joins = Self::ACCESS_JOINS_SQL,
                accessible = Self::ACCESSIBLE_SQL,
                search = super::search_sql(3, &["servers.name", "users.username", "users.email"], &["servers.uuid"]),
            ),
            "array_position($2, servers.uuid), servers.created",
        )
        .bind(permissions.user_uuid())
        .bind(server_order)
        .bind(search)
        .bind(permissions.has_admin_permission("servers.read").is_ok())
        .fetch(database, page, per_page)
        .await
    }

    pub async fn by_user_uuid_with_pagination(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        super::PaginatedQueryBuilder::new(
            format!("{}, {}", Self::columns_sql(None), Self::ACCESS_COLUMNS_SQL),
            format!(
                r#"
                FROM servers
                LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
                LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
                JOIN users ON users.uuid = servers.owner_uuid
                LEFT JOIN roles ON roles.uuid = users.role_uuid
                JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
                JOIN nests ON nests.uuid = nest_eggs.nest_uuid
                LEFT JOIN teams ON teams.uuid = servers.team_uuid
                {access_joins}
                WHERE
                    servers.uuid IN ({accessible_uuids})
                    AND {search}
                "#,
                access_joins = Self::ACCESS_JOINS_SQL,
                accessible_uuids = Self::ACCESSIBLE_UUIDS_SQL,
                search = super::search_sql(2, &["servers.name", "users.username", "users.email"], &["servers.uuid"]),
            ),
            "servers.created, servers.uuid",
        )
        .bind(user_uuid)
        .bind(search)
        .fetch(database, page, per_page)
        .await
    }

    pub async fn all_uuids_by_node_uuid_user_uuid(
        database: &crate::database::Database,
        node_uuid: uuid::Uuid,
        user_uuid: uuid::Uuid,
    ) -> Result<Vec<uuid::Uuid>, crate::database::DatabaseError> {
        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT servers.uuid
            FROM servers
            WHERE servers.node_uuid = $2 AND servers.uuid IN ({})
            ORDER BY servers.created, servers.uuid
            "#,
            Self::ACCESSIBLE_UUIDS_SQL
        )))
        .bind(user_uuid)
        .bind(node_uuid)
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
        super::PaginatedQueryBuilder::new(
            format!("{}, {}", Self::columns_sql(None), Self::ACCESS_COLUMNS_SQL),
            format!(
                r#"
                FROM servers
                LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
                LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
                JOIN users ON users.uuid = servers.owner_uuid
                LEFT JOIN roles ON roles.uuid = users.role_uuid
                JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
                JOIN nests ON nests.uuid = nest_eggs.nest_uuid
                LEFT JOIN teams ON teams.uuid = servers.team_uuid
                {access_joins}
                WHERE
                    NOT {accessible}
                    AND {search}
                "#,
                access_joins = Self::ACCESS_JOINS_SQL,
                accessible = Self::ACCESSIBLE_SQL,
                search = super::search_sql(2, &["servers.name", "users.username", "users.email"], &["servers.uuid"]),
            ),
            "servers.created, servers.uuid",
        )
        .bind(user_uuid)
        .bind(search)
        .fetch(database, page, per_page)
        .await
    }

    /// Servers the user may connect `server_uuid` to over the private network: on the mesh, and
    /// in a state the client API would let them act on at all.
    pub async fn tunnel_available_by_user_uuid_with_pagination(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
        server_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
        exclude: &HashSet<(uuid::Uuid, uuid::Uuid)>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let (excluded_egg_uuids, excluded_node_uuids): (Vec<_>, Vec<_>) =
            exclude.iter().copied().unzip();

        super::PaginatedQueryBuilder::new(
            format!("{}, {}", Self::columns_sql(None), Self::ACCESS_COLUMNS_SQL),
            format!(
                r#"
                FROM server_tunnels
                JOIN servers ON servers.uuid = server_tunnels.server_uuid
                LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
                LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
                JOIN users ON users.uuid = servers.owner_uuid
                LEFT JOIN roles ON roles.uuid = users.role_uuid
                JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
                JOIN nests ON nests.uuid = nest_eggs.nest_uuid
                LEFT JOIN teams ON teams.uuid = servers.team_uuid
                {access_joins}
                WHERE
                    servers.uuid IN ({accessible_uuids})
                    AND servers.uuid != $2
                    AND NOT servers.suspended
                    AND servers.destination_node_uuid IS NULL
                    AND servers.status IS NULL
                    AND (servers.egg_uuid, servers.node_uuid) NOT IN (SELECT * FROM UNNEST($4::uuid[], $5::uuid[]))
                    AND {search}
                "#,
                access_joins = Self::ACCESS_JOINS_SQL,
                accessible_uuids = Self::ACCESSIBLE_UUIDS_SQL,
                search = super::search_sql(3, &["servers.name", "users.username", "users.email"], &["servers.uuid"]),
            ),
            "servers.created, servers.uuid",
        )
        .bind(user_uuid)
        .bind(server_uuid)
        .bind(search)
        .bind(excluded_egg_uuids)
        .bind(excluded_node_uuids)
        .fetch(database, page, per_page)
        .await
    }

    pub async fn tunnel_available_by_not_user_uuid_with_pagination(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
        server_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
        exclude: &HashSet<(uuid::Uuid, uuid::Uuid)>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let (excluded_egg_uuids, excluded_node_uuids): (Vec<_>, Vec<_>) =
            exclude.iter().copied().unzip();

        super::PaginatedQueryBuilder::new(
            format!("{}, {}", Self::columns_sql(None), Self::ACCESS_COLUMNS_SQL),
            format!(
                r#"
                FROM server_tunnels
                JOIN servers ON servers.uuid = server_tunnels.server_uuid
                LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
                LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
                JOIN users ON users.uuid = servers.owner_uuid
                LEFT JOIN roles ON roles.uuid = users.role_uuid
                JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
                JOIN nests ON nests.uuid = nest_eggs.nest_uuid
                LEFT JOIN teams ON teams.uuid = servers.team_uuid
                {access_joins}
                WHERE
                    NOT {accessible}
                    AND servers.uuid != $2
                    AND NOT servers.suspended
                    AND servers.destination_node_uuid IS NULL
                    AND servers.status IS NULL
                    AND (servers.egg_uuid, servers.node_uuid) NOT IN (SELECT * FROM UNNEST($4::uuid[], $5::uuid[]))
                    AND {search}
                "#,
                access_joins = Self::ACCESS_JOINS_SQL,
                accessible = Self::ACCESSIBLE_SQL,
                search = super::search_sql(3, &["servers.name", "users.username", "users.email"], &["servers.uuid"]),
            ),
            "servers.created, servers.uuid",
        )
        .bind(user_uuid)
        .bind(server_uuid)
        .bind(search)
        .bind(excluded_egg_uuids)
        .bind(excluded_node_uuids)
        .fetch(database, page, per_page)
        .await
    }

    pub async fn all_with_firewall_by_egg_node_pairs(
        database: &crate::database::Database,
        pairs: &HashSet<(uuid::Uuid, uuid::Uuid)>,
    ) -> Result<Vec<Self>, crate::database::DatabaseError> {
        let (egg_uuids, node_uuids): (Vec<_>, Vec<_>) = pairs.iter().copied().unzip();

        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM server_firewalls
            JOIN servers ON servers.uuid = server_firewalls.server_uuid
            LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
            LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
            JOIN users ON users.uuid = servers.owner_uuid
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
            JOIN nests ON nests.uuid = nest_eggs.nest_uuid
            LEFT JOIN teams ON teams.uuid = servers.team_uuid
            WHERE (servers.egg_uuid, servers.node_uuid) IN (SELECT * FROM UNNEST($1::uuid[], $2::uuid[]))
            "#,
            Self::columns_sql(None)
        )))
        .bind(egg_uuids)
        .bind(node_uuids)
        .fetch_all(database.write())
        .await?;

        rows.into_iter()
            .map(|row| Self::map(None, &row))
            .try_collect_vec()
    }

    pub async fn by_node_uuid_with_pagination(
        database: &crate::database::Database,
        node_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        super::PaginatedQueryBuilder::new(
            Self::columns_sql(None),
            format!(
                r#"
                FROM servers
                LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
                LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
                JOIN users ON users.uuid = servers.owner_uuid
                LEFT JOIN roles ON roles.uuid = users.role_uuid
                JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
                JOIN nests ON nests.uuid = nest_eggs.nest_uuid
                LEFT JOIN teams ON teams.uuid = servers.team_uuid
                WHERE servers.node_uuid = $1 AND {search}
                "#,
                search = super::search_sql(2, &["servers.name"], &["servers.uuid"]),
            ),
            "servers.created, servers.uuid",
        )
        .bind(node_uuid)
        .bind(search)
        .fetch(database, page, per_page)
        .await
    }

    pub async fn by_node_uuid_transferring_with_pagination(
        database: &crate::database::Database,
        node_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        super::PaginatedQueryBuilder::new(
            Self::columns_sql(None),
            format!(
                r#"
                FROM servers
                LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
                LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
                JOIN users ON users.uuid = servers.owner_uuid
                LEFT JOIN roles ON roles.uuid = users.role_uuid
                JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
                JOIN nests ON nests.uuid = nest_eggs.nest_uuid
                LEFT JOIN teams ON teams.uuid = servers.team_uuid
                WHERE servers.node_uuid = $1 AND servers.destination_node_uuid IS NOT NULL
                    AND {search}
                "#,
                search = super::search_sql(2, &["servers.name"], &["servers.uuid"]),
            ),
            "servers.created, servers.uuid",
        )
        .bind(node_uuid)
        .bind(search)
        .fetch(database, page, per_page)
        .await
    }

    pub async fn by_egg_uuid_with_pagination(
        database: &crate::database::Database,
        egg_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        super::PaginatedQueryBuilder::new(
            Self::columns_sql(None),
            format!(
                r#"
                FROM servers
                LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
                LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
                JOIN users ON users.uuid = servers.owner_uuid
                LEFT JOIN roles ON roles.uuid = users.role_uuid
                JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
                JOIN nests ON nests.uuid = nest_eggs.nest_uuid
                LEFT JOIN teams ON teams.uuid = servers.team_uuid
                WHERE servers.egg_uuid = $1 AND {search}
                "#,
                search = super::search_sql(2, &["servers.name"], &["servers.uuid"]),
            ),
            "servers.created, servers.uuid",
        )
        .bind(egg_uuid)
        .bind(search)
        .fetch(database, page, per_page)
        .await
    }

    pub async fn by_backup_configuration_uuid_with_pagination(
        database: &crate::database::Database,
        backup_configuration_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        super::PaginatedQueryBuilder::new(
            Self::columns_sql(None),
            format!(
                r#"
                FROM servers
                LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
                LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
                JOIN users ON users.uuid = servers.owner_uuid
                LEFT JOIN roles ON roles.uuid = users.role_uuid
                JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
                JOIN nests ON nests.uuid = nest_eggs.nest_uuid
                LEFT JOIN teams ON teams.uuid = servers.team_uuid
                WHERE servers.backup_configuration_uuid = $1 AND {search}
                "#,
                search = super::search_sql(2, &["servers.name"], &["servers.uuid"]),
            ),
            "servers.created, servers.uuid",
        )
        .bind(backup_configuration_uuid)
        .bind(search)
        .fetch(database, page, per_page)
        .await
    }

    pub async fn all_with_pagination(
        database: &crate::database::Database,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        super::PaginatedQueryBuilder::new(
            Self::columns_sql(None),
            format!(
                r#"
                FROM servers
                LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
                LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
                JOIN users ON users.uuid = servers.owner_uuid
                LEFT JOIN roles ON roles.uuid = users.role_uuid
                JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
                JOIN nests ON nests.uuid = nest_eggs.nest_uuid
                LEFT JOIN teams ON teams.uuid = servers.team_uuid
                WHERE {search}
                "#,
                search = super::search_sql(1, &["servers.name"], &["servers.uuid"]),
            ),
            "servers.created, servers.uuid",
        )
        .bind(search)
        .fetch(database, page, per_page)
        .await
    }

    pub async fn count_by_user_uuid(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
    ) -> Result<i64, sqlx::Error> {
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
    }

    pub async fn count_by_node_uuid(
        database: &crate::database::Database,
        node_uuid: uuid::Uuid,
    ) -> Result<i64, sqlx::Error> {
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
    }

    pub async fn count_by_egg_uuid(
        database: &crate::database::Database,
        egg_uuid: uuid::Uuid,
    ) -> Result<i64, sqlx::Error> {
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
    }

    pub async fn count_by_team_uuid(
        database: &crate::database::Database,
        team_uuid: uuid::Uuid,
    ) -> Result<i64, sqlx::Error> {
        sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM servers
            WHERE servers.team_uuid = $1
            "#,
        )
        .bind(team_uuid)
        .fetch_one(database.read())
        .await
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

    /// Atomically moves the server from the `from` status to the `to` status, returning `false`
    /// if the server was not in the `from` status and nothing was changed.
    pub async fn try_set_status_by_uuid(
        executor: impl sqlx::Executor<'_, Database = sqlx::Postgres>,
        uuid: uuid::Uuid,
        from: Option<ServerStatus>,
        to: Option<ServerStatus>,
    ) -> Result<bool, sqlx::Error> {
        let rows_affected = sqlx::query!(
            "UPDATE servers
            SET status = $2
            WHERE servers.uuid = $1 AND servers.status IS NOT DISTINCT FROM $3",
            uuid,
            to as Option<ServerStatus>,
            from as Option<ServerStatus>
        )
        .execute(executor)
        .await?
        .rows_affected();

        Ok(rows_affected > 0)
    }

    /// Sets the status of the server, regardless of the status it is currently in.
    pub async fn set_status(
        &mut self,
        executor: impl sqlx::Executor<'_, Database = sqlx::Postgres>,
        status: Option<ServerStatus>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query!(
            "UPDATE servers
            SET status = $2
            WHERE servers.uuid = $1",
            self.uuid,
            status as Option<ServerStatus>
        )
        .execute(executor)
        .await?;

        self.status = status;

        Ok(())
    }

    /// Same as [`try_set_status_by_uuid`](Self::try_set_status_by_uuid), keeping the status on the
    /// struct in sync.
    pub async fn try_set_status(
        &mut self,
        executor: impl sqlx::Executor<'_, Database = sqlx::Postgres>,
        from: Option<ServerStatus>,
        to: Option<ServerStatus>,
    ) -> Result<bool, sqlx::Error> {
        if !Self::try_set_status_by_uuid(executor, self.uuid, from, to).await? {
            return Ok(false);
        }

        self.status = to;

        Ok(true)
    }

    pub async fn egg_configuration(
        &self,
        database: &crate::database::Database,
    ) -> Result<super::egg_configuration::MergedEggConfiguration, anyhow::Error> {
        let node = self.node.fetch_cached(database).await?;

        super::egg_configuration::EggConfiguration::merged_for_target(
            database,
            &super::egg_configuration::EggConfigurationTarget::new(&self.egg, &node),
        )
        .await
    }

    /// Syncs the server with the node. This will update server resources, schedules, name, etc.
    pub async fn sync(self, state: &crate::State) -> Result<(), anyhow::Error> {
        self.node
            .fetch_cached(&state.database)
            .await?
            .api_client(&state.database)
            .await?
            .post_servers_server_sync(
                self.uuid,
                &wings_api::servers_server_sync::post::RequestBody {
                    server: serde_json::to_value(self.into_remote_api_object(state).await?)?,
                },
            )
            .await?;

        Ok(())
    }

    /// Same as [`sync`](Self::sync) but runs in a background task, is deduplicated and is not awaited. Any errors will be logged but not returned.
    ///
    /// This method is meant to be used in 90% of cases where you want to sync the server with low priority.
    pub async fn batch_sync(self, state: &crate::State) {
        state
            .database
            .batch_action("sync_server", self.uuid, {
                let state = state.clone();

                async move { self.sync(&state).await }
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
        self.install_with_options(
            state,
            ServerInstallOptions {
                truncate_directory,
                installation_script,
                ..Default::default()
            },
        )
        .await
    }

    /// Same as [`install`](Self::install) but takes a [`ServerInstallOptions`].
    pub async fn install_with_options(
        &self,
        state: &crate::State,
        options: ServerInstallOptions,
    ) -> Result<(), anyhow::Error> {
        let ServerInstallOptions {
            truncate_directory,
            installation_script,
            start_on_completion,
        } = options;

        let api_client = self
            .node
            .fetch_cached(&state.database)
            .await?
            .api_client(&state.database)
            .await?;

        if !Self::try_set_status_by_uuid(
            state.database.write(),
            self.uuid,
            None,
            Some(ServerStatus::Installing),
        )
        .await?
        {
            return Err(DisplayError::new(
                "server is already installing or in an invalid state for reinstalling",
            )
            .into());
        }

        Self::invalidate_cached(&state.database, self.uuid).await;

        match api_client
            .post_servers_server_reinstall_with(
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
                &wings_api::servers_server_reinstall::post::Extra {
                    start_on_completion,
                    ..Default::default()
                },
            )
            .await
        {
            Ok(_) => {}
            Err(err) => {
                Self::try_set_status_by_uuid(
                    state.database.write(),
                    self.uuid,
                    Some(ServerStatus::Installing),
                    None,
                )
                .await?;
                Self::invalidate_cached(&state.database, self.uuid).await;

                return Err(err.into());
            }
        };

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
    /// This will only work if the server is not currently installing or restoring a backup.
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

        if matches!(
            self.status,
            Some(ServerStatus::Installing) | Some(ServerStatus::RestoringBackup)
        ) {
            return Err(DisplayError::new(
                "server is installing or restoring a backup and cannot be transferred",
            )
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

        if options.multiplex_channels > MAX_TRANSFER_MULTIPLEX_CHANNELS {
            return Err(DisplayError::new(format!(
                "multiplex channels cannot exceed {MAX_TRANSFER_MULTIPLEX_CHANNELS}"
            ))
            .with_status(axum::http::StatusCode::BAD_REQUEST)
            .into());
        }

        let mut requested_allocations = options.allocation_uuids.clone();
        requested_allocations.extend(options.allocation_uuid);
        requested_allocations.sort_unstable();
        requested_allocations.dedup();

        if !requested_allocations.is_empty() {
            let owned = sqlx::query!(
                "SELECT COUNT(*) AS count FROM node_allocations
                WHERE node_allocations.uuid = ANY($1) AND node_allocations.node_uuid = $2",
                &requested_allocations,
                options.destination_node.uuid
            )
            .fetch_one(state.database.read())
            .await?
            .count
            .unwrap_or(0);

            if owned != requested_allocations.len() as i64 {
                return Err(DisplayError::new(
                    "all allocations must belong to the destination node",
                )
                .with_status(axum::http::StatusCode::BAD_REQUEST)
                .into());
            }
        }

        let mut transaction = state.database.write().begin().await?;

        let destination_allocation_uuid = if let Some(allocation_uuid) = options.allocation_uuid {
            match sqlx::query!(
                "INSERT INTO server_allocations (server_uuid, allocation_uuid)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
                RETURNING uuid",
                self.uuid,
                allocation_uuid
            )
            .fetch_optional(&mut *transaction)
            .await?
            {
                Some(row) => Some(row.uuid),
                None => {
                    return Err(DisplayError::new(
                        "the primary allocation is already assigned to a server",
                    )
                    .with_status(axum::http::StatusCode::CONFLICT)
                    .into());
                }
            }
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
            let inserted = sqlx::query!(
                "INSERT INTO server_allocations (server_uuid, allocation_uuid)
                SELECT $1, UNNEST($2::uuid[])
                ON CONFLICT DO NOTHING
                RETURNING uuid",
                self.uuid,
                &options.allocation_uuids
            )
            .fetch_all(&mut *transaction)
            .await?;

            if inserted.len() != options.allocation_uuids.len() {
                return Err(DisplayError::new(
                    "an additional allocation is already assigned to a server",
                )
                .with_status(axum::http::StatusCode::CONFLICT)
                .into());
            }
        }

        sqlx::query(
            "UPDATE servers
            SET destination_variables = $2
            WHERE servers.uuid = $1",
        )
        .bind(self.uuid)
        .bind(
            (!options.variables.is_empty())
                .then(|| serde_json::to_value(&options.variables))
                .transpose()?,
        )
        .execute(&mut *transaction)
        .await?;

        let token = options
            .destination_node
            .create_jwt(
                &state.database,
                &state.jwt,
                &crate::jwt::BasePayload {
                    scope: "transfer".into(),
                    issuer: "panel".into(),
                    subject: Some(self.uuid.to_compact_string()),
                    audience: Vec::new(),
                    expiration_time: Some(chrono::Utc::now().timestamp() + 600),
                    not_before: None,
                    issued_at: Some(chrono::Utc::now().timestamp()),
                    jwt_id: self.node.uuid.to_compact_string(),
                },
            )
            .await?;

        let url = options.destination_node.url("/api/transfers");

        // the transfer state is only committed once the source node has accepted the job,
        // otherwise a failing node leaves the server permanently marked as transferring.
        let api_client = self
            .node
            .fetch_cached(&state.database)
            .await?
            .api_client(&state.database)
            .await?;

        match tokio::time::timeout(
            WINGS_REQUEST_TIMEOUT,
            api_client.post_servers_server_transfer(
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
            ),
        )
        .await
        {
            Ok(Ok(_)) => {}
            Ok(Err(err)) => {
                transaction.rollback().await?;

                return Err(err.into());
            }
            Err(_) => {
                transaction.rollback().await?;

                // the node may have accepted the job after all
                if let Ok(Err(err)) = tokio::time::timeout(
                    WINGS_REQUEST_TIMEOUT,
                    api_client.delete_servers_server_transfer(self.uuid),
                )
                .await
                {
                    tracing::warn!(server = %self.uuid, "failed to cancel timed out transfer: {:?}", err);
                }

                return Err(anyhow::anyhow!(
                    "timed out starting the transfer on the node"
                ));
            }
        }

        transaction.commit().await?;

        Self::invalidate_cached(&state.database, self.uuid).await;

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

    /// Writes the variable values a transfer bound to destination allocations, once it succeeded.
    pub async fn apply_destination_variables(
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        server_uuid: uuid::Uuid,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            INSERT INTO server_variables (server_uuid, variable_uuid, value)
            SELECT servers.uuid, nest_egg_variables.uuid, pending.value
            FROM servers
            CROSS JOIN jsonb_each_text(servers.destination_variables) AS pending
            JOIN nest_egg_variables
                ON nest_egg_variables.uuid = pending.key::uuid
                AND nest_egg_variables.egg_uuid = servers.egg_uuid
            WHERE servers.uuid = $1
            ON CONFLICT (server_uuid, variable_uuid) DO UPDATE SET value = EXCLUDED.value
            "#,
        )
        .bind(server_uuid)
        .execute(&mut **transaction)
        .await?;

        Self::clear_destination_variables(&mut **transaction, server_uuid).await
    }

    pub async fn clear_destination_variables(
        executor: impl sqlx::Executor<'_, Database = sqlx::Postgres>,
        server_uuid: uuid::Uuid,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "UPDATE servers
            SET destination_variables = NULL
            WHERE servers.uuid = $1",
        )
        .bind(server_uuid)
        .execute(executor)
        .await?;

        Ok(())
    }

    fn scope_allows_console_streams(scope: Option<&[compact_str::CompactString]>) -> bool {
        scope.is_none_or(|scope| scope.iter().any(|p| p == "control.read-console"))
    }

    fn push_granted_permissions<'a>(
        permissions: &mut Vec<&'a str>,
        granted: impl Iterator<Item = &'a compact_str::CompactString>,
        scope: Option<&[compact_str::CompactString]>,
        settings: &crate::settings::AppSettings,
    ) {
        for permission in granted {
            if scope.is_some_and(|scope| !scope.contains(permission))
                || permissions.contains(&permission.as_str())
            {
                continue;
            }

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
    }

    pub fn wings_permissions<'a>(
        &'a self,
        settings: &crate::settings::AppSettings,
        user: &'a super::user::User,
        scope: &'a crate::models::user::CredentialScope,
    ) -> Vec<&'a str> {
        let scope = scope.server_permissions();
        let mut permissions = vec!["websocket.connect", "meta.calagopus"];

        if user.admin {
            permissions.reserve(scope.map_or(1, |s| s.len()) + 3);

            crate::utils::push_scope_or_star(&mut permissions, scope);

            if Self::scope_allows_console_streams(scope) {
                permissions.push("admin.websocket.errors");
                permissions.push("admin.websocket.install");
                permissions.push("admin.websocket.transfer");
            }

            return permissions;
        }

        if self.owner.uuid == user.uuid {
            permissions.reserve(scope.map_or(1, |s| s.len()) + 2);

            if Self::scope_allows_console_streams(scope) {
                if settings.server.allow_viewing_installation_logs {
                    permissions.push("admin.websocket.install");
                }
                if settings.server.allow_viewing_transfer_progress {
                    permissions.push("admin.websocket.transfer");
                }
            }

            crate::utils::push_scope_or_star(&mut permissions, scope);

            return permissions;
        }

        // anyone else reaches this server through their role, their subuser entry, or both, and
        // holds exactly what those grant. this has to mirror
        // `PermissionManager::has_server_permission`, otherwise the token authorizes more than
        // the rest api would.
        let role_permissions = user
            .role
            .as_ref()
            .map_or(&[][..], |role| role.server_permissions.as_slice());
        let subuser_permissions = self
            .subuser_permissions
            .iter()
            .flat_map(|permissions| permissions.iter());

        permissions.reserve(
            role_permissions.len() + self.subuser_permissions.as_ref().map_or(0, |p| p.len()),
        );
        Self::push_granted_permissions(
            &mut permissions,
            role_permissions.iter().chain(subuser_permissions),
            scope,
            settings,
        );

        permissions
    }

    /// Gets the feature limits for the server, useful in case you need to loop over them or want to pass them to the frontend individually.
    pub async fn feature_limits(
        &self,
        state: &crate::State,
    ) -> Result<ApiServerFeatureLimits, anyhow::Error> {
        let feature_limits = ApiServerFeatureLimits::init_hooks(self, state).await?;

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

        Ok(feature_limits)
    }

    pub async fn backup_configuration(
        &self,
        database: &crate::database::Database,
    ) -> Option<super::backup_configuration::BackupConfiguration> {
        self.backup_configuration_for(database, None).await
    }

    /// Resolves server -> database agent host (database instance backups only) -> node -> location.
    pub async fn backup_configuration_for(
        &self,
        database: &crate::database::Database,
        database_instance: Option<&super::server_database_instance::ServerDatabaseInstance>,
    ) -> Option<super::backup_configuration::BackupConfiguration> {
        if let Some(backup_configuration) = &self.backup_configuration
            && let Ok(backup_configuration) = backup_configuration.fetch_cached(database).await
        {
            return Some(backup_configuration);
        }

        if let Some(database_instance) = database_instance
            && let Some(backup_configuration) =
                &database_instance.database_agent_host.backup_configuration
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

    /// The compiled subuser list, or `None` for a caller without one. A list that
    /// does not compile is `Some(None)`: it denies everything rather than hiding
    /// less than it says.
    fn subuser_ignored_files_list(&mut self) -> Option<Option<&crate::ignore_list::IgnoreList>> {
        let ignored_files = self.subuser_ignored_files.as_ref()?;

        if self.subuser_ignored_files_list.is_none() {
            match crate::ignore_list::IgnoreList::try_from_lines(ignored_files) {
                Ok(list) => self.subuser_ignored_files_list = Some(Box::new(list)),
                Err(err) => {
                    tracing::error!(
                        server = %self.uuid,
                        "failed to compile subuser ignored files, denying access: {:#?}",
                        err
                    );

                    return Some(None);
                }
            }
        }

        Some(self.subuser_ignored_files_list.as_deref())
    }

    /// Whether the subuser may not touch the entry itself.
    pub fn is_ignored(&mut self, path: impl AsRef<std::path::Path>, is_dir: bool) -> bool {
        match self.subuser_ignored_files_list() {
            Some(Some(list)) => is_path_ignored(list, path, is_dir),
            Some(None) => true,
            None => false,
        }
    }

    /// Whether the subuser may not reach anything beneath the directory either, for
    /// the root of a request: wings still enters an excluded directory that holds a
    /// re-included entry, so an operation below it can succeed.
    pub fn is_ignored_subtree(&mut self, path: impl AsRef<std::path::Path>) -> bool {
        match self.subuser_ignored_files_list() {
            Some(Some(list)) => is_path_ignored_subtree(list, path, true),
            Some(None) => true,
            None => false,
        }
    }

    pub fn is_ignored_either(&mut self, path: impl AsRef<std::path::Path>) -> bool {
        let path = path.as_ref();

        self.is_ignored(path, false) || self.is_ignored(path, true)
    }

    pub fn effective_trash(&self, settings: &crate::settings::AppSettings) -> TrashPolicy {
        self.trash.unwrap_or(settings.server.trash).into()
    }

    pub fn api_trash(&self, settings: &crate::settings::AppSettings) -> ApiServerTrash {
        let TrashPolicy {
            retention,
            usage_threshold,
        } = self.effective_trash(settings);

        ApiServerTrash {
            retention,
            usage_threshold,
            custom: self.trash.is_some(),
            defaults: settings.server.trash,
        }
    }

    #[inline]
    pub async fn into_remote_api_object(
        self,
        state: &crate::State,
    ) -> Result<RemoteApiServer, anyhow::Error> {
        let api_object = RemoteApiServer::init_hooks(&self, state).await?;
        let trash = self
            .trash
            .unwrap_or(state.settings.get().await?.server.trash);
        let firewall_enabled = self
            .egg_configuration(&state.database)
            .await?
            .firewall_enabled();

        let (
            variables,
            backups,
            schedules,
            schedule_step_rows,
            mounts,
            devices,
            allocations,
            firewall_rules,
        ) = tokio::try_join!(
            sqlx::query!(
                "SELECT nest_egg_variables.env_variable, COALESCE(server_variables.value, nest_egg_variables.default_value) AS value
                FROM nest_egg_variables
                LEFT JOIN server_variables ON server_variables.variable_uuid = nest_egg_variables.uuid AND server_variables.server_uuid = $1
                WHERE nest_egg_variables.egg_uuid = $2",
                self.uuid,
                self.egg.uuid
            )
            .fetch_all(state.database.read()),
            sqlx::query!(
                "SELECT server_backups.uuid, server_backups.database_instance_uuid IS NOT NULL AS \"database!\"
                FROM server_backups
                WHERE server_backups.server_uuid = $1",
                self.uuid
            )
            .fetch_all(state.database.read()),
            sqlx::query!(
                "SELECT server_schedules.uuid, server_schedules.triggers, server_schedules.condition
                FROM server_schedules
                WHERE server_schedules.server_uuid = $1 AND server_schedules.enabled",
                self.uuid
            )
            .fetch_all(state.database.read()),
            sqlx::query!(
                "SELECT server_schedule_steps.uuid, server_schedule_steps.schedule_uuid, server_schedule_steps.action
                FROM server_schedule_steps
                JOIN server_schedules ON server_schedules.uuid = server_schedule_steps.schedule_uuid
                WHERE server_schedules.server_uuid = $1
                ORDER BY server_schedule_steps.order_, server_schedule_steps.created, server_schedule_steps.uuid",
                self.uuid
            )
            .fetch_all(state.database.read()),
            sqlx::query!(
                "SELECT mounts.source, mounts.target, mounts.read_only
                FROM server_mounts
                JOIN mounts ON mounts.uuid = server_mounts.mount_uuid
                WHERE server_mounts.server_uuid = $1",
                self.uuid
            )
            .fetch_all(state.database.read()),
            sqlx::query(
                "SELECT devices.source, devices.target, devices.permissions
                FROM server_devices
                JOIN devices ON devices.uuid = server_devices.device_uuid
                WHERE server_devices.server_uuid = $1",
            )
            .bind(self.uuid)
            .fetch_all(state.database.read()),
            sqlx::query!(
                "SELECT node_allocations.ip, node_allocations.port
                FROM server_allocations
                JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
                WHERE server_allocations.server_uuid = $1",
                self.uuid
            )
            .fetch_all(state.database.read()),
            firewall::fetch_raw_rules(&state.database, self.uuid),
        )?;

        let mut schedule_steps = HashMap::new();
        schedule_steps.reserve(schedules.len());

        for step in schedule_step_rows {
            schedule_steps
                .entry(step.schedule_uuid)
                .or_insert_with(Vec::new)
                .push(step);
        }

        finish_extendible!(
            RemoteApiServer {
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
                    labels: self.labels,
                    backups: backups
                        .iter()
                        .filter(|b| !b.database)
                        .map(|b| b.uuid)
                        .collect(),
                    database_backups: backups
                        .iter()
                        .filter(|b| b.database)
                        .map(|b| b.uuid)
                        .collect(),
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
                        bandwidth: wings_api::BandwidthLimits {
                            upload: self.bandwidth_upload as u64,
                            download: self.bandwidth_download as u64,
                        },
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
                        oom_disabled: false,
                    },
                    mounts: mounts
                        .into_iter()
                        .map(|m| wings_api::Mount {
                            source: m.source.into(),
                            target: m.target.into(),
                            read_only: m.read_only,
                        })
                        .collect(),
                    devices: devices
                        .into_iter()
                        .map(|d| {
                            Ok::<_, sqlx::Error>(wings_api::Device {
                                source: d.try_get("source")?,
                                target: d.try_get("target")?,
                                permissions: d.try_get("permissions")?,
                            })
                        })
                        .try_collect_vec()?,
                    firewall: if firewall_enabled {
                        firewall::decode_rules(firewall_rules)?
                            .into_iter()
                            .map(Into::into)
                            .collect()
                    } else {
                        Vec::new()
                    },
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
                    trash: Some(wings_api::ServerConfigurationTrash {
                        retention: trash.retention,
                        usage_threshold: Some(trash.usage_threshold),
                    }),
                    features: wings_api::ServerConfigurationFeatures {
                        startup_cpu_boost: None,
                        runtime_cpu_boost: None,
                    },
                },
                process_configuration: super::nest_egg::ProcessConfiguration {
                    startup: self.egg.config_startup,
                    stop: self.egg.config_stop,
                    configs: self.egg.config_files,
                },
            },
            api_object,
            state
        )
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

        let api_object = finish_extendible!(
            AdminApiServer {
                uuid: self.uuid,
                uuid_short: format!("{:08x}", self.uuid_short).into(),
                external_id: self.external_id,
                allocation,
                node: node?,
                owner: self
                    .owner
                    .into_admin_api_object(state, storage_url_retriever)
                    .await?,
                team_uuid: self.team_uuid,
                team_name: self.team_name,
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
                    bandwidth: Some(ApiServerBandwidth {
                        upload: self.bandwidth_upload as u64,
                        download: self.bandwidth_download as u64,
                    }),
                },
                pinned_cpus: self.pinned_cpus,
                feature_limits,
                startup: self.startup,
                image: self.image,
                labels: self.labels,
                auto_kill: self.auto_kill,
                auto_start_behavior: self.auto_start_behavior,
                timezone: self.timezone,
                trash: self.trash,
                trash_defaults: state.settings.get().await?.server.trash,
                hugepages_passthrough_enabled: self.hugepages_passthrough_enabled,
                kvm_passthrough_enabled: self.kvm_passthrough_enabled,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
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
        let trash = self.api_trash(&*state.settings.get().await?);

        let allocation_uuid = self.allocation.as_ref().map(|a| a.uuid);
        let allocation = match self.allocation {
            Some(a) => Some(a.into_api_object(state, allocation_uuid).await?),
            None => None,
        };

        let node = self.node.fetch_cached(&state.database).await?;
        let egg_configuration = super::egg_configuration::EggConfiguration::merged_for_target(
            &state.database,
            &super::egg_configuration::EggConfigurationTarget::new(&self.egg, &node),
        )
        .await?;

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
                ignored_files: self.subuser_ignored_files.unwrap_or_default(),
                team_uuid: self.team_uuid,
                team_name: self.team_name,
                location_uuid: node.location.uuid,
                location_name: node.location.name,
                location_flag: node.location.flag,
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
                    bandwidth: ApiServerBandwidth {
                        upload: self.bandwidth_upload as u64,
                        download: self.bandwidth_download as u64,
                    },
                },
                feature_limits,
                startup: self.startup,
                image: self.image,
                auto_kill: self.auto_kill,
                auto_start_behavior: self.auto_start_behavior,
                timezone: self.timezone,
                trash,
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
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM servers
            LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
            LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
            JOIN users ON users.uuid = servers.owner_uuid
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
            JOIN nests ON nests.uuid = nest_eggs.nest_uuid
            LEFT JOIN teams ON teams.uuid = servers.team_uuid
            WHERE servers.uuid = $1
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
            FROM servers
            LEFT JOIN server_allocations ON server_allocations.uuid = servers.allocation_uuid
            LEFT JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
            JOIN users ON users.uuid = servers.owner_uuid
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
            JOIN nests ON nests.uuid = nest_eggs.nest_uuid
            LEFT JOIN teams ON teams.uuid = servers.team_uuid
            WHERE servers.uuid = $1
            "#,
            Self::columns_sql(None)
        )))
        .bind(uuid)
        .fetch_one(&mut **transaction)
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
    #[garde(custom(validate_labels))]
    #[serde(default)]
    pub labels: IndexMap<compact_str::CompactString, compact_str::CompactString>,
    #[garde(skip)]
    #[schema(value_type = Option<String>)]
    pub timezone: Option<chrono_tz::Tz>,
    #[garde(dive)]
    #[schema(inline)]
    pub trash: Option<TrashSettings>,

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

    async fn create_with_transaction(
        _state: &crate::State,
        _options: Self::CreateOptions<'_>,
        _transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self, crate::database::DatabaseError> {
        Err(anyhow::anyhow!("create_with_transaction is not supported for Server").into())
    }

    async fn create(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        let node = super::node::Node::by_uuid_optional(&state.database, options.node_uuid)
            .await?
            .ok_or(crate::database::InvalidRelationError("node"))?;

        if options
            .limits
            .bandwidth
            .is_some_and(|limits| limits.upload != 0 || limits.download != 0)
        {
            node.ensure_bandwidth_ready(&state.database).await?;
        }

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
                .set(
                    "bandwidth_upload",
                    options.limits.bandwidth.unwrap_or_default().upload as i64,
                )
                .set(
                    "bandwidth_download",
                    options.limits.bandwidth.unwrap_or_default().download as i64,
                )
                .set("swap", options.limits.swap)
                .set("disk", options.limits.disk)
                .set("io_weight", options.limits.io_weight)
                .set("cpu", options.limits.cpu)
                .set("pinned_cpus", &options.pinned_cpus)
                .set("startup", &options.startup)
                .set("image", &options.image)
                .set("labels", OrderedJson(&options.labels))
                .set("timezone", options.timezone.as_ref().map(|t| t.name()))
                .set(
                    "trash",
                    options
                        .trash
                        .as_ref()
                        .map(serde_json::to_value)
                        .transpose()?,
                )
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

                    let mut result =
                        Self::by_uuid_with_transaction(&mut transaction, server_uuid).await?;

                    Self::run_after_create_handlers(&mut result, &options, state, &mut transaction)
                        .await?;

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

                    return Ok(result);
                }
                Err(_) if attempts < 3 => {
                    attempts += 1;
                    transaction.rollback().await?;
                    transaction = state.database.write().begin().await?;

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

fn validate_auto_kill(
    value: &Option<wings_api::ServerConfigurationAutoKill>,
    _context: &(),
) -> garde::Result {
    match value {
        Some(auto_kill) if !(1..=3600).contains(&auto_kill.seconds) => Err(garde::Error::new(
            "auto kill seconds must be between 1 and 3600",
        )),
        _ => Ok(()),
    }
}

/// Wings writes `Service` and `ContainerType` onto every container it creates, after the labels
/// coming from here, so a label under either key would be silently dropped instead of applied.
const RESERVED_LABELS: [&str; 2] = ["Service", "ContainerType"];
const MAX_LABELS: usize = 64;

pub fn validate_labels(
    labels: &IndexMap<compact_str::CompactString, compact_str::CompactString>,
    _context: &(),
) -> garde::Result {
    if labels.len() > MAX_LABELS {
        return Err(garde::Error::new(compact_str::format_compact!(
            "a server cannot have more than {MAX_LABELS} labels"
        )));
    }

    for (key, value) in labels {
        if key.trim().is_empty() {
            return Err(garde::Error::new("label keys cannot be empty"));
        }

        if RESERVED_LABELS.contains(&key.as_str()) {
            return Err(garde::Error::new(compact_str::format_compact!(
                "label {key} is reserved by wings"
            )));
        }

        if key.chars().count() > 255 || value.chars().count() > 255 {
            return Err(garde::Error::new(compact_str::format_compact!(
                "label {key} and its value must each be at most 255 characters"
            )));
        }

        if key.chars().chain(value.chars()).any(char::is_control) {
            return Err(garde::Error::new(compact_str::format_compact!(
                "label {key} cannot contain control characters"
            )));
        }
    }

    Ok(())
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
    #[garde(inner(custom(validate_labels)))]
    pub labels: Option<IndexMap<compact_str::CompactString, compact_str::CompactString>>,
    #[garde(custom(validate_auto_kill))]
    #[schema(inline)]
    pub auto_kill: Option<wings_api::ServerConfigurationAutoKill>,
    #[garde(skip)]
    pub auto_start_behavior: Option<ServerAutoStartBehavior>,
    #[garde(skip)]
    #[schema(value_type = Option<Option<String>>)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub timezone: Option<Option<chrono_tz::Tz>>,
    #[garde(dive)]
    #[schema(inline)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub trash: Option<Option<TrashSettings>>,

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

    fn get_update_handlers() -> &'static LazyLock<UpdateHandlerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateHandlerList<Server>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &UPDATE_LISTENERS
    }

    async fn update(
        &mut self,
        state: &crate::State,
        options: Self::UpdateOptions,
    ) -> Result<(), crate::database::DatabaseError> {
        let previous_owner = options
            .owner_uuid
            .is_some_and(|owner_uuid| owner_uuid != self.owner.uuid)
            .then_some(self.owner.uuid);

        let mut transaction = state.database.write().begin().await?;

        if let Err(err) = self
            .update_with_transaction(state, options, &mut transaction)
            .await
        {
            transaction.rollback().await?;
            return Err(err);
        }

        transaction.commit().await?;

        super::invalidate_cache_keys(&state.database, &self.cache_invalidation_keys()).await;

        if let Some(previous_owner) = previous_owner {
            // the server also left the previous owner's team, whose members are only reached
            // through the server
            let invalidation = super::node::PermissionsInvalidation {
                users: vec![previous_owner, self.owner.uuid],
                servers: Some(wings_api::ServerSelector::Uuids {
                    uuids: HashSet::from([self.uuid]),
                }),
                ..Default::default()
            };

            match self.node.fetch_cached(&state.database).await {
                Ok(node) => node.invalidate_permissions(&state.database, invalidation),
                Err(err) => {
                    tracing::error!(server = %self.uuid, "failed to resolve node to invalidate permissions, invalidating everywhere: {:?}", err);
                    super::node::Node::invalidate_permissions_everywhere(
                        &state.database,
                        invalidation,
                    );
                }
            }
        }

        Ok(())
    }

    async fn update_with_transaction(
        &mut self,
        state: &crate::State,
        mut options: Self::UpdateOptions,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
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

        let mut query_builder = UpdateQueryBuilder::new("servers");

        self.run_update_handlers(&mut options, &mut query_builder, state, transaction)
            .await?;

        if options
            .limits
            .and_then(|limits| limits.bandwidth)
            .is_some_and(|limits| {
                (limits.upload != 0 || limits.download != 0)
                    && (limits.upload as i64 != self.bandwidth_upload
                        || limits.download as i64 != self.bandwidth_download)
            })
        {
            self.node
                .fetch_cached(&state.database)
                .await?
                .ensure_bandwidth_ready(&state.database)
                .await?;
        }

        query_builder
            .set("owner_uuid", options.owner_uuid.as_ref())
            .set(
                "team_uuid",
                owner
                    .as_ref()
                    .filter(|owner| owner.uuid != self.owner.uuid)
                    .map(|_| None::<uuid::Uuid>),
            )
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
            .set("labels", options.labels.as_ref().map(OrderedJson))
            .set(
                "auto_kill",
                options
                    .auto_kill
                    .as_ref()
                    .map(serde_json::to_value)
                    .transpose()?,
            )
            .set("auto_start_behavior", options.auto_start_behavior)
            .set(
                "timezone",
                options
                    .timezone
                    .as_ref()
                    .map(|t| t.as_ref().map(|t| t.name())),
            )
            .set(
                "trash",
                options
                    .trash
                    .as_ref()
                    .map(|t| t.as_ref().map(serde_json::to_value).transpose())
                    .transpose()?,
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

            if let Some(bandwidth) = limits.bandwidth {
                query_builder
                    .set("bandwidth_upload", Some(bandwidth.upload as i64))
                    .set("bandwidth_download", Some(bandwidth.download as i64));
            }
        }

        if let Some(feature_limits) = &options.feature_limits {
            query_builder
                .set("allocation_limit", Some(feature_limits.allocations))
                .set("database_limit", Some(feature_limits.databases))
                .set("backup_limit", Some(feature_limits.backups))
                .set("schedule_limit", Some(feature_limits.schedules));
        }

        query_builder.where_eq("uuid", self.uuid);

        query_builder.execute(&mut **transaction).await?;

        if egg.as_ref().is_some_and(|egg| egg.uuid != self.egg.uuid) {
            crate::tunnel::bump_epoch_if_server_on_mesh(transaction, self.uuid).await?;
        }

        if let Some(owner) = owner {
            if owner.uuid != self.owner.uuid {
                self.team_uuid = None;
                self.team_name = None;
            }
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
            if let Some(bandwidth) = limits.bandwidth {
                self.bandwidth_upload = bandwidth.upload as i64;
                self.bandwidth_download = bandwidth.download as i64;
            }
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
        if let Some(labels) = options.labels {
            self.labels = labels;
        }
        if let Some(auto_kill) = options.auto_kill {
            self.auto_kill = auto_kill;
        }
        if let Some(auto_start_behavior) = options.auto_start_behavior {
            self.auto_start_behavior = auto_start_behavior;
        }
        if let Some(timezone) = options.timezone {
            self.timezone = timezone.map(|t| t.name().into());
        }
        if let Some(trash) = options.trash {
            self.trash = trash;
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

        self.run_after_update_handlers(state, transaction).await?;

        Ok(())
    }
}

#[derive(Clone, Default)]
pub struct DeleteServerOptions {
    pub force: bool,
}

#[async_trait::async_trait]
impl DeletableModel for Server {
    type DeleteOptions = DeleteServerOptions;

    fn get_delete_handlers() -> &'static LazyLock<DeleteHandlerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteHandlerList<Server>> =
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
            "delete_with_transaction is not supported for Server"
        ))
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
        let database_instances =
            super::server_database_instance::ServerDatabaseInstance::all_by_server_uuid(
                &state.database,
                self.uuid,
            )
            .await?;

        let mut transaction = state.database.write().begin().await?;
        self.run_delete_handlers(&options, state, &mut transaction)
            .await?;

        let state = state.clone();
        let server_uuid = self.uuid;

        tokio::spawn(async move {
            let api_client = node.api_client(&state.database).await?;
            match tokio::time::timeout(
                WINGS_REQUEST_TIMEOUT,
                api_client.delete_servers_server(server_uuid),
            )
            .await
            {
                Ok(Ok(_)) => {}
                Ok(Err(wings_api::client::ApiHttpError::Http(reqwest::StatusCode::NOT_FOUND, _))) => {}
                Ok(Err(err)) if options.force => {
                    tracing::error!(server = %server_uuid, node = %node.uuid, "failed to delete server: {:?}", err);
                }
                Ok(Err(err)) => {
                    tracing::error!(server = %server_uuid, node = %node.uuid, "failed to delete server: {:?}", err);

                    transaction.rollback().await?;
                    return Err(err.into());
                }
                Err(_) if options.force => {
                    tracing::error!(server = %server_uuid, node = %node.uuid, "timed out deleting server");
                }
                Err(_) => {
                    tracing::error!(server = %server_uuid, node = %node.uuid, "timed out deleting server");

                    transaction.rollback().await?;
                    return Err(anyhow::anyhow!("timed out deleting the server on the node"));
                }
            }

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

            for database_instance in database_instances {
                match database_instance.delete(&state, super::server_database_instance::DeleteServerDatabaseInstanceOptions { force: options.force }).await {
                    Ok(_) => {}
                    Err(err) => {
                        tracing::error!(server = %server_uuid, "failed to delete database instance: {:?}", err);

                        if !options.force {
                            return Err(err);
                        }
                    }
                }
            }

            let on_mesh =
                crate::tunnel::bump_epoch_if_server_on_mesh(&mut transaction, server_uuid).await?;

            sqlx::query!("DELETE FROM servers WHERE servers.uuid = $1", server_uuid)
                .execute(&mut *transaction)
                .await?;

            transaction.commit().await?;

            Self::invalidate_cached(&state.database, server_uuid).await;

            if on_mesh {
                crate::tunnel::poke_nodes(&state.database).await;
            }

            Ok(())
        }).await?
    }
}

#[schema_extension_derive::extendible]
#[init_args(Server, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "RemoteServer")]
pub struct RemoteApiServer {
    pub settings: wings_api::ServerConfiguration,
    pub process_configuration: super::nest_egg::ProcessConfiguration,
}

#[derive(ToSchema, Serialize, Deserialize, Clone, Copy, Default)]
pub struct ApiServerBandwidth {
    pub upload: u64,
    pub download: u64,
}

fn validate_bandwidth(value: &Option<ApiServerBandwidth>, _context: &()) -> garde::Result {
    if let Some(limits) = value {
        for rate in [limits.upload, limits.download] {
            if rate != 0 && !(8..=100_000_000_000).contains(&rate) {
                return Err(garde::Error::new(
                    "bandwidth must be zero or between 8 and 100000000000 bits/s",
                ));
            }
        }
    }

    Ok(())
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[garde(custom(validate_bandwidth))]
    pub bandwidth: Option<ApiServerBandwidth>,
}

/// Trash policy as configured: `retention` in seconds and `usage_threshold` in percent of the
/// disk limit, where 0 disables the respective behavior.
#[derive(ToSchema, Validate, Serialize, Deserialize, Clone, Copy)]
pub struct TrashSettings {
    #[garde(range(min = 0, max = 365 * 24 * 60 * 60))]
    #[schema(minimum = 0, maximum = 31536000)]
    pub retention: u64,
    #[garde(range(min = 0, max = 100))]
    #[schema(minimum = 0, maximum = 100)]
    pub usage_threshold: u64,
}

pub struct TrashPolicy {
    pub retention: Option<u64>,
    pub usage_threshold: Option<u64>,
}

impl From<TrashSettings> for TrashPolicy {
    fn from(settings: TrashSettings) -> Self {
        Self {
            retention: (settings.retention > 0).then_some(settings.retention),
            usage_threshold: (settings.usage_threshold > 0).then_some(settings.usage_threshold),
        }
    }
}

#[derive(ToSchema, Serialize, Clone, Copy)]
pub struct ApiServerTrash {
    pub retention: Option<u64>,
    pub usage_threshold: Option<u64>,
    pub custom: bool,
    #[schema(inline)]
    pub defaults: TrashSettings,
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
    #[garde(skip)]
    #[serde(default)]
    pub bandwidth: ApiServerBandwidth,
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
    pub owner: super::user::AdminApiUser,
    pub team_uuid: Option<uuid::Uuid>,
    pub team_name: Option<compact_str::CompactString>,
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
    pub labels: IndexMap<compact_str::CompactString, compact_str::CompactString>,
    #[schema(inline)]
    pub auto_kill: wings_api::ServerConfigurationAutoKill,
    pub auto_start_behavior: ServerAutoStartBehavior,
    pub timezone: Option<compact_str::CompactString>,
    #[schema(inline)]
    pub trash: Option<TrashSettings>,
    #[schema(inline)]
    pub trash_defaults: TrashSettings,

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
    pub ignored_files: Vec<compact_str::CompactString>,
    pub team_uuid: Option<uuid::Uuid>,
    pub team_name: Option<compact_str::CompactString>,

    pub location_uuid: uuid::Uuid,
    pub location_name: compact_str::CompactString,
    pub location_flag: Option<compact_str::CompactString>,
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
    #[schema(inline)]
    pub trash: ApiServerTrash,

    pub created: chrono::DateTime<chrono::Utc>,
}

#[cfg(test)]
mod tests {
    use super::{
        ServerAccess, is_path_ignored, is_path_ignored_subtree, merge_access, validate_labels,
    };
    use crate::ignore_list::IgnoreList;
    use compact_str::CompactString;
    use indexmap::IndexMap;
    use std::collections::HashSet;

    fn compile(patterns: &[&str]) -> IgnoreList {
        IgnoreList::try_from_lines(patterns).unwrap()
    }

    // is_path_ignored
    #[test]
    fn an_anchored_pattern_matches_every_spelling_of_the_path() {
        let list = compile(&["/config/secrets.yml"]);

        for path in [
            "/config/secrets.yml",
            "/./config/secrets.yml",
            "/config//secrets.yml",
            "/config/./secrets.yml",
            "/config/../config/secrets.yml",
            "/../config/secrets.yml",
            "config/secrets.yml",
        ] {
            assert!(is_path_ignored(&list, path, false), "{path}");
        }

        assert!(!is_path_ignored(&list, "/config/public.yml", false));
    }

    #[test]
    fn a_denied_name_hides_its_subtree_and_a_reinclude_leaves_its_parents_enterable() {
        let list = compile(&["secrets"]);

        assert!(is_path_ignored(&list, "/secrets", true));
        assert!(is_path_ignored(&list, "/secrets/deep/token.txt", false));
        assert!(is_path_ignored(&list, "/game/secrets/token.txt", false));
        assert!(!is_path_ignored(&list, "/secrets.txt", false));

        let list = compile(&["*", "!/game/csgo/cfg"]);

        assert!(is_path_ignored(&list, "/game/csgo", true));
        assert!(!is_path_ignored_subtree(&list, "/game/csgo", true));
        assert!(!is_path_ignored_subtree(&list, "/game/./csgo/", true));
        assert!(is_path_ignored_subtree(&list, "/game/hl2", true));
        assert!(!is_path_ignored(&list, "/game/csgo/cfg/server.cfg", false));
    }

    #[test]
    fn appending_a_list_keeps_everything_it_hid_hidden() {
        // Last-match-wins, so reordering the same set flips the verdict - which is why
        // the grant routes require a suffix rather than a subset.
        let caller = ["!/a/b", "/a/**"];

        assert!(is_path_ignored(&compile(&caller), "/a/b", false));
        assert!(!is_path_ignored(
            &compile(&["/a/**", "!/a/b"]),
            "/a/b",
            false
        ));

        for granted in [
            vec!["!/a/b", "/a/**"],
            vec!["/a/**", "!/a/b", "!/a/b", "/a/**"],
            vec!["!/a/**", "!/a/b", "/a/**"],
        ] {
            assert!(granted.ends_with(&caller));
            assert!(
                is_path_ignored(&compile(&granted), "/a/b", false),
                "{granted:?}"
            );
        }
    }

    #[test]
    fn the_server_root_is_never_ignored() {
        let list = compile(&["*"]);

        for path in ["/", "", ".", "/.", "/config/.."] {
            assert!(!is_path_ignored(&list, path, true), "{path}");
            assert!(!is_path_ignored_subtree(&list, path, true), "{path}");
        }
    }

    // merge_access
    const PROBES: &[(&str, bool)] = &[
        ("/secret", false),
        ("/secret", true),
        ("/secret/token.txt", false),
        ("/game/secret", false),
        ("/keep", false),
        ("/other", false),
        ("/config", true),
        ("/config/server.properties", false),
    ];

    fn access(permissions: &[&str], ignored: &[&str]) -> ServerAccess {
        (
            permissions
                .iter()
                .copied()
                .map(CompactString::from)
                .collect(),
            ignored.iter().copied().map(CompactString::from).collect(),
        )
    }

    fn compile_access(access: &ServerAccess) -> IgnoreList {
        IgnoreList::try_from_lines(&access.1).unwrap()
    }

    fn hides(access: &ServerAccess, path: &str, is_dir: bool) -> bool {
        is_path_ignored(&compile_access(access), path, is_dir)
    }

    fn permission_set(access: &ServerAccess) -> HashSet<&str> {
        access.0.iter().map(CompactString::as_str).collect()
    }

    fn hidden_probes(access: &ServerAccess) -> Vec<(&'static str, bool)> {
        let list = compile_access(access);

        PROBES
            .iter()
            .copied()
            .filter(|(path, is_dir)| is_path_ignored(&list, path, *is_dir))
            .collect()
    }

    fn merge_both_ways(a: &ServerAccess, b: &ServerAccess) -> ServerAccess {
        let forward = merge_access(Some(a.clone()), Some(b.clone())).unwrap();
        let backward = merge_access(Some(b.clone()), Some(a.clone())).unwrap();

        assert_eq!(permission_set(&forward), permission_set(&backward));
        assert_eq!(hidden_probes(&forward), hidden_probes(&backward));

        let union = permission_set(a)
            .union(&permission_set(b))
            .copied()
            .collect::<HashSet<_>>();
        assert_eq!(permission_set(&forward), union);

        for permission in &forward.0 {
            for &(path, is_dir) in PROBES {
                if hides(&forward, path, is_dir) {
                    continue;
                }

                assert!(
                    [a, b]
                        .iter()
                        .any(|input| input.0.contains(permission) && !hides(input, path, is_dir)),
                    "{permission} exposed on {path} (dir: {is_dir}) by {forward:?}"
                );
            }
        }

        forward
    }

    #[test]
    fn a_missing_grant_leaves_the_other_untouched() {
        let grant = access(&["files.read"], &["secret", "!secret/keep"]);

        assert_eq!(merge_access(None, None), None);
        assert_eq!(merge_access(Some(grant.clone()), None), Some(grant.clone()));
        assert_eq!(merge_access(None, Some(grant.clone())), Some(grant));
    }

    #[test]
    fn a_broader_preset_without_ignores_overrides_a_narrow_subuser_grant() {
        let subuser = access(&["control.start"], &[]);
        let preset = access(&["control.start", "files.read", "files.write"], &[]);

        let merged = merge_both_ways(&subuser, &preset);

        assert_eq!(permission_set(&merged), permission_set(&preset));
        assert!(hidden_probes(&merged).is_empty(), "{merged:?}");
    }

    #[test]
    fn a_dominant_grant_without_ignores_hides_nothing_in_the_merge() {
        let narrow = access(&["files.read"], &["secret"]);
        let dominant = access(&["files.read", "files.write"], &[]);

        let merged = merge_both_ways(&narrow, &dominant);

        assert_eq!(permission_set(&merged), permission_set(&dominant));
        assert!(hidden_probes(&merged).is_empty(), "{merged:?}");
    }

    #[test]
    fn a_dominant_grant_whose_list_is_a_suffix_of_the_other_hides_exactly_its_own_paths() {
        let narrow = access(&["files.read"], &["*", "!keep", "secret"]);
        let dominant = access(&["files.read", "files.write"], &["secret"]);

        let merged = merge_both_ways(&narrow, &dominant);

        assert_eq!(permission_set(&merged), permission_set(&dominant));
        assert_eq!(hidden_probes(&merged), hidden_probes(&dominant));
    }

    #[test]
    fn a_reinclude_in_one_grant_does_not_expose_what_the_other_hides_for_its_extra_permissions() {
        let writer = access(&["files.read", "files.write"], &["secret"]);
        let reader = access(&["files.read"], &["*", "!secret"]);

        let merged = merge_both_ways(&writer, &reader);

        assert!(hides(&merged, "/secret", false), "{merged:?}");
        assert!(hides(&merged, "/game/secret", false), "{merged:?}");
    }

    #[test]
    fn a_negation_in_one_grant_does_not_cancel_the_other_grants_ignore() {
        for negation in ["!secret", "  !secret"] {
            let writer = access(&["files.read", "files.write"], &["secret"]);
            let reader = access(&["files.read"], &[negation]);

            let merged = merge_both_ways(&writer, &reader);

            assert!(hides(&merged, "/secret", false), "{negation:?}: {merged:?}");
            assert!(
                hides(&merged, "/secret/token.txt", false),
                "{negation:?}: {merged:?}"
            );
        }
    }

    #[test]
    fn a_grant_without_file_permissions_does_not_lift_the_file_grants_ignores() {
        let files = access(&["files.read", "files.write"], &["secret", "/config"]);
        let control = access(&["control.start", "control.stop"], &[]);

        let merged = merge_both_ways(&files, &control);

        for (path, is_dir) in hidden_probes(&files) {
            assert!(hides(&merged, path, is_dir), "{path}: {merged:?}");
        }
    }

    #[test]
    fn mixed_grants_with_disjoint_ignores_never_widen_access() {
        merge_both_ways(
            &access(&["files.read", "control.start"], &["*", "!keep"]),
            &access(
                &["files.read", "files.write"],
                &["secret", "!secret/token.txt"],
            ),
        );
        merge_both_ways(
            &access(&["files.read"], &["/config"]),
            &access(&["files.write"], &["secret"]),
        );
    }

    // validate_labels
    fn labels(pairs: &[(&str, &str)]) -> IndexMap<CompactString, CompactString> {
        pairs
            .iter()
            .map(|(key, value)| (CompactString::from(*key), CompactString::from(*value)))
            .collect()
    }

    #[test]
    fn ordinary_labels_and_no_labels_at_all_are_accepted() {
        assert!(
            validate_labels(
                &labels(&[("environment", "production"), ("owner", "team-a")]),
                &()
            )
            .is_ok()
        );
        assert!(validate_labels(&labels(&[]), &()).is_ok());
    }

    #[test]
    fn the_keys_wings_unconditionally_overwrites_are_rejected() {
        for key in ["Service", "ContainerType"] {
            assert!(
                validate_labels(&labels(&[(key, "value")]), &()).is_err(),
                "{key}"
            );
        }
    }

    #[test]
    fn at_most_sixty_four_labels_are_accepted() {
        let build = |count: usize| {
            (0..count)
                .map(|i| {
                    (
                        CompactString::from(format!("key-{i}")),
                        CompactString::new("v"),
                    )
                })
                .collect::<IndexMap<_, _>>()
        };

        assert!(validate_labels(&build(64), &()).is_ok());
        assert!(validate_labels(&build(65), &()).is_err());
    }

    #[test]
    fn keys_and_values_are_limited_to_255_characters_rather_than_bytes() {
        let long = "é".repeat(255);
        let too_long = "a".repeat(256);

        assert!(validate_labels(&labels(&[(&long, "v")]), &()).is_ok());
        assert!(validate_labels(&labels(&[("k", &long)]), &()).is_ok());

        assert!(validate_labels(&labels(&[(&too_long, "v")]), &()).is_err());
        assert!(validate_labels(&labels(&[("k", &too_long)]), &()).is_err());
    }

    #[test]
    fn keys_that_are_empty_or_only_whitespace_are_rejected() {
        for key in ["", " ", "   "] {
            assert!(
                validate_labels(&labels(&[(key, "value")]), &()).is_err(),
                "{key:?}"
            );
        }
    }

    #[test]
    fn control_characters_are_rejected_in_keys_and_in_values() {
        for control in ["\n", "\r", "\0", "\u{7}"] {
            let key = format!("ke{control}y");
            let value = format!("va{control}lue");

            assert!(
                validate_labels(&labels(&[(&key, "value")]), &()).is_err(),
                "{key:?}"
            );
            assert!(
                validate_labels(&labels(&[("key", &value)]), &()).is_err(),
                "{value:?}"
            );
        }
    }
}
