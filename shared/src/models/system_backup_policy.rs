use crate::{
    models::{
        InsertQueryBuilder, UpdateQueryBuilder,
        server_backup::{BackupDisk, ServerBackupKind, retention::BackupRetention},
    },
    prelude::*,
};
use compact_str::ToCompactString;
use garde::Validate;
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{
    collections::BTreeMap,
    str::FromStr,
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, Clone)]
pub struct SystemBackupPolicy {
    pub uuid: uuid::Uuid,
    pub backup_configuration: Option<Fetchable<super::backup_configuration::BackupConfiguration>>,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,

    pub enabled: bool,
    pub kind: ServerBackupKind,
    pub cron: croner::Cron,
    pub retention: BackupRetention,
    pub parallelism: i32,

    pub triggered: Option<chrono::NaiveDateTime>,
    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for SystemBackupPolicy {
    const NAME: &'static str = "system_backup_policy";

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
                "system_backup_policies.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "system_backup_policies.backup_configuration_uuid",
                compact_str::format_compact!("{prefix}backup_configuration_uuid"),
            ),
            (
                "system_backup_policies.name",
                compact_str::format_compact!("{prefix}name"),
            ),
            (
                "system_backup_policies.description",
                compact_str::format_compact!("{prefix}description"),
            ),
            (
                "system_backup_policies.enabled",
                compact_str::format_compact!("{prefix}enabled"),
            ),
            (
                "system_backup_policies.kind",
                compact_str::format_compact!("{prefix}kind"),
            ),
            (
                "system_backup_policies.cron",
                compact_str::format_compact!("{prefix}cron"),
            ),
            (
                "system_backup_policies.retention",
                compact_str::format_compact!("{prefix}retention"),
            ),
            (
                "system_backup_policies.parallelism",
                compact_str::format_compact!("{prefix}parallelism"),
            ),
            (
                "system_backup_policies.triggered",
                compact_str::format_compact!("{prefix}triggered"),
            ),
            (
                "system_backup_policies.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ])
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        let cron: String = row.try_get(compact_str::format_compact!("{prefix}cron").as_str())?;

        Ok(Self {
            uuid: row.try_get(compact_str::format_compact!("{prefix}uuid").as_str())?,
            backup_configuration:
                super::backup_configuration::BackupConfiguration::get_fetchable_from_row(
                    row,
                    compact_str::format_compact!("{prefix}backup_configuration_uuid"),
                ),
            name: row.try_get(compact_str::format_compact!("{prefix}name").as_str())?,
            description: row
                .try_get(compact_str::format_compact!("{prefix}description").as_str())?,
            enabled: row.try_get(compact_str::format_compact!("{prefix}enabled").as_str())?,
            kind: row.try_get(compact_str::format_compact!("{prefix}kind").as_str())?,
            cron: croner::Cron::from_str(&cron)
                .map_err(|err| crate::database::DatabaseError::Any(anyhow::Error::new(err)))?,
            retention: serde_json::from_value(
                row.try_get(compact_str::format_compact!("{prefix}retention").as_str())?,
            )?,
            parallelism: row
                .try_get(compact_str::format_compact!("{prefix}parallelism").as_str())?,
            triggered: row.try_get(compact_str::format_compact!("{prefix}triggered").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

pub struct SystemBackupPolicyDueCandidate {
    pub server_uuid: uuid::Uuid,
    pub node_uuid: uuid::Uuid,
    pub database_instance_uuid: Option<uuid::Uuid>,
    pub database_agent_host_uuid: Option<uuid::Uuid>,
    pub last_attempt: Option<chrono::NaiveDateTime>,
    /// The point from which the policy started covering this target, used as the cron anchor
    /// when the target has no `last_attempt` yet.
    pub coverage_start: chrono::NaiveDateTime,
}

fn validate_backup_configuration(
    kind: ServerBackupKind,
    backup_configuration: &super::backup_configuration::BackupConfiguration,
) -> Result<(), crate::database::DatabaseError> {
    if kind == ServerBackupKind::DatabaseInstance
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

    Ok(())
}

impl SystemBackupPolicy {
    pub async fn all_with_pagination(
        database: &crate::database::Database,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM system_backup_policies
            WHERE $1 IS NULL OR system_backup_policies.name ILIKE '%' || $1 || '%'
            ORDER BY system_backup_policies.created
            LIMIT $2 OFFSET $3
            "#,
            Self::columns_sql(None)
        )))
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

    pub async fn all_schedulable(
        database: &crate::database::Database,
    ) -> Result<Vec<Self>, crate::database::DatabaseError> {
        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM system_backup_policies
            WHERE system_backup_policies.enabled OR system_backup_policies.triggered IS NOT NULL
            ORDER BY system_backup_policies.created
            "#,
            Self::columns_sql(None)
        )))
        .fetch_all(database.read())
        .await?;

        rows.into_iter()
            .map(|row| Self::map(None, &row))
            .try_collect_vec()
    }

