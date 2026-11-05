use crate::{
    models::{
        server_backup::ServerBackupKind, system_backup_policy::SystemBackupPolicy,
        system_backup_policy_run_target::SystemBackupPolicyRunTargetReason,
    },
    prelude::*,
};
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{collections::BTreeMap, sync::LazyLock};

const PROGRESS_JOIN: &str = r#"
    LEFT JOIN LATERAL (
        SELECT
            COUNT(*) FILTER (
                WHERE system_backup_policy_run_targets.status = 'PENDING'
            ) AS pending_targets,
            COUNT(*) FILTER (
                WHERE system_backup_policy_run_targets.status = 'DISPATCHED'
                AND COALESCE(
                    server_backups.completed IS NULL
                    AND server_backups.deleted IS NULL
                    AND server_backups.created >= NOW() - INTERVAL '1 day',
                    FALSE
                )
            ) AS running_targets,
            COUNT(*) FILTER (
                WHERE system_backup_policy_run_targets.status = 'DISPATCHED'
                AND server_backups.successful
            ) AS successful_targets,
            COUNT(*) FILTER (
                WHERE system_backup_policy_run_targets.status = 'FAILED'
                OR (
                    system_backup_policy_run_targets.status = 'DISPATCHED'
                    AND NOT COALESCE(server_backups.successful, FALSE)
                    AND NOT COALESCE(
                        server_backups.completed IS NULL
                        AND server_backups.deleted IS NULL
                        AND server_backups.created >= NOW() - INTERVAL '1 day',
                        FALSE
                    )
                )
            ) AS failed_targets,
            COUNT(*) FILTER (
                WHERE system_backup_policy_run_targets.status = 'SKIPPED'
            ) AS skipped_targets
        FROM system_backup_policy_run_targets
        LEFT JOIN server_backups ON server_backups.uuid = system_backup_policy_run_targets.server_backup_uuid
        WHERE
            system_backup_policy_run_targets.system_backup_policy_run_uuid = system_backup_policy_runs.uuid
            AND system_backup_policy_runs.completed IS NULL
    ) AS system_backup_policy_run_progress ON TRUE
"#;

#[derive(Serialize, Deserialize, Clone)]
pub struct SystemBackupPolicyRun {
    pub uuid: uuid::Uuid,
    pub system_backup_policy: Fetchable<SystemBackupPolicy>,

    pub manual: bool,
    pub occurrence: chrono::NaiveDateTime,

    pub total_targets: i64,
    pub pending_targets: i64,
    pub running_targets: i64,
    pub successful_targets: i64,
    pub failed_targets: i64,
    pub skipped_targets: i64,

