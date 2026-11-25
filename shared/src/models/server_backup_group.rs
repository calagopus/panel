use crate::{
    models::{InsertQueryBuilder, UpdateQueryBuilder, server_backup::retention::BackupRetention},
    prelude::*,
};
use garde::Validate;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{
    collections::{BTreeMap, HashMap},
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, Clone)]
pub struct ServerBackupGroup {
    pub uuid: uuid::Uuid,
    pub server_uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub order: i16,
    pub retention: BackupRetention,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for ServerBackupGroup {
    const NAME: &'static str = "server_backup_group";

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
                "server_backup_groups.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "server_backup_groups.server_uuid",
                compact_str::format_compact!("{prefix}server_uuid"),
            ),
            (
                "server_backup_groups.name",
                compact_str::format_compact!("{prefix}name"),
            ),
            (
                "server_backup_groups.order_",
                compact_str::format_compact!("{prefix}order"),
            ),
            (
                "server_backup_groups.retention",
                compact_str::format_compact!("{prefix}retention"),
            ),
            (
                "server_backup_groups.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ])
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            uuid: row.try_get(compact_str::format_compact!("{prefix}uuid").as_str())?,
            server_uuid: row
                .try_get(compact_str::format_compact!("{prefix}server_uuid").as_str())?,
            name: row.try_get(compact_str::format_compact!("{prefix}name").as_str())?,
            order: row.try_get(compact_str::format_compact!("{prefix}order").as_str())?,
            retention: row
                .try_get::<sqlx::types::Json<_>, _>(
                    compact_str::format_compact!("{prefix}retention").as_str(),
                )?
                .0,
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

impl ServerBackupGroup {
    pub async fn by_server_uuid_uuid(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM server_backup_groups
            WHERE server_backup_groups.server_uuid = $1 AND server_backup_groups.uuid = $2
            "#,
            Self::columns_sql(None)
        )))
        .bind(server_uuid)
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
        super::PaginatedQueryBuilder::new(
            Self::columns_sql(None),
            format!(
                r#"
                FROM server_backup_groups
                WHERE server_backup_groups.server_uuid = $1 AND {search}
                "#,
                search = super::search_sql(
                    2,
                    &["server_backup_groups.name"],
                    &["server_backup_groups.uuid"]
                ),
            ),
            "server_backup_groups.order_, server_backup_groups.created, server_backup_groups.uuid",
        )
        .bind(server_uuid)
        .bind(search)
        .fetch(database, page, per_page)
        .await
    }

    pub async fn all_by_server_uuid(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
    ) -> Result<Vec<Self>, crate::database::DatabaseError> {
        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM server_backup_groups
            WHERE server_backup_groups.server_uuid = $1
            ORDER BY server_backup_groups.order_, server_backup_groups.created, server_backup_groups.uuid
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
            FROM server_backup_groups
            WHERE server_backup_groups.server_uuid = $1
            "#,
        )
        .bind(server_uuid)
        .fetch_one(database.read())
        .await
    }

    /// (total_backups, usable_backups, usable_unlocked_backups)
    async fn backup_counts(
        &self,
        database: &crate::database::Database,
    ) -> Result<(i64, i64, i64), crate::database::DatabaseError> {
        let row = sqlx::query!(
            r#"
            SELECT
                COUNT(*) AS "total!",
                COUNT(*) FILTER (
                    WHERE server_backups.successful AND server_backups.completed IS NOT NULL
                ) AS "usable!",
                COUNT(*) FILTER (
                    WHERE server_backups.successful
                        AND server_backups.completed IS NOT NULL
                        AND NOT server_backups.locked
                ) AS "usable_unlocked!"
            FROM server_backups
            WHERE server_backups.backup_group_uuid = $1 AND server_backups.deleted IS NULL
            "#,
            self.uuid,
        )
        .fetch_one(database.read())
        .await?;

        Ok((row.total, row.usable, row.usable_unlocked))
    }

    pub async fn backup_counts_by_server_uuid(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
    ) -> Result<HashMap<uuid::Uuid, (i64, i64, i64)>, crate::database::DatabaseError> {
        let rows = sqlx::query!(
            r#"
            SELECT
                server_backup_groups.uuid,
                COUNT(*) AS "total!",
                COUNT(*) FILTER (
                    WHERE server_backups.successful AND server_backups.completed IS NOT NULL
                ) AS "usable!",
                COUNT(*) FILTER (
                    WHERE server_backups.successful
                        AND server_backups.completed IS NOT NULL
                        AND NOT server_backups.locked
                ) AS "usable_unlocked!"
            FROM server_backups
            JOIN server_backup_groups ON server_backup_groups.uuid = server_backups.backup_group_uuid
            WHERE server_backup_groups.server_uuid = $1 AND server_backups.deleted IS NULL
            GROUP BY server_backup_groups.uuid
            "#,
            server_uuid,
        )
        .fetch_all(database.read())
        .await?;

        Ok(rows
            .into_iter()
            .map(|row| (row.uuid, (row.total, row.usable, row.usable_unlocked)))
            .collect())
    }
}

