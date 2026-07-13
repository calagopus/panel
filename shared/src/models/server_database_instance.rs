use crate::{
    models::{InsertQueryBuilder, UpdateQueryBuilder},
    prelude::*,
};
use garde::Validate;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{
    collections::BTreeMap,
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, Clone)]
pub struct ServerDatabaseInstance {
    pub uuid: uuid::Uuid,
    pub server: Fetchable<super::server::Server>,
    pub database_agent_host: super::database_agent_host::DatabaseAgentHost,
    pub database_agent_template:
        Option<Fetchable<super::database_agent_template::DatabaseAgentTemplate>>,

    pub r#type: db_agent_api::DatabaseAgentType,

    pub name: compact_str::CompactString,
    pub locked: bool,

    pub memory: i64,
    pub swap: i64,
    pub disk: i64,
    pub io_weight: Option<i16>,
    pub cpu: i32,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for ServerDatabaseInstance {
    const NAME: &'static str = "server_database_agent";

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
            (
                "server_database_instances.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "server_database_instances.server_uuid",
                compact_str::format_compact!("{prefix}server_uuid"),
            ),
            (
                "server_database_instances.database_agent_template_uuid",
                compact_str::format_compact!("{prefix}database_agent_template_uuid"),
            ),
            (
                "server_database_instances.type",
                compact_str::format_compact!("{prefix}type"),
            ),
            (
                "server_database_instances.name",
                compact_str::format_compact!("{prefix}name"),
            ),
            (
                "server_database_instances.locked",
                compact_str::format_compact!("{prefix}locked"),
            ),
            (
                "server_database_instances.memory",
                compact_str::format_compact!("{prefix}memory"),
            ),
            (
                "server_database_instances.swap",
                compact_str::format_compact!("{prefix}swap"),
            ),
            (
                "server_database_instances.disk",
                compact_str::format_compact!("{prefix}disk"),
            ),
            (
                "server_database_instances.io_weight",
                compact_str::format_compact!("{prefix}io_weight"),
            ),
            (
                "server_database_instances.cpu",
                compact_str::format_compact!("{prefix}cpu"),
            ),
            (
                "server_database_instances.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ]);

        columns.extend(super::database_agent_host::DatabaseAgentHost::base_columns(
            Some("database_agent_host_"),
        ));

        columns
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            uuid: row.try_get(compact_str::format_compact!("{prefix}uuid").as_str())?,
            server: super::server::Server::get_fetchable(
                row.try_get(compact_str::format_compact!("{prefix}server_uuid").as_str())?,
            ),
            database_agent_host: super::database_agent_host::DatabaseAgentHost::map(
                Some("database_agent_host_"),
                row,
            )?,
            database_agent_template: row
                .try_get::<Option<uuid::Uuid>, _>(
                    compact_str::format_compact!("{prefix}database_agent_template_uuid").as_str(),
                )?
                .map(super::database_agent_template::DatabaseAgentTemplate::get_fetchable),
            r#type: row.try_get(compact_str::format_compact!("{prefix}type").as_str())?,
            name: row.try_get(compact_str::format_compact!("{prefix}name").as_str())?,
            locked: row.try_get(compact_str::format_compact!("{prefix}locked").as_str())?,
            memory: row.try_get(compact_str::format_compact!("{prefix}memory").as_str())?,
            swap: row.try_get(compact_str::format_compact!("{prefix}swap").as_str())?,
            disk: row.try_get(compact_str::format_compact!("{prefix}disk").as_str())?,
            io_weight: row.try_get(compact_str::format_compact!("{prefix}io_weight").as_str())?,
            cpu: row.try_get(compact_str::format_compact!("{prefix}cpu").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl ServerDatabaseInstance {
    pub async fn by_server_uuid_uuid(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM server_database_instances
            JOIN database_agent_hosts ON database_agent_hosts.uuid = server_database_instances.database_agent_host_uuid
            WHERE server_database_instances.server_uuid = $1 AND server_database_instances.uuid = $2
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
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM server_database_instances
            JOIN database_agent_hosts ON database_agent_hosts.uuid = server_database_instances.database_agent_host_uuid
            WHERE server_database_instances.server_uuid = $1 AND ($2 IS NULL OR server_database_instances.name ILIKE '%' || $2 || '%')
            ORDER BY server_database_instances.created
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

    pub async fn by_database_agent_host_uuid_with_pagination(
        database: &crate::database::Database,
        database_agent_host_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM server_database_instances
            JOIN database_agent_hosts ON database_agent_hosts.uuid = server_database_instances.database_agent_host_uuid
            WHERE server_database_instances.database_agent_host_uuid = $1 AND ($2 IS NULL OR server_database_instances.name ILIKE '%' || $2 || '%')
            ORDER BY server_database_instances.created
            LIMIT $3 OFFSET $4
            "#,
            Self::columns_sql(None)
        )))
        .bind(database_agent_host_uuid)
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

    pub async fn by_database_agent_template_uuid_with_pagination(
        database: &crate::database::Database,
        database_agent_template_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM server_database_instances
            JOIN database_agent_hosts ON database_agent_hosts.uuid = server_database_instances.database_agent_host_uuid
            WHERE server_database_instances.database_agent_template_uuid = $1 AND ($2 IS NULL OR server_database_instances.name ILIKE '%' || $2 || '%')
            ORDER BY server_database_instances.created
            LIMIT $3 OFFSET $4
            "#,
            Self::columns_sql(None)
        )))
        .bind(database_agent_template_uuid)
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

    pub async fn all_by_server_uuid(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
    ) -> Result<Vec<Self>, crate::database::DatabaseError> {
        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM server_database_instances
            JOIN database_agent_hosts ON database_agent_hosts.uuid = server_database_instances.database_agent_host_uuid
            WHERE server_database_instances.server_uuid = $1
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

    pub async fn all_by_database_agent_host_uuid(
        database: &crate::database::Database,
        database_agent_host_uuid: uuid::Uuid,
    ) -> Result<Vec<Self>, crate::database::DatabaseError> {
        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM server_database_instances
            JOIN database_agent_hosts ON database_agent_hosts.uuid = server_database_instances.database_agent_host_uuid
            WHERE server_database_instances.database_agent_host_uuid = $1
            "#,
            Self::columns_sql(None)
        )))
        .bind(database_agent_host_uuid)
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
            FROM server_database_instances
            WHERE server_database_instances.server_uuid = $1
            "#,
        )
        .bind(server_uuid)
        .fetch_one(database.read())
        .await
    }

    pub async fn count_by_database_agent_host_uuid(
        database: &crate::database::Database,
        database_agent_host_uuid: uuid::Uuid,
    ) -> Result<i64, sqlx::Error> {
        sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM server_database_instances
            WHERE server_database_instances.database_agent_host_uuid = $1
            "#,
        )
        .bind(database_agent_host_uuid)
        .fetch_one(database.read())
        .await
    }
}