    pub cancelled: Option<chrono::NaiveDateTime>,
    pub completed: Option<chrono::NaiveDateTime>,
    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for SystemBackupPolicyRun {
    const NAME: &'static str = "system_backup_policy_run";

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
                "system_backup_policy_runs.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "system_backup_policy_runs.system_backup_policy_uuid",
                compact_str::format_compact!("{prefix}system_backup_policy_uuid"),
            ),
            (
                "system_backup_policy_runs.manual",
                compact_str::format_compact!("{prefix}manual"),
            ),
            (
                "system_backup_policy_runs.occurrence",
                compact_str::format_compact!("{prefix}occurrence"),
            ),
            (
                "system_backup_policy_runs.total_targets::int8",
                compact_str::format_compact!("{prefix}total_targets"),
            ),
            (
                "COALESCE(system_backup_policy_run_progress.pending_targets, 0)",
                compact_str::format_compact!("{prefix}pending_targets"),
            ),
            (
                "COALESCE(system_backup_policy_run_progress.running_targets, 0)",
                compact_str::format_compact!("{prefix}running_targets"),
            ),
            (
                "CASE WHEN system_backup_policy_runs.completed IS NULL THEN system_backup_policy_run_progress.successful_targets ELSE system_backup_policy_runs.successful_targets END",
                compact_str::format_compact!("{prefix}successful_targets"),
            ),
            (
                "CASE WHEN system_backup_policy_runs.completed IS NULL THEN system_backup_policy_run_progress.failed_targets ELSE system_backup_policy_runs.failed_targets END",
                compact_str::format_compact!("{prefix}failed_targets"),
            ),
            (
                "CASE WHEN system_backup_policy_runs.completed IS NULL THEN system_backup_policy_run_progress.skipped_targets ELSE system_backup_policy_runs.skipped_targets END",
                compact_str::format_compact!("{prefix}skipped_targets"),
            ),
            (
                "system_backup_policy_runs.cancelled",
                compact_str::format_compact!("{prefix}cancelled"),
            ),
            (
                "system_backup_policy_runs.completed",
                compact_str::format_compact!("{prefix}completed"),
            ),
            (
                "system_backup_policy_runs.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ])
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            uuid: row.try_get(compact_str::format_compact!("{prefix}uuid").as_str())?,
            system_backup_policy: SystemBackupPolicy::get_fetchable(row.try_get(
                compact_str::format_compact!("{prefix}system_backup_policy_uuid").as_str(),
            )?),
            manual: row.try_get(compact_str::format_compact!("{prefix}manual").as_str())?,
            occurrence: row.try_get(compact_str::format_compact!("{prefix}occurrence").as_str())?,
            total_targets: row
                .try_get(compact_str::format_compact!("{prefix}total_targets").as_str())?,
            pending_targets: row
                .try_get(compact_str::format_compact!("{prefix}pending_targets").as_str())?,
            running_targets: row
                .try_get(compact_str::format_compact!("{prefix}running_targets").as_str())?,
            successful_targets: row
                .try_get(compact_str::format_compact!("{prefix}successful_targets").as_str())?,
            failed_targets: row
                .try_get(compact_str::format_compact!("{prefix}failed_targets").as_str())?,
            skipped_targets: row
                .try_get(compact_str::format_compact!("{prefix}skipped_targets").as_str())?,
            cancelled: row.try_get(compact_str::format_compact!("{prefix}cancelled").as_str())?,
            completed: row.try_get(compact_str::format_compact!("{prefix}completed").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl SystemBackupPolicyRun {
    pub async fn by_system_backup_policy_uuid_with_pagination(
        database: &crate::database::Database,
        system_backup_policy_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        super::PaginatedQueryBuilder::new(
            Self::columns_sql(None),
            format!(
                r#"
                FROM system_backup_policy_runs
                {PROGRESS_JOIN}
                WHERE system_backup_policy_runs.system_backup_policy_uuid = $1
                "#
            ),
            "system_backup_policy_runs.created DESC, system_backup_policy_runs.uuid DESC",
        )
        .bind(system_backup_policy_uuid)
        .fetch(database, page, per_page)
        .await
    }

    pub async fn by_system_backup_policy_uuid_uuid(
        database: &crate::database::Database,
        system_backup_policy_uuid: uuid::Uuid,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM system_backup_policy_runs
            {PROGRESS_JOIN}
            WHERE
                system_backup_policy_runs.system_backup_policy_uuid = $1
                AND system_backup_policy_runs.uuid = $2
            "#,
            Self::columns_sql(None)
        )))
        .bind(system_backup_policy_uuid)
        .bind(uuid)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn all_latest(
        database: &crate::database::Database,
    ) -> Result<Vec<Self>, crate::database::DatabaseError> {
        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM (
                SELECT DISTINCT ON (system_backup_policy_runs.system_backup_policy_uuid)
                    system_backup_policy_runs.*
                FROM system_backup_policy_runs
                ORDER BY
                    system_backup_policy_runs.system_backup_policy_uuid,
                    system_backup_policy_runs.created DESC,
                    system_backup_policy_runs.uuid DESC
            ) AS system_backup_policy_runs
            {PROGRESS_JOIN}
            "#,
            Self::columns_sql(None)
        )))
        .fetch_all(database.read())
        .await?;

        rows.into_iter()
            .map(|row| Self::map(None, &row))
            .try_collect_vec()
    }

    pub async fn open_by_system_backup_policy_uuid(
        database: &crate::database::Database,
        system_backup_policy_uuid: uuid::Uuid,
    ) -> Result<Vec<Self>, crate::database::DatabaseError> {
        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM system_backup_policy_runs
            {PROGRESS_JOIN}
            WHERE
                system_backup_policy_runs.system_backup_policy_uuid = $1
                AND system_backup_policy_runs.completed IS NULL
            ORDER BY system_backup_policy_runs.created, system_backup_policy_runs.uuid
            "#,
            Self::columns_sql(None)
        )))
        .bind(system_backup_policy_uuid)
        .fetch_all(database.write())
        .await?;

        rows.into_iter()
            .map(|row| Self::map(None, &row))
            .try_collect_vec()
    }

    pub async fn has_pending_by_system_backup_policy_uuid(
        database: &crate::database::Database,
        system_backup_policy_uuid: uuid::Uuid,
    ) -> Result<bool, sqlx::Error> {
        let exists = sqlx::query_scalar!(
            r#"
            SELECT EXISTS (
                SELECT 1
                FROM system_backup_policy_run_targets
                JOIN system_backup_policy_runs ON system_backup_policy_runs.uuid = system_backup_policy_run_targets.system_backup_policy_run_uuid
                WHERE
                    system_backup_policy_runs.system_backup_policy_uuid = $1
                    AND system_backup_policy_runs.completed IS NULL
                    AND system_backup_policy_run_targets.status = 'PENDING'
            ) AS "exists!"
            "#,
            system_backup_policy_uuid,
        )
        .fetch_one(database.write())
        .await?;

        Ok(exists)
    }

    pub async fn create(
        database: &crate::database::Database,
        policy: &SystemBackupPolicy,
        manual: bool,
        occurrence: chrono::NaiveDateTime,
    ) -> Result<Option<uuid::Uuid>, sqlx::Error> {
        let mut transaction = database.write().begin().await?;

        let run_uuid = sqlx::query_scalar!(
            r#"
            INSERT INTO system_backup_policy_runs (system_backup_policy_uuid, manual, occurrence)
            SELECT $1, $2, $3
            WHERE $2 OR NOT EXISTS (
                SELECT 1
                FROM system_backup_policy_runs
                WHERE
                    system_backup_policy_runs.system_backup_policy_uuid = $1
                    AND NOT system_backup_policy_runs.manual
                    AND system_backup_policy_runs.occurrence >= $3
            )
            ON CONFLICT DO NOTHING
            RETURNING system_backup_policy_runs.uuid
            "#,
            policy.uuid,
            manual,
            occurrence,
        )
        .fetch_optional(&mut *transaction)
        .await?;

        let Some(run_uuid) = run_uuid else {
            return Ok(None);
        };

        sqlx::query!(
            r#"
            UPDATE system_backup_policy_run_targets
            SET
                status = 'SKIPPED',
                reason = COALESCE(system_backup_policy_run_targets.reason, 'SUPERSEDED'),
                updated = NOW()
            FROM system_backup_policy_runs
            WHERE
                system_backup_policy_runs.uuid = system_backup_policy_run_targets.system_backup_policy_run_uuid
                AND system_backup_policy_runs.system_backup_policy_uuid = $1
                AND system_backup_policy_runs.uuid != $2
                AND system_backup_policy_runs.completed IS NULL
                AND system_backup_policy_run_targets.status = 'PENDING'
            "#,
            policy.uuid,
            run_uuid,
        )
        .execute(&mut *transaction)
        .await?;

        let total_targets = match policy.kind {
            ServerBackupKind::Server => {
                sqlx::query!(
                    r#"
                    INSERT INTO system_backup_policy_run_targets (system_backup_policy_run_uuid, server_uuid, last_attempt)
                    SELECT $2, servers.uuid, attempts.last_attempt
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
                    LEFT JOIN LATERAL (
                        SELECT
                            MAX(server_backups.created) AS last_attempt,
                            BOOL_OR(
                                server_backups.completed IS NULL
                                AND server_backups.deleted IS NULL
                                AND server_backups.created >= NOW() - INTERVAL '1 day'
                            ) AS in_flight
                        FROM server_backups
                        WHERE
                            server_backups.system_backup_policy_uuid = $1
                            AND server_backups.server_uuid = servers.uuid
                    ) AS attempts ON TRUE
                    WHERE
                        coverage.attached IS NOT NULL
                        AND ($3 OR GREATEST(servers.created, coverage.attached) < $4)
                        AND (attempts.last_attempt IS NULL OR attempts.last_attempt < $4)
                        AND NOT COALESCE(attempts.in_flight, FALSE)
                    "#,
                    policy.uuid,
                    run_uuid,
                    manual,
                    occurrence,
                )
                .execute(&mut *transaction)
                .await?
                .rows_affected()
            }
            ServerBackupKind::DatabaseInstance => {
                sqlx::query!(
                    r#"
                    INSERT INTO system_backup_policy_run_targets (system_backup_policy_run_uuid, server_uuid, database_instance_uuid, last_attempt)
                    SELECT $2, server_database_instances.server_uuid, server_database_instances.uuid, attempts.last_attempt
                    FROM server_database_instances
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
                                AND system_backup_policy_servers.server_uuid = server_database_instances.server_uuid
                        ) AS scopes
                    ) AS coverage ON TRUE
                    LEFT JOIN LATERAL (
                        SELECT
                            MAX(server_backups.created) AS last_attempt,
                            BOOL_OR(
                                server_backups.completed IS NULL
                                AND server_backups.deleted IS NULL
                                AND server_backups.created >= NOW() - INTERVAL '1 day'
                            ) AS in_flight
                        FROM server_backups
                        WHERE
                            server_backups.system_backup_policy_uuid = $1
                            AND server_backups.database_instance_uuid = server_database_instances.uuid
                    ) AS attempts ON TRUE
                    WHERE
                        coverage.attached IS NOT NULL
                        AND ($3 OR GREATEST(server_database_instances.created, coverage.attached) < $4)
                        AND (attempts.last_attempt IS NULL OR attempts.last_attempt < $4)
                        AND NOT COALESCE(attempts.in_flight, FALSE)
                    "#,
                    policy.uuid,
                    run_uuid,
                    manual,
                    occurrence,
                )
                .execute(&mut *transaction)
                .await?
                .rows_affected()
            }
        };

        sqlx::query!(
            "UPDATE system_backup_policy_runs
            SET total_targets = $2
            WHERE system_backup_policy_runs.uuid = $1",
            run_uuid,
            total_targets as i32,
        )
        .execute(&mut *transaction)
        .await?;

        transaction.commit().await?;

        Ok(Some(run_uuid))
    }

    pub async fn skip_pending_scheduled_by_system_backup_policy_uuid(
        database: &crate::database::Database,
        system_backup_policy_uuid: uuid::Uuid,
        reason: SystemBackupPolicyRunTargetReason,
    ) -> Result<u64, sqlx::Error> {
        Ok(sqlx::query!(
            r#"
            UPDATE system_backup_policy_run_targets
            SET status = 'SKIPPED', reason = $2, updated = NOW()
            FROM system_backup_policy_runs
            WHERE
                system_backup_policy_runs.uuid = system_backup_policy_run_targets.system_backup_policy_run_uuid
                AND system_backup_policy_runs.system_backup_policy_uuid = $1
                AND NOT system_backup_policy_runs.manual
                AND system_backup_policy_runs.completed IS NULL
                AND system_backup_policy_run_targets.status = 'PENDING'
            "#,
            system_backup_policy_uuid,
            reason as SystemBackupPolicyRunTargetReason,
        )
        .execute(database.write())
        .await?
        .rows_affected())
    }

    pub async fn cancel(
        database: &crate::database::Database,
        system_backup_policy_uuid: uuid::Uuid,
        uuid: uuid::Uuid,
    ) -> Result<bool, sqlx::Error> {
        let row = sqlx::query!(
            r#"
            WITH cancelled_run AS (
                UPDATE system_backup_policy_runs
                SET cancelled = NOW()
                WHERE
                    system_backup_policy_runs.uuid = $2
                    AND system_backup_policy_runs.system_backup_policy_uuid = $1
                    AND system_backup_policy_runs.completed IS NULL
                    AND system_backup_policy_runs.cancelled IS NULL
                RETURNING system_backup_policy_runs.uuid
            ), skipped_targets AS (
                UPDATE system_backup_policy_run_targets
                SET status = 'SKIPPED', reason = 'CANCELLED', not_before = NULL, updated = NOW()
                FROM cancelled_run
                WHERE
                    system_backup_policy_run_targets.system_backup_policy_run_uuid = cancelled_run.uuid
                    AND system_backup_policy_run_targets.status = 'PENDING'
            )
            SELECT uuid FROM cancelled_run
            "#,
            system_backup_policy_uuid,
            uuid,
        )
        .fetch_optional(database.write())
        .await?;

        Ok(row.is_some())
    }

    pub async fn complete(&self, database: &crate::database::Database) -> Result<(), sqlx::Error> {
        sqlx::query!(
            "UPDATE system_backup_policy_runs
            SET
                completed = NOW(),
                successful_targets = $2,
                failed_targets = $3,
                skipped_targets = $4
            WHERE system_backup_policy_runs.uuid = $1 AND system_backup_policy_runs.completed IS NULL",
            self.uuid,
            self.successful_targets as i32,
            self.failed_targets as i32,
            self.skipped_targets as i32,
        )
        .execute(database.write())
        .await?;

        Ok(())
    }

    pub async fn prune(
        database: &crate::database::Database,
        keep_runs: i64,
        keep_targets: i64,
    ) -> Result<u64, sqlx::Error> {
        sqlx::query!(
            r#"
            DELETE FROM system_backup_policy_run_targets
            USING (
                SELECT
                    system_backup_policy_runs.uuid,
                    ROW_NUMBER() OVER (
                        PARTITION BY system_backup_policy_runs.system_backup_policy_uuid
                        ORDER BY system_backup_policy_runs.created DESC, system_backup_policy_runs.uuid DESC
                    ) AS position
                FROM system_backup_policy_runs
                WHERE system_backup_policy_runs.completed IS NOT NULL
            ) AS ranked
            WHERE
                ranked.uuid = system_backup_policy_run_targets.system_backup_policy_run_uuid
                AND ranked.position > $1
            "#,
            keep_targets,
        )
        .execute(database.write())
        .await?;

        Ok(sqlx::query!(
            r#"
            DELETE FROM system_backup_policy_runs
            USING (
                SELECT
                    system_backup_policy_runs.uuid,
                    ROW_NUMBER() OVER (
                        PARTITION BY system_backup_policy_runs.system_backup_policy_uuid
                        ORDER BY system_backup_policy_runs.created DESC, system_backup_policy_runs.uuid DESC
                    ) AS position
                FROM system_backup_policy_runs
                WHERE system_backup_policy_runs.completed IS NOT NULL
            ) AS ranked
            WHERE
                ranked.uuid = system_backup_policy_runs.uuid
                AND ranked.position > $1
            "#,
            keep_runs,
        )
        .execute(database.write())
        .await?
        .rows_affected())
    }
}