    pub async fn trigger(
        &mut self,
        database: &crate::database::Database,
    ) -> Result<(), sqlx::Error> {
        let triggered = sqlx::query_scalar!(
            "UPDATE system_backup_policies
            SET triggered = NOW()
            WHERE system_backup_policies.uuid = $1
            RETURNING system_backup_policies.triggered",
            self.uuid,
        )
        .fetch_one(database.write())
        .await?;

        self.triggered = triggered;

        Ok(())
    }

    pub async fn clear_trigger(
        &self,
        database: &crate::database::Database,
        triggered: chrono::NaiveDateTime,
    ) -> Result<(), sqlx::Error> {
        sqlx::query!(
            "UPDATE system_backup_policies
            SET triggered = NULL
            WHERE system_backup_policies.uuid = $1 AND system_backup_policies.triggered = $2",
            self.uuid,
            triggered,
        )
        .execute(database.write())
        .await?;

        Ok(())
    }

    pub async fn due_candidates(
        &self,
        database: &crate::database::Database,
        limit: i64,
    ) -> Result<Vec<SystemBackupPolicyDueCandidate>, sqlx::Error> {
        match self.kind {
            ServerBackupKind::Server => self.due_server_candidates(database, limit).await,
            ServerBackupKind::DatabaseInstance => {
                self.due_database_instance_candidates(database, limit).await
            }
        }
    }

    async fn due_server_candidates(
        &self,
        database: &crate::database::Database,
        limit: i64,
    ) -> Result<Vec<SystemBackupPolicyDueCandidate>, sqlx::Error> {
        let rows = sqlx::query!(
            r#"
            SELECT
                candidates.server_uuid AS server_uuid,
                candidates.node_uuid AS node_uuid,
                candidates.last_attempt AS "last_attempt?",
                candidates.coverage_start AS "coverage_start!"
            FROM (
                SELECT
                    servers.uuid AS server_uuid,
                    servers.node_uuid AS node_uuid,
                    (
                        SELECT MAX(server_backups.created)
                        FROM server_backups
                        WHERE
                            server_backups.server_uuid = servers.uuid
                            AND server_backups.system_backup_policy_uuid = $1
                    ) AS last_attempt,
                    GREATEST(servers.created, coverage.attached) AS coverage_start
                FROM servers
                JOIN nodes ON nodes.uuid = servers.node_uuid
                LEFT JOIN LATERAL (
                    SELECT MIN(scopes.created) AS attached
                    FROM (
                        SELECT system_backup_policy_nodes.created
                        FROM system_backup_policy_nodes
                        WHERE
                            system_backup_policy_nodes.system_backup_policy_uuid = $1
                            AND system_backup_policy_nodes.node_uuid = servers.node_uuid
                        UNION ALL
                        SELECT system_backup_policy_locations.created
                        FROM system_backup_policy_locations
                        WHERE
                            system_backup_policy_locations.system_backup_policy_uuid = $1
                            AND system_backup_policy_locations.location_uuid = nodes.location_uuid
                        UNION ALL
                        SELECT system_backup_policy_servers.created
                        FROM system_backup_policy_servers
                        WHERE
                            system_backup_policy_servers.system_backup_policy_uuid = $1
                            AND system_backup_policy_servers.server_uuid = servers.uuid
                    ) AS scopes
                ) AS coverage ON TRUE
                WHERE
                    servers.destination_node_uuid IS NULL
                    AND servers.status IS NULL
                    AND coverage.attached IS NOT NULL
            ) AS candidates
            ORDER BY COALESCE(candidates.last_attempt, candidates.coverage_start) ASC
            LIMIT $2
            "#,
            self.uuid,
            limit,
        )
        .fetch_all(database.read())
        .await?;

        Ok(rows
            .into_iter()
            .map(|row| SystemBackupPolicyDueCandidate {
                server_uuid: row.server_uuid,
                node_uuid: row.node_uuid,
                database_instance_uuid: None,
                database_agent_host_uuid: None,
                last_attempt: row.last_attempt,
                coverage_start: row.coverage_start,
            })
            .collect())
    }

