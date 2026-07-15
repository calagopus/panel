use crate::{
    models::{InsertQueryBuilder, UpdateQueryBuilder},
    prelude::*,
};
use garde::Validate;
use rand::distr::SampleString;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{
    collections::BTreeMap,
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

#[inline]
fn default_true() -> bool {
    true
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Clone)]
pub struct DatabaseAgentHostTypeSettings {
    #[garde(skip)]
    #[serde(default = "default_true")]
    pub enabled: bool,

    #[garde(length(chars, min = 3, max = 255), inner(custom(crate::utils::validate_host)))]
    #[schema(min_length = 3, max_length = 255)]
    #[serde(default)]
    pub public_host: Option<compact_str::CompactString>,
    #[garde(range(min = 1))]
    #[schema(minimum = 1)]
    #[serde(default)]
    pub public_port: Option<u16>,
}

impl Default for DatabaseAgentHostTypeSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            public_host: None,
            public_port: None,
        }
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Clone, Default)]
pub struct DatabaseAgentHostTypes {
    #[garde(dive)]
    #[serde(default)]
    pub postgres: DatabaseAgentHostTypeSettings,
    #[garde(dive)]
    #[serde(default)]
    pub mariadb: DatabaseAgentHostTypeSettings,
    #[garde(dive)]
    #[serde(default)]
    pub mongodb: DatabaseAgentHostTypeSettings,
    #[garde(dive)]
    #[serde(default)]
    pub redis: DatabaseAgentHostTypeSettings,
}