#[async_trait::async_trait]
impl IntoApiObject for ServerBackupGroup {
    type ApiObject = ApiServerBackupGroup;
    type ExtraArgs<'a> = Option<(i64, i64, i64)>;

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        backup_counts: Self::ExtraArgs<'a>,
    ) -> Result<Self::ApiObject, crate::database::DatabaseError> {
        let (total_backups, usable_backups, usable_unlocked_backups) = match backup_counts {
            Some(backup_counts) => backup_counts,
            None => self.backup_counts(&state.database).await?,
        };

        let api_object = ApiServerBackupGroup::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            ApiServerBackupGroup {
                uuid: self.uuid,
                name: self.name,
                order: self.order,
                retention: self.retention,
                total_backups,
                usable_backups,
                usable_unlocked_backups,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[derive(ToSchema, Deserialize, Validate)]
pub struct CreateServerBackupGroupOptions {
    #[garde(skip)]
    pub server_uuid: uuid::Uuid,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: compact_str::CompactString,
    #[garde(dive)]
    #[serde(default)]
    pub retention: BackupRetention,
}

#[async_trait::async_trait]
impl CreatableModel for ServerBackupGroup {
    type CreateOptions<'a> = CreateServerBackupGroupOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<ServerBackupGroup>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create_with_transaction(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        let mut query_builder = InsertQueryBuilder::new("server_backup_groups");

        Self::run_create_handlers(&mut options, &mut query_builder, state, transaction).await?;

        query_builder
            .set("server_uuid", options.server_uuid)
            .set("name", &options.name)
            .set("retention", serde_json::to_value(&options.retention)?);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut **transaction)
            .await?;
        let mut group = Self::map(None, &row)?;

        Self::run_after_create_handlers(&mut group, &options, state, transaction).await?;

        Ok(group)
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Default)]
pub struct UpdateServerBackupGroupOptions {
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: Option<compact_str::CompactString>,
    #[garde(dive)]
    #[schema(nullable = false)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        deserialize_with = "crate::deserialize::deserialize_non_null_option"
    )]
    pub retention: Option<BackupRetention>,
}

#[async_trait::async_trait]
impl UpdatableModel for ServerBackupGroup {
    type UpdateOptions = UpdateServerBackupGroupOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateHandlerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateHandlerList<ServerBackupGroup>> =
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

        let mut query_builder = UpdateQueryBuilder::new("server_backup_groups");

        self.run_update_handlers(&mut options, &mut query_builder, state, transaction)
            .await?;

        query_builder
            .set("name", options.name.as_ref())
            .set(
                "retention",
                options
                    .retention
                    .as_ref()
                    .map(serde_json::to_value)
                    .transpose()?,
            )
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut **transaction).await?;

        if let Some(name) = options.name {
            self.name = name;
        }
        if let Some(retention) = options.retention {
            self.retention = retention;
        }

        self.run_after_update_handlers(state, transaction).await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl ByUuid for ServerBackupGroup {
    async fn by_uuid(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
    ) -> Result<Self, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM server_backup_groups
            WHERE server_backup_groups.uuid = $1
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
            FROM server_backup_groups
            WHERE server_backup_groups.uuid = $1
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
pub struct DeleteServerBackupGroupOptions {
    pub lock_backups: bool,
}

#[async_trait::async_trait]
impl DeletableModel for ServerBackupGroup {
    type DeleteOptions = DeleteServerBackupGroupOptions;

    fn get_delete_handlers() -> &'static LazyLock<DeleteHandlerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteHandlerList<ServerBackupGroup>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &DELETE_LISTENERS
    }

    async fn delete_with_transaction(
        &self,
        state: &crate::State,
        options: Self::DeleteOptions,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<(), anyhow::Error> {
        sqlx::query(
            r#"
            SELECT server_backup_groups.uuid
            FROM server_backup_groups
            WHERE server_backup_groups.uuid = $1
            FOR UPDATE
            "#,
        )
        .bind(self.uuid)
        .fetch_optional(&mut **transaction)
        .await?;

        self.run_delete_handlers(&options, state, transaction)
            .await?;

        if options.lock_backups {
            sqlx::query!(
                "UPDATE server_backups
                SET locked = true
                WHERE server_backups.backup_group_uuid = $1 AND server_backups.deleted IS NULL",
                self.uuid,
            )
            .execute(&mut **transaction)
            .await?;
        }

        sqlx::query!(
            "DELETE FROM server_backup_groups
            WHERE server_backup_groups.uuid = $1",
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
#[init_args(ServerBackupGroup, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "ServerBackupGroup")]
pub struct ApiServerBackupGroup {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub order: i16,
    pub retention: BackupRetention,

    pub total_backups: i64,
    pub usable_backups: i64,
    pub usable_unlocked_backups: i64,

    pub created: chrono::DateTime<chrono::Utc>,
}