    async fn due_database_instance_candidates(
        &self,
        database: &crate::database::Database,
        limit: i64,
    ) -> Result<Vec<SystemBackupPolicyDueCandidate>, sqlx::Error> {
        let rows = sqlx::query!(
            r#"
            SELECT
                candidates.server_uuid AS server_uuid,
                candidates.node_uuid AS node_uuid,
                candidates.database_instance_uuid AS database_instance_uuid,
                candidates.database_agent_host_uuid AS database_agent_host_uuid,
                candidates.last_attempt AS "last_attempt?",
                candidates.coverage_start AS "coverage_start!"
            FROM (
                SELECT
                    servers.uuid AS server_uuid,
                    servers.node_uuid AS node_uuid,
                    server_database_instances.uuid AS database_instance_uuid,
                    server_database_instances.database_agent_host_uuid AS database_agent_host_uuid,
                    (
                        SELECT MAX(server_backups.created)
                        FROM server_backups
                        WHERE
                            server_backups.system_backup_policy_uuid = $1
                            AND server_backups.database_instance_uuid = server_database_instances.uuid
                    ) AS last_attempt,
                    GREATEST(server_database_instances.created, coverage.attached) AS coverage_start
                FROM server_database_instances
                JOIN servers ON servers.uuid = server_database_instances.server_uuid
                JOIN database_agent_hosts ON database_agent_hosts.uuid = server_database_instances.database_agent_host_uuid
                LEFT JOIN LATERAL (
                    SELECT MIN(scopes.created) AS attached
                    FROM (
                        SELECT system_backup_policy_database_agent_hosts.created
                        FROM system_backup_policy_database_agent_hosts
                        WHERE
                            system_backup_policy_database_agent_hosts.system_backup_policy_uuid = $1
                            AND system_backup_policy_database_agent_hosts.database_agent_host_uuid = server_database_instances.database_agent_host_uuid
                        UNION ALL
                        SELECT system_backup_policy_locations.created
                        FROM system_backup_policy_locations
                        JOIN location_database_agent_hosts ON location_database_agent_hosts.location_uuid = system_backup_policy_locations.location_uuid
                        WHERE
                            system_backup_policy_locations.system_backup_policy_uuid = $1
                            AND location_database_agent_hosts.database_agent_host_uuid = server_database_instances.database_agent_host_uuid
                        UNION ALL
                        SELECT system_backup_policy_servers.created
                        FROM system_backup_policy_servers
                        WHERE
                            system_backup_policy_servers.system_backup_policy_uuid = $1
                            AND system_backup_policy_servers.server_uuid = servers.uuid
                    ) AS scopes
                ) AS coverage ON TRUE
                WHERE
                    servers.destination_node_uuid IS NULL
                    AND servers.status IS NULL
                    AND server_database_instances.status IS NULL
                    AND NOT database_agent_hosts.maintenance_enabled
                    AND coverage.attached IS NOT NULL
            ) AS candidates
            ORDER BY COALESCE(candidates.last_attempt, candidates.coverage_start) ASC
            LIMIT $2
            "#,
            self.uuid,
            limit,
        )
        .fetch_all(database.read())
        .await?;

        Ok(rows
            .into_iter()
            .map(|row| SystemBackupPolicyDueCandidate {
                server_uuid: row.server_uuid,
                node_uuid: row.node_uuid,
                database_instance_uuid: Some(row.database_instance_uuid),
                database_agent_host_uuid: Some(row.database_agent_host_uuid),
                last_attempt: row.last_attempt,
                coverage_start: row.coverage_start,
            })
            .collect())
    }

    /// (total_nodes, total_database_agent_hosts, total_locations, total_servers, total_backups)
    async fn attachment_counts(
        &self,
        database: &crate::database::Database,
    ) -> Result<(i64, i64, i64, i64, i64), crate::database::DatabaseError> {
        let row = sqlx::query!(
            r#"
            SELECT
                (
                    SELECT COUNT(*)
                    FROM system_backup_policy_nodes
                    WHERE system_backup_policy_nodes.system_backup_policy_uuid = $1
                ) AS "total_nodes!",
                (
                    SELECT COUNT(*)
                    FROM system_backup_policy_database_agent_hosts
                    WHERE system_backup_policy_database_agent_hosts.system_backup_policy_uuid = $1
                ) AS "total_database_agent_hosts!",
                (
                    SELECT COUNT(*)
                    FROM system_backup_policy_locations
                    WHERE system_backup_policy_locations.system_backup_policy_uuid = $1
                ) AS "total_locations!",
                (
                    SELECT COUNT(*)
                    FROM system_backup_policy_servers
                    WHERE system_backup_policy_servers.system_backup_policy_uuid = $1
                ) AS "total_servers!",
                (
                    SELECT COUNT(*)
                    FROM server_backups
                    WHERE
                        server_backups.system_backup_policy_uuid = $1
                        AND server_backups.deleted IS NULL
                ) AS "total_backups!"
            "#,
            self.uuid,
        )
        .fetch_one(database.read())
        .await?;

        Ok((
            row.total_nodes,
            row.total_database_agent_hosts,
            row.total_locations,
            row.total_servers,
            row.total_backups,
        ))
    }
}

