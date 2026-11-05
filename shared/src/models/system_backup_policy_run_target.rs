use crate::{models::server_backup::ServerBackupKind, prelude::*};
use serde::{Deserialize, Serialize};
use sqlx::{Row, Type, postgres::PgRow};
use std::{collections::BTreeMap, sync::LazyLock};
use utoipa::ToSchema;

#[derive(Debug, ToSchema, Serialize, Deserialize, Type, PartialEq, Eq, Hash, Clone, Copy)]
#[serde(rename_all = "snake_case")]
#[sqlx(
    type_name = "system_backup_policy_run_target_status",
    rename_all = "SCREAMING_SNAKE_CASE"
)]
pub enum SystemBackupPolicyRunTargetStatus {
    Pending,
    Dispatched,
    Skipped,
    Failed,
}

#[derive(Debug, ToSchema, Serialize, Deserialize, Type, PartialEq, Eq, Hash, Clone, Copy)]
#[serde(rename_all = "snake_case")]
#[sqlx(
    type_name = "system_backup_policy_run_target_reason",
    rename_all = "SCREAMING_SNAKE_CASE"
)]
pub enum SystemBackupPolicyRunTargetReason {
    NodeMaintenance,
    BackupConfigurationMaintenance,
    DatabaseAgentHostMaintenance,
    DatabaseInstanceStopped,
    ServerBusy,
    MetadataFailed,
    NoBackupConfiguration,
    UnsupportedBackupDisk,
    TargetRemoved,
    CreateFailed,
    PolicyDisabled,
    Superseded,
    Cancelled,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SystemBackupPolicyRunTarget {
    pub uuid: uuid::Uuid,
    pub server: Option<Fetchable<super::server::Server>>,
    pub database_instance:
        Option<Fetchable<super::server_database_instance::ServerDatabaseInstance>>,
    pub database_instance_name: Option<compact_str::CompactString>,
    pub server_backup: Option<Fetchable<super::server_backup::ServerBackup>>,
    pub server_backup_successful: Option<bool>,
    pub server_backup_completed: Option<chrono::NaiveDateTime>,

    pub status: SystemBackupPolicyRunTargetStatus,
    pub reason: Option<SystemBackupPolicyRunTargetReason>,

    pub not_before: Option<chrono::NaiveDateTime>,
    pub updated: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for SystemBackupPolicyRunTarget {
    const NAME: &'static str = "system_backup_policy_run_target";

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
                "system_backup_policy_run_targets.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "system_backup_policy_run_targets.server_uuid",
                compact_str::format_compact!("{prefix}server_uuid"),
            ),
            (
                "system_backup_policy_run_targets.database_instance_uuid",
                compact_str::format_compact!("{prefix}database_instance_uuid"),
            ),
            (
                "server_database_instances.name",
                compact_str::format_compact!("{prefix}database_instance_name"),
            ),
            (
                "system_backup_policy_run_targets.server_backup_uuid",
                compact_str::format_compact!("{prefix}server_backup_uuid"),
            ),
            (
                "server_backups.successful",
                compact_str::format_compact!("{prefix}server_backup_successful"),
            ),
            (
                "server_backups.completed",
                compact_str::format_compact!("{prefix}server_backup_completed"),
            ),
            (
                "system_backup_policy_run_targets.status",
                compact_str::format_compact!("{prefix}status"),
            ),
            (
                "system_backup_policy_run_targets.reason",
                compact_str::format_compact!("{prefix}reason"),
            ),
            (
                "system_backup_policy_run_targets.not_before",
                compact_str::format_compact!("{prefix}not_before"),
            ),
            (
                "system_backup_policy_run_targets.updated",
                compact_str::format_compact!("{prefix}updated"),
            ),
        ])
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            uuid: row.try_get(compact_str::format_compact!("{prefix}uuid").as_str())?,
            server: row
                .try_get::<Option<uuid::Uuid>, _>(
                    compact_str::format_compact!("{prefix}server_uuid").as_str(),
                )?
                .map(super::server::Server::get_fetchable),
            database_instance: row
                .try_get::<Option<uuid::Uuid>, _>(
                    compact_str::format_compact!("{prefix}database_instance_uuid").as_str(),
                )?
                .map(super::server_database_instance::ServerDatabaseInstance::get_fetchable),
            database_instance_name: row
                .try_get(compact_str::format_compact!("{prefix}database_instance_name").as_str())?,
            server_backup: row
                .try_get::<Option<uuid::Uuid>, _>(
                    compact_str::format_compact!("{prefix}server_backup_uuid").as_str(),
                )?
                .map(super::server_backup::ServerBackup::get_fetchable),
            server_backup_successful: row.try_get(
                compact_str::format_compact!("{prefix}server_backup_successful").as_str(),
            )?,
            server_backup_completed: row.try_get(
                compact_str::format_compact!("{prefix}server_backup_completed").as_str(),
            )?,
            status: row.try_get(compact_str::format_compact!("{prefix}status").as_str())?,
            reason: row.try_get(compact_str::format_compact!("{prefix}reason").as_str())?,
            not_before: row.try_get(compact_str::format_compact!("{prefix}not_before").as_str())?,
            updated: row.try_get(compact_str::format_compact!("{prefix}updated").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

pub struct SystemBackupPolicyRunTargetClaim {
    pub uuid: uuid::Uuid,
    pub server: Option<Fetchable<super::server::Server>>,
    pub database_instance:
        Option<Fetchable<super::server_database_instance::ServerDatabaseInstance>>,
    pub existing_server_backup: Option<Fetchable<super::server_backup::ServerBackup>>,
}

impl SystemBackupPolicyRunTarget {
    pub async fn by_system_backup_policy_run_uuid_with_pagination(
        database: &crate::database::Database,
        system_backup_policy_run_uuid: uuid::Uuid,
        status: Option<SystemBackupPolicyRunTargetStatus>,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        super::PaginatedQueryBuilder::new(
            Self::columns_sql(None),
            format!(
                r#"
                FROM system_backup_policy_run_targets
                LEFT JOIN servers ON servers.uuid = system_backup_policy_run_targets.server_uuid
                LEFT JOIN server_database_instances ON server_database_instances.uuid = system_backup_policy_run_targets.database_instance_uuid
                LEFT JOIN server_backups ON server_backups.uuid = system_backup_policy_run_targets.server_backup_uuid
                WHERE
                    system_backup_policy_run_targets.system_backup_policy_run_uuid = $1
                    AND ($2::system_backup_policy_run_target_status IS NULL OR system_backup_policy_run_targets.status = $2)
                    AND {search}
                "#,
                search = super::search_sql(
                    3,
                    &["servers.name", "server_database_instances.name"],
                    &["servers.uuid", "server_database_instances.uuid"]
                ),
            ),
            "system_backup_policy_run_targets.updated DESC, system_backup_policy_run_targets.uuid",
        )
        .bind(system_backup_policy_run_uuid)
        .bind(status)
        .bind(search)
        .fetch(database, page, per_page)
        .await
    }

    pub async fn claimable(
        database: &crate::database::Database,
        system_backup_policy_uuid: uuid::Uuid,
        kind: ServerBackupKind,
        parallelism: i32,
        limit: i64,
    ) -> Result<Vec<SystemBackupPolicyRunTargetClaim>, sqlx::Error> {
        match kind {
            ServerBackupKind::Server => {
                let rows = sqlx::query!(
                    r#"
                    WITH in_flight AS (
                        SELECT server_backups.node_uuid AS scope_uuid, COUNT(*) AS count
                        FROM server_backups
                        WHERE
                            server_backups.system_backup_policy_uuid = $1
                            AND server_backups.completed IS NULL
                            AND server_backups.deleted IS NULL
                            AND server_backups.created >= NOW() - INTERVAL '1 day'
                        GROUP BY server_backups.node_uuid
                    ),
                    ranked AS (
                        SELECT
                            system_backup_policy_run_targets.uuid,
                            system_backup_policy_run_targets.server_uuid,
                            system_backup_policy_runs.created AS run_created,
                            servers.node_uuid AS scope_uuid,
                            ROW_NUMBER() OVER (
                                PARTITION BY servers.node_uuid
                                ORDER BY system_backup_policy_run_targets.last_attempt ASC NULLS FIRST, system_backup_policy_run_targets.uuid
                            ) AS position
                        FROM system_backup_policy_run_targets
                        JOIN system_backup_policy_runs ON system_backup_policy_runs.uuid = system_backup_policy_run_targets.system_backup_policy_run_uuid
                        LEFT JOIN servers ON servers.uuid = system_backup_policy_run_targets.server_uuid
                        WHERE
                            system_backup_policy_runs.system_backup_policy_uuid = $1
                            AND system_backup_policy_runs.completed IS NULL
                            AND system_backup_policy_run_targets.status = 'PENDING'
                            AND (
                                system_backup_policy_run_targets.not_before IS NULL
                                OR system_backup_policy_run_targets.not_before <= NOW()
                            )
                    )
                    SELECT
                        ranked.uuid AS "uuid!",
                        ranked.server_uuid AS "server_uuid?",
                        (
                            SELECT server_backups.uuid
                            FROM server_backups
                            WHERE
                                server_backups.system_backup_policy_uuid = $1
                                AND server_backups.server_uuid = ranked.server_uuid
                                AND server_backups.created >= ranked.run_created
                            ORDER BY server_backups.created DESC
                            LIMIT 1
                        ) AS "existing_server_backup_uuid?"
                    FROM ranked
                    LEFT JOIN in_flight ON in_flight.scope_uuid = ranked.scope_uuid
                    WHERE
                        ranked.scope_uuid IS NULL
                        OR ranked.position <= $2 - COALESCE(in_flight.count, 0)
                    ORDER BY ranked.position, ranked.uuid
                    LIMIT $3
                    "#,
                    system_backup_policy_uuid,
                    parallelism as i64,
                    limit,
                )
                .fetch_all(database.write())
                .await?;

                Ok(rows
                    .into_iter()
                    .map(|row| SystemBackupPolicyRunTargetClaim {
                        uuid: row.uuid,
                        server: row.server_uuid.map(super::server::Server::get_fetchable),
                        database_instance: None,
                        existing_server_backup: row
                            .existing_server_backup_uuid
                            .map(super::server_backup::ServerBackup::get_fetchable),
                    })
                    .collect())
            }
            ServerBackupKind::DatabaseInstance => {
                let rows = sqlx::query!(
                    r#"
                    WITH in_flight AS (
                        SELECT server_database_instances.database_agent_host_uuid AS scope_uuid, COUNT(*) AS count
                        FROM server_backups
                        JOIN server_database_instances ON server_database_instances.uuid = server_backups.database_instance_uuid
                        WHERE
                            server_backups.system_backup_policy_uuid = $1
                            AND server_backups.completed IS NULL
                            AND server_backups.deleted IS NULL
                            AND server_backups.created >= NOW() - INTERVAL '1 day'
                        GROUP BY server_database_instances.database_agent_host_uuid
                    ),
                    ranked AS (
                        SELECT
                            system_backup_policy_run_targets.uuid,
                            system_backup_policy_run_targets.server_uuid,
                            system_backup_policy_run_targets.database_instance_uuid,
                            system_backup_policy_runs.created AS run_created,
                            server_database_instances.database_agent_host_uuid AS scope_uuid,
                            ROW_NUMBER() OVER (
                                PARTITION BY server_database_instances.database_agent_host_uuid
                                ORDER BY system_backup_policy_run_targets.last_attempt ASC NULLS FIRST, system_backup_policy_run_targets.uuid
                            ) AS position
                        FROM system_backup_policy_run_targets
                        JOIN system_backup_policy_runs ON system_backup_policy_runs.uuid = system_backup_policy_run_targets.system_backup_policy_run_uuid
                        LEFT JOIN server_database_instances ON server_database_instances.uuid = system_backup_policy_run_targets.database_instance_uuid
                        WHERE
                            system_backup_policy_runs.system_backup_policy_uuid = $1
                            AND system_backup_policy_runs.completed IS NULL
                            AND system_backup_policy_run_targets.status = 'PENDING'
                            AND (
                                system_backup_policy_run_targets.not_before IS NULL
                                OR system_backup_policy_run_targets.not_before <= NOW()
                            )
                    )
                    SELECT
                        ranked.uuid AS "uuid!",
                        ranked.server_uuid AS "server_uuid?",
                        ranked.database_instance_uuid AS "database_instance_uuid?",
                        (
                            SELECT server_backups.uuid
                            FROM server_backups
                            WHERE
                                server_backups.system_backup_policy_uuid = $1
                                AND server_backups.database_instance_uuid = ranked.database_instance_uuid
                                AND server_backups.created >= ranked.run_created
                            ORDER BY server_backups.created DESC
                            LIMIT 1
                        ) AS "existing_server_backup_uuid?"
                    FROM ranked
                    LEFT JOIN in_flight ON in_flight.scope_uuid = ranked.scope_uuid
                    WHERE
                        ranked.scope_uuid IS NULL
                        OR ranked.position <= $2 - COALESCE(in_flight.count, 0)
                    ORDER BY ranked.position, ranked.uuid
                    LIMIT $3
                    "#,
                    system_backup_policy_uuid,
                    parallelism as i64,
                    limit,
                )
                .fetch_all(database.write())
                .await?;

                Ok(rows
                    .into_iter()
                    .map(|row| SystemBackupPolicyRunTargetClaim {
                        uuid: row.uuid,
                        server: row.server_uuid.map(super::server::Server::get_fetchable),
                        database_instance: row.database_instance_uuid.map(
                            super::server_database_instance::ServerDatabaseInstance::get_fetchable,
                        ),
                        existing_server_backup: row
                            .existing_server_backup_uuid
                            .map(super::server_backup::ServerBackup::get_fetchable),
                    })
                    .collect())
            }
        }
    }

    pub async fn set_dispatched(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
        server_backup_uuid: uuid::Uuid,
    ) -> Result<(), sqlx::Error> {
        sqlx::query!(
            "UPDATE system_backup_policy_run_targets
            SET status = 'DISPATCHED', reason = NULL, server_backup_uuid = $2, not_before = NULL, updated = NOW()
            WHERE system_backup_policy_run_targets.uuid = $1",
            uuid,
            server_backup_uuid,
        )
        .execute(database.write())
        .await?;

        Ok(())
    }

    pub async fn set_deferred(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
        reason: Option<SystemBackupPolicyRunTargetReason>,
        not_before: chrono::NaiveDateTime,
    ) -> Result<(), sqlx::Error> {
        sqlx::query!(
            "UPDATE system_backup_policy_run_targets
            SET reason = COALESCE($2, system_backup_policy_run_targets.reason), not_before = $3, updated = NOW()
            WHERE system_backup_policy_run_targets.uuid = $1 AND system_backup_policy_run_targets.status = 'PENDING'",
            uuid,
            reason as Option<SystemBackupPolicyRunTargetReason>,
            not_before,
        )
        .execute(database.write())
        .await?;

        Ok(())
    }

    pub async fn set_resolved(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
        status: SystemBackupPolicyRunTargetStatus,
        reason: SystemBackupPolicyRunTargetReason,
    ) -> Result<(), sqlx::Error> {
        sqlx::query!(
            "UPDATE system_backup_policy_run_targets
            SET status = $2, reason = $3, not_before = NULL, updated = NOW()
            WHERE system_backup_policy_run_targets.uuid = $1 AND system_backup_policy_run_targets.status = 'PENDING'",
            uuid,
            status as SystemBackupPolicyRunTargetStatus,
            reason as SystemBackupPolicyRunTargetReason,
        )
        .execute(database.write())
        .await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl IntoAdminApiObject for SystemBackupPolicyRunTarget {
    type AdminApiObject = AdminApiSystemBackupPolicyRunTarget;
    type ExtraArgs<'a> = &'a crate::storage::StorageUrlRetriever<'a>;

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        storage_url_retriever: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiSystemBackupPolicyRunTarget::init_hooks(&self, state).await?;

        let server = match self.server {
            Some(server) => match server.fetch_optional_cached(&state.database).await? {
                Some(server) => Some(
                    server
                        .into_admin_api_object(state, storage_url_retriever)
                        .await?,
                ),
                None => None,
            },
            None => None,
        };

        let api_object = finish_extendible!(
            AdminApiSystemBackupPolicyRunTarget {
                uuid: self.uuid,
                server,
                database_instance_uuid: self
                    .database_instance
                    .map(|database_instance| database_instance.uuid),
                database_instance_name: self.database_instance_name,
                server_backup_uuid: self.server_backup.map(|server_backup| server_backup.uuid),
                server_backup_successful: self.server_backup_successful,
                server_backup_completed: self.server_backup_completed.map(|dt| dt.and_utc()),
                status: self.status,
                reason: self.reason,
                not_before: self.not_before.map(|dt| dt.and_utc()),
                updated: self.updated.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[schema_extension_derive::extendible]
#[init_args(SystemBackupPolicyRunTarget, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "SystemBackupPolicyRunTarget")]
pub struct AdminApiSystemBackupPolicyRunTarget {
    pub uuid: uuid::Uuid,
    pub server: Option<super::server::AdminApiServer>,
    pub database_instance_uuid: Option<uuid::Uuid>,
    pub database_instance_name: Option<compact_str::CompactString>,
    pub server_backup_uuid: Option<uuid::Uuid>,
    pub server_backup_successful: Option<bool>,
    pub server_backup_completed: Option<chrono::DateTime<chrono::Utc>>,

    pub status: SystemBackupPolicyRunTargetStatus,
    pub reason: Option<SystemBackupPolicyRunTargetReason>,

    pub not_before: Option<chrono::DateTime<chrono::Utc>>,
    pub updated: chrono::DateTime<chrono::Utc>,
}