impl DatabaseAgentHostTypes {
    #[inline]
    pub fn get(&self, r#type: db_agent_api::DatabaseAgentType) -> &DatabaseAgentHostTypeSettings {
        match r#type {
            db_agent_api::DatabaseAgentType::Postgres => &self.postgres,
            db_agent_api::DatabaseAgentType::Mariadb => &self.mariadb,
            db_agent_api::DatabaseAgentType::Mongodb => &self.mongodb,
            db_agent_api::DatabaseAgentType::Redis => &self.redis,
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DatabaseAgentHost {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,

    pub deployment_enabled: bool,
    pub maintenance_enabled: bool,

    pub url: reqwest::Url,

    pub memory: i64,
    pub disk: i64,

    pub types: DatabaseAgentHostTypes,

    pub token: Vec<u8>,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for DatabaseAgentHost {
    const NAME: &'static str = "database_agent_host";

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
                "database_agent_hosts.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "database_agent_hosts.name",
                compact_str::format_compact!("{prefix}name"),
            ),
            (
                "database_agent_hosts.description",
                compact_str::format_compact!("{prefix}description"),
            ),
            (
                "database_agent_hosts.deployment_enabled",
                compact_str::format_compact!("{prefix}deployment_enabled"),
            ),
            (
                "database_agent_hosts.maintenance_enabled",
                compact_str::format_compact!("{prefix}maintenance_enabled"),
            ),
            (
                "database_agent_hosts.url",
                compact_str::format_compact!("{prefix}url"),
            ),
            (
                "database_agent_hosts.memory",
                compact_str::format_compact!("{prefix}memory"),
            ),
            (
                "database_agent_hosts.disk",
                compact_str::format_compact!("{prefix}disk"),
            ),
            (
                "database_agent_hosts.types",
                compact_str::format_compact!("{prefix}types"),
            ),
            (
                "database_agent_hosts.token",
                compact_str::format_compact!("{prefix}token"),
            ),
            (
                "database_agent_hosts.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ])
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            uuid: row.try_get(compact_str::format_compact!("{prefix}uuid").as_str())?,
            name: row.try_get(compact_str::format_compact!("{prefix}name").as_str())?,
            description: row
                .try_get(compact_str::format_compact!("{prefix}description").as_str())?,
            deployment_enabled: row
                .try_get(compact_str::format_compact!("{prefix}deployment_enabled").as_str())?,
            maintenance_enabled: row
                .try_get(compact_str::format_compact!("{prefix}maintenance_enabled").as_str())?,
            url: row
                .try_get::<String, _>(compact_str::format_compact!("{prefix}url").as_str())?
                .parse()
                .map_err(anyhow::Error::new)?,
            memory: row.try_get(compact_str::format_compact!("{prefix}memory").as_str())?,
            disk: row.try_get(compact_str::format_compact!("{prefix}disk").as_str())?,
            types: serde_json::from_value(
                row.try_get(compact_str::format_compact!("{prefix}types").as_str())?,
            )?,
            token: row.try_get(compact_str::format_compact!("{prefix}token").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl DatabaseAgentHost {
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
            FROM database_agent_hosts
            WHERE ($1 IS NULL OR database_agent_hosts.name ILIKE '%' || $1 || '%')
            ORDER BY database_agent_hosts.created
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

    pub async fn by_location_uuid_most_eligible(
        database: &crate::database::Database,
        location_uuid: uuid::Uuid,
        r#type: db_agent_api::DatabaseAgentType,
        memory: i64,
        disk: i64,
    ) -> Result<Vec<Self>, crate::database::DatabaseError> {
        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            WITH database_usage AS (
                SELECT
                    database_agent_host_uuid,
                    COALESCE(SUM(memory), 0)::BIGINT AS used_memory,
                    COALESCE(SUM(disk), 0)::BIGINT AS used_disk
                FROM server_database_instances
                GROUP BY database_agent_host_uuid
            )
            SELECT {}
            FROM database_agent_hosts
            JOIN location_database_agent_hosts ON location_database_agent_hosts.database_agent_host_uuid = database_agent_hosts.uuid AND location_database_agent_hosts.location_uuid = $1
            LEFT JOIN database_usage u ON database_agent_hosts.uuid = u.database_agent_host_uuid
            WHERE database_agent_hosts.deployment_enabled
            AND NOT database_agent_hosts.maintenance_enabled
            AND COALESCE((database_agent_hosts.types -> $2 ->> 'enabled')::BOOL, TRUE)
            AND COALESCE(u.used_memory, 0) + $3 <= database_agent_hosts.memory
            AND COALESCE(u.used_disk, 0) + $4 <= database_agent_hosts.disk
            ORDER BY
                GREATEST(
                    (COALESCE(u.used_memory, 0) + $3)::FLOAT / NULLIF(database_agent_hosts.memory, 0),
                    (COALESCE(u.used_disk, 0) + $4)::FLOAT / NULLIF(database_agent_hosts.disk, 0)
                )
            "#,
            Self::columns_sql(None)
        )))
        .bind(location_uuid)
        .bind(r#type.as_str())
        .bind(memory)
        .bind(disk)
        .fetch_all(database.read())
        .await?;

        rows.into_iter()
            .map(|row| Self::map(None, &row))
            .try_collect_vec()
    }

    pub async fn by_location_uuid_uuid(
        database: &crate::database::Database,
        location_uuid: uuid::Uuid,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM database_agent_hosts
            JOIN location_database_agent_hosts ON location_database_agent_hosts.database_agent_host_uuid = database_agent_hosts.uuid AND location_database_agent_hosts.location_uuid = $1
            WHERE database_agent_hosts.uuid = $2
            "#,
            Self::columns_sql(None)
        )))
        .bind(location_uuid)
        .bind(uuid)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    #[inline]
    pub fn generate_token() -> String {
        rand::distr::Alphanumeric.sample_string(&mut rand::rng(), 64)
    }

    pub async fn reset_token(&self, state: &crate::State) -> Result<String, anyhow::Error> {
        let token = Self::generate_token();

        sqlx::query(
            r#"
            UPDATE database_agent_hosts
            SET token = $2
            WHERE database_agent_hosts.uuid = $1
            "#,
        )
        .bind(self.uuid)
        .bind(state.database.encrypt(token.clone()).await?)
        .execute(state.database.write())
        .await?;

        Ok(token)
    }

    #[inline]
    pub async fn api_client(
        &self,
        database: &crate::database::Database,
    ) -> Result<db_agent_api::client::DbAgentClient, anyhow::Error> {
        Ok(db_agent_api::client::DbAgentClient::new(
            self.url.to_string(),
            database.decrypt(self.token.to_vec()).await?.into(),
        ))
    }

    /// Fetch the current configuration of this database agent host
    ///
    /// Cached for 120 seconds.
    pub async fn fetch_configuration(
        &self,
        database: &crate::database::Database,
    ) -> Result<db_agent_api::system_config::get::Response, anyhow::Error> {
        database
            .cache
            .cached(
                &format!("database_agent_host::{}::configuration", self.uuid),
                120,
                || async {
                    Ok::<_, anyhow::Error>(
                        self.api_client(database).await?.get_system_config().await?,
                    )
                },
            )
            .await
    }

    /// Fetch the current resource usages of all databases on this host.
    ///
    /// Cached for 15 seconds.
    pub async fn fetch_database_resources(
        &self,
        database: &crate::database::Database,
    ) -> Result<std::collections::HashMap<uuid::Uuid, db_agent_api::ResourceUsage>, anyhow::Error>
    {
        database
            .cache
            .cached(
                &format!("database_agent_host::{}::database_resources", self.uuid),
                15,
                || async {
                    let resources = self
                        .api_client(database)
                        .await?
                        .get_instances_utilization()
                        .await?;

                    Ok::<_, anyhow::Error>(resources.into_iter().collect())
                },
            )
            .await
    }

    /// Update the configuration of this database agent host
    ///
    /// Invalidates the cached configuration.
    pub async fn update_configuration(
        &self,
        database: &crate::database::Database,
        config_patch: &serde_json::Value,
    ) -> Result<bool, anyhow::Error> {
        let response = self
            .api_client(database)
            .await?
            .patch_system_config(config_patch)
            .await?;
        if !response.applied {
            return Ok(false);
        }

        database
            .cache
            .invalidate(&format!(
                "database_agent_host::{}::configuration",
                self.uuid
            ))
            .await?;

        Ok(true)
    }
}

#[async_trait::async_trait]
impl IntoAdminApiObject for DatabaseAgentHost {
    type AdminApiObject = AdminApiDatabaseAgentHost;
    type ExtraArgs<'a> = ();

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiDatabaseAgentHost::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            AdminApiDatabaseAgentHost {
                uuid: self.uuid,
                name: self.name,
                description: self.description,
                deployment_enabled: self.deployment_enabled,
                maintenance_enabled: self.maintenance_enabled,
                url: self.url.to_string(),
                memory: self.memory,
                disk: self.disk,
                types: self.types,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[async_trait::async_trait]
impl ByUuid for DatabaseAgentHost {
    async fn by_uuid(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
    ) -> Result<Self, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM database_agent_hosts
            WHERE database_agent_hosts.uuid = $1
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
            FROM database_agent_hosts
            WHERE database_agent_hosts.uuid = $1
            "#,
            Self::columns_sql(None)
        )))
        .bind(uuid)
        .fetch_one(&mut **transaction)
        .await?;