#[async_trait::async_trait]
impl IntoAdminApiObject for SystemBackupPolicy {
    type AdminApiObject = AdminApiSystemBackupPolicy;
    type ExtraArgs<'a> = ();

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let (
            total_nodes,
            total_database_agent_hosts,
            total_locations,
            total_servers,
            total_backups,
        ) = self.attachment_counts(&state.database).await?;

        let api_object = AdminApiSystemBackupPolicy::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            AdminApiSystemBackupPolicy {
                uuid: self.uuid,
                backup_configuration: match self.backup_configuration {
                    Some(backup_configuration) => Some(
                        backup_configuration
                            .fetch_cached(&state.database)
                            .await?
                            .into_admin_api_object(state, ())
                            .await?,
                    ),
                    None => None,
                },
                name: self.name,
                description: self.description,
                enabled: self.enabled,
                kind: self.kind,
                cron: self.cron,
                retention: self.retention,
                parallelism: self.parallelism,
                triggered: self.triggered.map(|dt| dt.and_utc()),
                total_nodes,
                total_database_agent_hosts,
                total_locations,
                total_servers,
                total_backups,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[async_trait::async_trait]
impl ByUuid for SystemBackupPolicy {
    async fn by_uuid(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
    ) -> Result<Self, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM system_backup_policies
            WHERE system_backup_policies.uuid = $1
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
            FROM system_backup_policies
            WHERE system_backup_policies.uuid = $1
            "#,
            Self::columns_sql(None)
        )))
        .bind(uuid)
        .fetch_one(&mut **transaction)
        .await?;

        Self::map(None, &row)
    }
}

#[inline]
fn default_kind() -> ServerBackupKind {
    ServerBackupKind::Server
}

#[derive(ToSchema, Deserialize, Validate)]
pub struct CreateSystemBackupPolicyOptions {
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: compact_str::CompactString,
    #[garde(length(chars, min = 1, max = 1024))]
    #[schema(min_length = 1, max_length = 1024)]
    pub description: Option<compact_str::CompactString>,
    #[garde(skip)]
    pub backup_configuration_uuid: Option<uuid::Uuid>,
    #[garde(skip)]
    pub enabled: bool,
    #[garde(skip)]
    #[serde(default = "default_kind")]
    pub kind: ServerBackupKind,
    #[garde(skip)]
    #[schema(value_type = String, example = "0 0 0 * * *")]
    pub cron: croner::Cron,
    #[garde(dive)]
    #[serde(default)]
    pub retention: BackupRetention,
    #[garde(range(min = 1, max = 100))]
    #[schema(minimum = 1, maximum = 100)]
    pub parallelism: i32,
}

#[async_trait::async_trait]
impl CreatableModel for SystemBackupPolicy {
    type CreateOptions<'a> = CreateSystemBackupPolicyOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<SystemBackupPolicy>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create_with_transaction(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        if let Some(backup_configuration_uuid) = options.backup_configuration_uuid {
            let backup_configuration =
                super::backup_configuration::BackupConfiguration::by_uuid_optional_cached(
                    &state.database,
                    backup_configuration_uuid,
                )
                .await?
                .ok_or(crate::database::InvalidRelationError(
                    "backup_configuration",
                ))?;
            validate_backup_configuration(options.kind, &backup_configuration)?;
        }

        let mut query_builder = InsertQueryBuilder::new("system_backup_policies");

        Self::run_create_handlers(&mut options, &mut query_builder, state, transaction).await?;

        query_builder
            .set("name", &options.name)
            .set("description", &options.description)
            .set(
                "backup_configuration_uuid",
                options.backup_configuration_uuid,
            )
            .set("enabled", options.enabled)
            .set("kind", options.kind)
            .set("cron", options.cron.to_compact_string())
            .set("retention", serde_json::to_value(&options.retention)?)
            .set("parallelism", options.parallelism);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut **transaction)
            .await?;
        let mut policy = Self::map(None, &row)?;

        Self::run_after_create_handlers(&mut policy, &options, state, transaction).await?;

        Ok(policy)
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Default)]
pub struct UpdateSystemBackupPolicyOptions {
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
    #[garde(skip)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub backup_configuration_uuid: Option<Option<uuid::Uuid>>,
    #[garde(skip)]
    pub enabled: Option<bool>,
    #[garde(skip)]
    #[schema(value_type = Option<String>, example = "0 0 0 * * *")]
    pub cron: Option<croner::Cron>,
    #[garde(dive)]
    #[schema(nullable = false)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        deserialize_with = "crate::deserialize::deserialize_non_null_option"
    )]
    pub retention: Option<BackupRetention>,
    #[garde(inner(range(min = 1, max = 100)))]
    #[schema(minimum = 1, maximum = 100)]
    pub parallelism: Option<i32>,
}