#[async_trait::async_trait]
impl IntoAdminApiObject for SystemBackupPolicyRun {
    type AdminApiObject = AdminApiSystemBackupPolicyRun;
    type ExtraArgs<'a> = ();

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiSystemBackupPolicyRun::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            AdminApiSystemBackupPolicyRun {
                uuid: self.uuid,
                manual: self.manual,
                occurrence: self.occurrence.and_utc(),
                total_targets: self.total_targets,
                pending_targets: self.pending_targets,
                running_targets: self.running_targets,
                successful_targets: self.successful_targets,
                failed_targets: self.failed_targets,
                skipped_targets: self.skipped_targets,
                cancelled: self.cancelled.map(|dt| dt.and_utc()),
                completed: self.completed.map(|dt| dt.and_utc()),
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[schema_extension_derive::extendible]
#[init_args(SystemBackupPolicyRun, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "SystemBackupPolicyRun")]
pub struct AdminApiSystemBackupPolicyRun {
    pub uuid: uuid::Uuid,

    pub manual: bool,
    pub occurrence: chrono::DateTime<chrono::Utc>,

    pub total_targets: i64,
    pub pending_targets: i64,
    pub running_targets: i64,
    pub successful_targets: i64,
    pub failed_targets: i64,
    pub skipped_targets: i64,

    pub cancelled: Option<chrono::DateTime<chrono::Utc>>,
    pub completed: Option<chrono::DateTime<chrono::Utc>>,
    pub created: chrono::DateTime<chrono::Utc>,
}