        Self::map(None, &row)
    }
}

#[derive(ToSchema, Deserialize, Validate)]
pub struct CreateDatabaseAgentHostOptions {
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: compact_str::CompactString,
    #[garde(length(chars, min = 1, max = 1024))]
    #[schema(min_length = 1, max_length = 1024)]
    pub description: Option<compact_str::CompactString>,

    #[garde(skip)]
    pub deployment_enabled: bool,
    #[garde(skip)]
    pub maintenance_enabled: bool,

    #[garde(length(chars, min = 3, max = 255), url)]
    #[schema(min_length = 3, max_length = 255, format = "uri")]
    pub url: compact_str::CompactString,

    #[garde(range(min = 1))]
    #[schema(minimum = 1)]
    pub memory: i64,
    #[garde(range(min = 1))]
    #[schema(minimum = 1)]
    pub disk: i64,

    #[garde(dive)]
    #[serde(default)]
    pub types: DatabaseAgentHostTypes,
}

#[async_trait::async_trait]
impl CreatableModel for DatabaseAgentHost {
    type CreateOptions<'a> = CreateDatabaseAgentHostOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<DatabaseAgentHost>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create_with_transaction(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        let mut query_builder = InsertQueryBuilder::new("database_agent_hosts");

        Self::run_create_handlers(&mut options, &mut query_builder, state, transaction).await?;