#[async_trait::async_trait]
impl UpdatableModel for SystemBackupPolicy {
    type UpdateOptions = UpdateSystemBackupPolicyOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateHandlerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateHandlerList<SystemBackupPolicy>> =
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

        if let Some(Some(backup_configuration_uuid)) = options.backup_configuration_uuid {
            let backup_configuration =
                super::backup_configuration::BackupConfiguration::by_uuid_optional_cached(
                    &state.database,
                    backup_configuration_uuid,
                )
                .await?
                .ok_or(crate::database::InvalidRelationError(
                    "backup_configuration",
                ))?;
            validate_backup_configuration(self.kind, &backup_configuration)?;
        }

        let mut query_builder = UpdateQueryBuilder::new("system_backup_policies");

        self.run_update_handlers(&mut options, &mut query_builder, state, transaction)
            .await?;

        query_builder
            .set("name", options.name.as_ref())
            .set(
                "description",
                options.description.as_ref().map(|d| d.as_ref()),
            )
            .set(
                "backup_configuration_uuid",
                options.backup_configuration_uuid,
            )
            .set("enabled", options.enabled)
            .set(
                "cron",
                options.cron.as_ref().map(|cron| cron.to_compact_string()),
            )
            .set(
                "retention",
                options
                    .retention
                    .as_ref()
                    .map(serde_json::to_value)
                    .transpose()?,
            )
            .set("parallelism", options.parallelism)
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut **transaction).await?;

        if let Some(name) = options.name {
            self.name = name;
        }
        if let Some(description) = options.description {
            self.description = description;
        }
        if let Some(backup_configuration_uuid) = options.backup_configuration_uuid {
            self.backup_configuration = backup_configuration_uuid
                .map(super::backup_configuration::BackupConfiguration::get_fetchable);
        }
        if let Some(enabled) = options.enabled {
            self.enabled = enabled;
        }
        if let Some(cron) = options.cron {
            self.cron = cron;
        }
        if let Some(retention) = options.retention {
            self.retention = retention;
        }
        if let Some(parallelism) = options.parallelism {
            self.parallelism = parallelism;
        }

        self.run_after_update_handlers(state, transaction).await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl DeletableModel for SystemBackupPolicy {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteHandlerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteHandlerList<SystemBackupPolicy>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &DELETE_LISTENERS
    }

    async fn delete_with_transaction(
        &self,
        state: &crate::State,
        options: Self::DeleteOptions,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<(), anyhow::Error> {
        self.run_delete_handlers(&options, state, transaction)
            .await?;

        sqlx::query!(
            "DELETE FROM system_backup_policies
            WHERE system_backup_policies.uuid = $1",
            self.uuid,
        )
        .execute(&mut **transaction)
        .await?;

        self.run_after_delete_handlers(&options, state, transaction)
            .await?;

        Ok(())
    }
}

#[schema_extension_derive::extendible]
#[init_args(SystemBackupPolicy, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "SystemBackupPolicy")]
pub struct AdminApiSystemBackupPolicy {
    pub uuid: uuid::Uuid,
    pub backup_configuration: Option<super::backup_configuration::AdminApiBackupConfiguration>,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,

    pub enabled: bool,
    pub kind: ServerBackupKind,
    #[schema(value_type = String, example = "0 0 0 * * *")]
    pub cron: croner::Cron,
    pub retention: BackupRetention,
    pub parallelism: i32,

    pub triggered: Option<chrono::DateTime<chrono::Utc>>,

    pub total_nodes: i64,
    pub total_database_agent_hosts: i64,
    pub total_locations: i64,
    pub total_servers: i64,
    pub total_backups: i64,

    pub created: chrono::DateTime<chrono::Utc>,
}