#[async_trait::async_trait]
impl IntoAdminApiObject for ServerDatabaseInstance {
    type AdminApiObject = AdminApiServerDatabaseInstance;
    type ExtraArgs<'a> = &'a crate::storage::StorageUrlRetriever<'a>;

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        storage_url_retriever: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiServerDatabaseInstance::init_hooks(&self, state).await?;

        let type_settings = self.database_agent_host.types.get(self.r#type);

        let api_object = finish_extendible!(
            AdminApiServerDatabaseInstance {
                uuid: self.uuid,
                server: self
                    .server
                    .fetch_cached(&state.database)
                    .await?
                    .into_admin_api_object(state, storage_url_retriever)
                    .await?,
                database_agent_template: match &self.database_agent_template {
                    Some(template) => Some(
                        template
                            .fetch_cached(&state.database)
                            .await?
                            .into_admin_api_object(state, ())
                            .await?,
                    ),
                    None => None,
                },
                r#type: self.r#type,
                host: type_settings.public_host.clone().or_else(|| self
                    .database_agent_host
                    .url
                    .host_str()
                    .map(compact_str::CompactString::from)),
                port: Some(
                    type_settings
                        .public_port
                        .map_or_else(|| i32::from(self.r#type.default_port()), i32::from),
                ),
                name: self.name,
                is_locked: self.locked,
                memory: self.memory,
                swap: self.swap,
                disk: self.disk,
                io_weight: self.io_weight,
                cpu: self.cpu,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[async_trait::async_trait]
impl IntoApiObject for ServerDatabaseInstance {
    type ApiObject = ApiServerDatabaseInstance;
    type ExtraArgs<'a> = ();

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::ApiObject, crate::database::DatabaseError> {
        let api_object = ApiServerDatabaseInstance::init_hooks(&self, state).await?;

        let type_settings = self.database_agent_host.types.get(self.r#type);

        let api_object = finish_extendible!(
            ApiServerDatabaseInstance {
                uuid: self.uuid,
                r#type: self.r#type,
                host: type_settings.public_host.clone().or_else(|| self
                    .database_agent_host
                    .url
                    .host_str()
                    .map(compact_str::CompactString::from)),
                port: Some(
                    type_settings
                        .public_port
                        .map_or_else(|| i32::from(self.r#type.default_port()), i32::from),
                ),
                name: self.name,
                is_locked: self.locked,
                memory: self.memory,
                swap: self.swap,
                disk: self.disk,
                io_weight: self.io_weight,
                cpu: self.cpu,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[async_trait::async_trait]
impl ByUuid for ServerDatabaseInstance {
    async fn by_uuid(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
    ) -> Result<Self, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM server_database_instances
            JOIN database_agent_hosts ON database_agent_hosts.uuid = server_database_instances.database_agent_host_uuid
            WHERE server_database_instances.uuid = $1
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
            FROM server_database_instances
            JOIN database_agent_hosts ON database_agent_hosts.uuid = server_database_instances.database_agent_host_uuid
            WHERE server_database_instances.uuid = $1
            "#,
            Self::columns_sql(None)
        )))
        .bind(uuid)
        .fetch_one(&mut **transaction)
        .await?;

        Self::map(None, &row)
    }
}

#[derive(Validate)]
pub struct CreateServerDatabaseInstanceOptions<'a> {
    #[garde(skip)]
    pub uuid: uuid::Uuid,
    #[garde(skip)]
    pub server: &'a super::server::Server,
    #[garde(skip)]
    pub database_agent_host: &'a super::database_agent_host::DatabaseAgentHost,
    #[garde(skip)]
    pub database_agent_template: &'a super::database_agent_template::DatabaseAgentTemplate,

    #[garde(length(chars, min = 1, max = 31))]
    pub name: compact_str::CompactString,
}

#[async_trait::async_trait]
impl CreatableModel for ServerDatabaseInstance {
    type CreateOptions<'a> = CreateServerDatabaseInstanceOptions<'a>;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<ServerDatabaseInstance>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create_with_transaction(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        let mut query_builder = InsertQueryBuilder::new("server_database_instances");

        Self::run_create_handlers(&mut options, &mut query_builder, state, transaction).await?;

        query_builder
            .set("uuid", options.uuid)
            .set("server_uuid", options.server.uuid)
            .set("database_agent_host_uuid", options.database_agent_host.uuid)
            .set(
                "database_agent_template_uuid",
                options.database_agent_template.uuid,
            )
            .set("type", options.database_agent_template.r#type)
            .set("name", &options.name)
            .set("memory", options.database_agent_template.memory)
            .set("swap", options.database_agent_template.swap)
            .set("disk", options.database_agent_template.disk)
            .set("io_weight", options.database_agent_template.io_weight)
            .set("cpu", options.database_agent_template.cpu);

        let row = query_builder
            .returning("uuid")
            .fetch_one(&mut **transaction)
            .await?;
        let uuid: uuid::Uuid = row.try_get("uuid")?;

        let mut result = Self::by_uuid_with_transaction(transaction, uuid).await?;

        Self::run_after_create_handlers(&mut result, &options, state, transaction).await?;

        Ok(result)
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Default)]
pub struct UpdateServerDatabaseInstanceOptions {
    #[garde(length(chars, min = 1, max = 31))]
    #[schema(min_length = 1, max_length = 31)]
    pub name: Option<compact_str::CompactString>,
    #[garde(skip)]
    pub locked: Option<bool>,
}

#[async_trait::async_trait]
impl UpdatableModel for ServerDatabaseInstance {
    type UpdateOptions = UpdateServerDatabaseInstanceOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateHandlerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateHandlerList<ServerDatabaseInstance>> =
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

        let mut query_builder = UpdateQueryBuilder::new("server_database_instances");

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

#[derive(Clone, Default)]
pub struct DeleteServerDatabaseInstanceOptions {
    pub force: bool,
}

#[async_trait::async_trait]
impl DeletableModel for ServerDatabaseInstance {
    type DeleteOptions = DeleteServerDatabaseInstanceOptions;

    fn get_delete_handlers() -> &'static LazyLock<DeleteHandlerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteHandlerList<ServerDatabaseInstance>> =
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
            DELETE FROM server_database_instances
            WHERE server_database_instances.uuid = $1
            "#,
        )
        .bind(self.uuid)
        .execute(&mut **transaction)
        .await?;

        self.run_after_delete_handlers(&options, state, transaction)
            .await?;

        Ok(())
    }

    async fn delete(
        &self,
        state: &crate::State,
        options: Self::DeleteOptions,
    ) -> Result<(), anyhow::Error> {
        let run_delete = async {
            self.database_agent_host
                .api_client(&state.database)
                .await?
                .delete_instances_instance(self.uuid)
                .await?;

            Ok::<_, anyhow::Error>(())
        };

        if let Err(err) = run_delete.await
            && !options.force
        {
            return Err(err);
        }

        let mut transaction = state.database.write().begin().await?;
        self.delete_with_transaction(state, options, &mut transaction)
            .await?;
        transaction.commit().await?;

        Ok(())
    }
}

#[derive(ToSchema, Serialize)]
#[schema(title = "ServerDatabaseInstanceDatabase")]
pub struct ApiServerDatabaseInstanceDatabase {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub created: chrono::DateTime<chrono::Local>,
}

impl From<db_agent_api::StoredDatabase> for ApiServerDatabaseInstanceDatabase {
    fn from(database: db_agent_api::StoredDatabase) -> Self {
        Self {
            uuid: database.uuid,
            name: database.name,
            created: database.created,
        }
    }
}

#[derive(ToSchema, Serialize)]
#[schema(title = "ServerDatabaseInstanceUser")]
pub struct ApiServerDatabaseInstanceUser {
    pub uuid: uuid::Uuid,

    pub username: compact_str::CompactString,
    pub password: compact_str::CompactString,
    pub database_uuid: Option<uuid::Uuid>,
}

impl From<db_agent_api::StoredUser> for ApiServerDatabaseInstanceUser {
    /// Composes the connectable username the same way the agent does (`u{short:08x}_{label}`).
    fn from(user: db_agent_api::StoredUser) -> Self {
        let short = user.uuid.as_fields().0;

        Self {
            uuid: user.uuid,
            username: compact_str::format_compact!("u{:08x}_{}", short, user.username),
            password: user.password,
            database_uuid: user.database_uuid,
        }
    }
}

#[schema_extension_derive::extendible]
#[init_args(ServerDatabaseInstance, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "AdminServerDatabaseInstance")]
pub struct AdminApiServerDatabaseInstance {
    pub uuid: uuid::Uuid,
    pub server: super::server::AdminApiServer,
    pub database_agent_template:
        Option<super::database_agent_template::AdminApiDatabaseAgentTemplate>,

    pub r#type: db_agent_api::DatabaseAgentType,
    pub host: Option<compact_str::CompactString>,
    pub port: Option<i32>,

    pub name: compact_str::CompactString,
    pub is_locked: bool,

    pub memory: i64,
    pub swap: i64,
    pub disk: i64,
    pub io_weight: Option<i16>,
    pub cpu: i32,

    pub created: chrono::DateTime<chrono::Utc>,
}

#[schema_extension_derive::extendible]
#[init_args(ServerDatabaseInstance, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "ServerDatabaseInstance")]
pub struct ApiServerDatabaseInstance {
    pub uuid: uuid::Uuid,

    pub r#type: db_agent_api::DatabaseAgentType,
    pub host: Option<compact_str::CompactString>,
    pub port: Option<i32>,

    pub name: compact_str::CompactString,
    pub is_locked: bool,

    pub memory: i64,
    pub swap: i64,
    pub disk: i64,
    pub io_weight: Option<i16>,
    pub cpu: i32,

    pub created: chrono::DateTime<chrono::Utc>,
}