        let token = Self::generate_token();

        query_builder
            .set("name", &options.name)
            .set("description", &options.description)
            .set("deployment_enabled", options.deployment_enabled)
            .set("maintenance_enabled", options.maintenance_enabled)
            .set("url", &options.url)
            .set("memory", options.memory)
            .set("disk", options.disk)
            .set("types", serde_json::to_value(&options.types)?)
            .set("token", state.database.encrypt(token.clone()).await?);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut **transaction)
            .await?;
        let mut database_agent_host = Self::map(None, &row)?;

        Self::run_after_create_handlers(&mut database_agent_host, &options, state, transaction)
            .await?;

        Ok(database_agent_host)
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Clone, Default)]
pub struct UpdateDatabaseAgentHostOptions {
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
    pub deployment_enabled: Option<bool>,
    #[garde(skip)]
    pub maintenance_enabled: Option<bool>,

    #[garde(length(chars, min = 3, max = 255), url)]
    #[schema(min_length = 3, max_length = 255, format = "uri")]
    pub url: Option<compact_str::CompactString>,

    #[garde(range(min = 1))]
    #[schema(minimum = 1)]
    pub memory: Option<i64>,
    #[garde(range(min = 1))]
    #[schema(minimum = 1)]
    pub disk: Option<i64>,

    #[garde(dive)]
    pub types: Option<DatabaseAgentHostTypes>,
}

#[async_trait::async_trait]
impl UpdatableModel for DatabaseAgentHost {
    type UpdateOptions = UpdateDatabaseAgentHostOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateHandlerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateHandlerList<DatabaseAgentHost>> =
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

        let mut query_builder = UpdateQueryBuilder::new("database_agent_hosts");

        self.run_update_handlers(&mut options, &mut query_builder, state, transaction)
            .await?;

        query_builder
            .set("name", options.name.as_ref())
            .set(
                "description",
                options.description.as_ref().map(|d| d.as_ref()),
            )
            .set("deployment_enabled", options.deployment_enabled)
            .set("maintenance_enabled", options.maintenance_enabled)
            .set("url", options.url.as_ref())
            .set("memory", options.memory)
            .set("disk", options.disk)
            .set(
                "types",
                options
                    .types
                    .as_ref()
                    .map(serde_json::to_value)
                    .transpose()?,
            )
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut **transaction).await?;

        if let Some(name) = options.name {
            self.name = name;
        }
        if let Some(description) = options.description {
            self.description = description;
        }
        if let Some(deployment_enabled) = options.deployment_enabled {
            self.deployment_enabled = deployment_enabled;
        }
        if let Some(maintenance_enabled) = options.maintenance_enabled {
            self.maintenance_enabled = maintenance_enabled;
        }
        if let Some(url) = options.url {
            self.url = url.parse().map_err(anyhow::Error::new)?;
        }
        if let Some(memory) = options.memory {
            self.memory = memory;
        }
        if let Some(disk) = options.disk {
            self.disk = disk;
        }
        if let Some(types) = options.types {
            self.types = types;
        }

        self.run_after_update_handlers(state, transaction).await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl DeletableModel for DatabaseAgentHost {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteHandlerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteHandlerList<DatabaseAgentHost>> =
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

        sqlx::query(
            r#"
            DELETE FROM database_agent_hosts
            WHERE database_agent_hosts.uuid = $1
            "#,
        )
        .bind(self.uuid)
        .execute(&mut **transaction)
        .await?;

        self.run_after_delete_handlers(&options, state, transaction)
            .await?;

        Ok(())
    }
}

#[schema_extension_derive::extendible]
#[init_args(DatabaseAgentHost, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "DatabaseAgentHost")]
pub struct AdminApiDatabaseAgentHost {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,

    pub deployment_enabled: bool,
    pub maintenance_enabled: bool,

    #[schema(format = "uri")]
    pub url: String,

    pub memory: i64,
    pub disk: i64,

    pub types: DatabaseAgentHostTypes,

    pub created: chrono::DateTime<chrono::Utc>,
}
