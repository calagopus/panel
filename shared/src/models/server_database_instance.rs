use crate::{
    models::{InsertQueryBuilder, UpdateQueryBuilder},
    prelude::*,
};
use garde::Validate;
use indexmap::IndexMap;
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
    pub template_version: Option<i32>,

    pub r#type: db_agent_api::DatabaseAgentType,

    pub name: compact_str::CompactString,
    pub locked: bool,

    pub image: Option<compact_str::CompactString>,
    pub env: Option<IndexMap<compact_str::CompactString, compact_str::CompactString>>,

    pub memory: Option<i64>,
    pub swap: Option<i64>,
    pub disk: Option<i64>,
    pub io_weight: Option<i16>,
    pub cpu: Option<i32>,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

pub struct ResolvedInstanceSpec {
    pub image: compact_str::CompactString,
    pub env: IndexMap<compact_str::CompactString, compact_str::CompactString>,

    pub image_uid: Option<i32>,
    pub image_gid: Option<i32>,
    pub cmd: Option<Vec<compact_str::CompactString>>,
    pub volumes: Option<IndexMap<compact_str::CompactString, compact_str::CompactString>>,
    pub socket_path: Option<compact_str::CompactString>,

    pub memory: i64,
    pub swap: i64,
    pub disk: i64,
    pub io_weight: Option<i16>,
    pub cpu: i32,
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
                "server_database_instances.template_version",
                compact_str::format_compact!("{prefix}template_version"),
            ),
            (
                "server_database_instances.image",
                compact_str::format_compact!("{prefix}image"),
            ),
            (
                "server_database_instances.env",
                compact_str::format_compact!("{prefix}env"),
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
            template_version: row
                .try_get(compact_str::format_compact!("{prefix}template_version").as_str())?,
            r#type: row.try_get(compact_str::format_compact!("{prefix}type").as_str())?,
            name: row.try_get(compact_str::format_compact!("{prefix}name").as_str())?,
            locked: row.try_get(compact_str::format_compact!("{prefix}locked").as_str())?,
            image: row.try_get(compact_str::format_compact!("{prefix}image").as_str())?,
            env: row
                .try_get::<Option<serde_json::Value>, _>(
                    compact_str::format_compact!("{prefix}env").as_str(),
                )?
                .map(serde_json::from_value)
                .transpose()?,
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
    pub fn resolve_spec(
        &self,
        template: Option<&super::database_agent_template::DatabaseAgentTemplate>,
    ) -> Option<ResolvedInstanceSpec> {
        let image = self
            .image
            .clone()
            .or_else(|| template.and_then(|t| t.docker_images.values().next().cloned()))?;

        let mut env = template.map(|t| t.env.clone()).unwrap_or_default();
        if let Some(env_overrides) = &self.env {
            env.extend(env_overrides.clone());
        }

        Some(ResolvedInstanceSpec {
            image,
            env,
            image_uid: template.map(|t| t.image_uid),
            image_gid: template.map(|t| t.image_gid),
            cmd: template.and_then(|t| t.cmd.clone()),
            volumes: template.map(|t| t.volumes.clone()),
            socket_path: template.map(|t| t.socket_path.clone()),
            memory: self.memory.or(template.map(|t| t.memory))?,
            swap: self.swap.or(template.map(|t| t.swap))?,
            disk: self.disk.or(template.map(|t| t.disk))?,
            io_weight: self.io_weight.or(template.and_then(|t| t.io_weight)),
            cpu: self.cpu.or(template.map(|t| t.cpu))?,
        })
    }

    pub async fn set_template_version(
        &mut self,
        database: &crate::database::Database,
        version: i32,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            UPDATE server_database_instances
            SET template_version = $2
            WHERE server_database_instances.uuid = $1
            "#,
        )
        .bind(self.uuid)
        .bind(version)
        .execute(database.write())
        .await?;

        self.template_version = Some(version);

        Ok(())
    }

    pub async fn by_database_agent_host_uuid_uuid(
        database: &crate::database::Database,
        database_agent_host_uuid: uuid::Uuid,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM server_database_instances
            JOIN database_agent_hosts ON database_agent_hosts.uuid = server_database_instances.database_agent_host_uuid
            WHERE server_database_instances.database_agent_host_uuid = $1 AND server_database_instances.uuid = $2
            "#,
            Self::columns_sql(None)
        )))
        .bind(database_agent_host_uuid)
        .bind(uuid)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

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

struct ResolvedAdminInstance {
    template: Option<super::database_agent_template::DatabaseAgentTemplate>,
    image: Option<compact_str::CompactString>,
    env: IndexMap<compact_str::CompactString, compact_str::CompactString>,
    update_available: bool,
    host: Option<compact_str::CompactString>,
    port: i32,
    memory: i64,
    swap: i64,
    disk: i64,
    io_weight: Option<i16>,
    cpu: i32,
}

impl ServerDatabaseInstance {
    async fn resolve_admin(
        &self,
        state: &crate::State,
    ) -> Result<ResolvedAdminInstance, crate::database::DatabaseError> {
        let type_settings = self.database_agent_host.types.get(self.r#type);

        let template = match &self.database_agent_template {
            Some(template) => Some(template.fetch_cached(&state.database).await?),
            None => None,
        };

        let image = self.image.clone().or_else(|| {
            template
                .as_ref()
                .and_then(|t| t.docker_images.values().next().cloned())
        });
        let env = {
            let mut env = template.as_ref().map(|t| t.env.clone()).unwrap_or_default();
            if let Some(env_overrides) = &self.env {
                env.extend(env_overrides.clone());
            }

            env
        };
        let update_available = match (&template, self.template_version) {
            (Some(template), Some(template_version)) => template.version > template_version,
            _ => false,
        };

        Ok(ResolvedAdminInstance {
            image,
            env,
            update_available,
            host: type_settings.public_host.clone().or_else(|| {
                self.database_agent_host
                    .url
                    .host_str()
                    .map(compact_str::CompactString::from)
            }),
            port: type_settings
                .public_port
                .map_or_else(|| i32::from(self.r#type.default_port()), i32::from),
            memory: self
                .memory
                .or(template.as_ref().map(|t| t.memory))
                .unwrap_or_default(),
            swap: self
                .swap
                .or(template.as_ref().map(|t| t.swap))
                .unwrap_or_default(),
            disk: self
                .disk
                .or(template.as_ref().map(|t| t.disk))
                .unwrap_or_default(),
            io_weight: self
                .io_weight
                .or(template.as_ref().and_then(|t| t.io_weight)),
            cpu: self
                .cpu
                .or(template.as_ref().map(|t| t.cpu))
                .unwrap_or_default(),
            template,
        })
    }

    pub async fn into_admin_server_api_object(
        self,
        state: &crate::State,
    ) -> Result<AdminApiServerServerDatabaseInstance, crate::database::DatabaseError> {
        let api_object = AdminApiServerServerDatabaseInstance::init_hooks(&self, state).await?;
        let resolved = self.resolve_admin(state).await?;

        let api_object = finish_extendible!(
            AdminApiServerServerDatabaseInstance {
                uuid: self.uuid,
                database_agent_host: self
                    .database_agent_host
                    .into_admin_api_object(state, ())
                    .await?,
                r#type: self.r#type,
                host: resolved.host,
                port: Some(resolved.port),
                name: self.name,
                is_locked: self.locked,
                template_version: self.template_version,
                update_available: resolved.update_available,
                image: resolved.image,
                image_override: self.image,
                env: resolved.env,
                env_overrides: self.env,
                memory: resolved.memory,
                swap: resolved.swap,
                disk: resolved.disk,
                io_weight: resolved.io_weight,
                cpu: resolved.cpu,
                memory_override: self.memory,
                swap_override: self.swap,
                disk_override: self.disk,
                io_weight_override: self.io_weight,
                cpu_override: self.cpu,
                database_agent_template: match resolved.template {
                    Some(template) => Some(template.into_admin_api_object(state, ()).await?),
                    None => None,
                },
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
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
        let resolved = self.resolve_admin(state).await?;

        let api_object = finish_extendible!(
            AdminApiServerDatabaseInstance {
                uuid: self.uuid,
                server: self
                    .server
                    .fetch_cached(&state.database)
                    .await?
                    .into_admin_api_object(state, storage_url_retriever)
                    .await?,
                r#type: self.r#type,
                host: resolved.host,
                port: Some(resolved.port),
                name: self.name,
                is_locked: self.locked,
                template_version: self.template_version,
                update_available: resolved.update_available,
                image: resolved.image,
                image_override: self.image,
                env: resolved.env,
                env_overrides: self.env,
                memory: resolved.memory,
                swap: resolved.swap,
                disk: resolved.disk,
                io_weight: resolved.io_weight,
                cpu: resolved.cpu,
                memory_override: self.memory,
                swap_override: self.swap,
                disk_override: self.disk,
                io_weight_override: self.io_weight,
                cpu_override: self.cpu,
                database_agent_template: match resolved.template {
                    Some(template) => Some(template.into_admin_api_object(state, ()).await?),
                    None => None,
                },
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

        let template = match &self.database_agent_template {
            Some(template) => Some(template.fetch_cached(&state.database).await?),
            None => None,
        };

        let update_available = match (&template, self.template_version) {
            (Some(template), Some(template_version)) => template.version > template_version,
            _ => false,
        };

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
                update_available,
                memory: self
                    .memory
                    .or(template.as_ref().map(|t| t.memory))
                    .unwrap_or_default(),
                swap: self
                    .swap
                    .or(template.as_ref().map(|t| t.swap))
                    .unwrap_or_default(),
                disk: self
                    .disk
                    .or(template.as_ref().map(|t| t.disk))
                    .unwrap_or_default(),
                io_weight: self
                    .io_weight
                    .or(template.as_ref().and_then(|t| t.io_weight)),
                cpu: self
                    .cpu
                    .or(template.as_ref().map(|t| t.cpu))
                    .unwrap_or_default(),
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
    #[garde(skip)]
    pub image: Option<compact_str::CompactString>,
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
            .set("template_version", options.database_agent_template.version)
            .set("type", options.database_agent_template.r#type)
            .set("name", &options.name)
            .set("image", options.image.as_ref());

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

    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub image: Option<Option<compact_str::CompactString>>,
    #[garde(skip)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub env: Option<Option<IndexMap<compact_str::CompactString, compact_str::CompactString>>>,

    #[garde(inner(inner(range(min = 0))))]
    #[schema(minimum = 0)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub memory: Option<Option<i64>>,
    #[garde(inner(inner(range(min = -1))))]
    #[schema(minimum = -1)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub swap: Option<Option<i64>>,
    #[garde(inner(inner(range(min = 0))))]
    #[schema(minimum = 0)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub disk: Option<Option<i64>>,
    #[garde(inner(inner(range(min = 0, max = 1000))))]
    #[schema(minimum = 0, maximum = 1000)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub io_weight: Option<Option<i16>>,
    #[garde(inner(inner(range(min = 0))))]
    #[schema(minimum = 0)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub cpu: Option<Option<i32>>,
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
            .set("image", options.image.as_ref().map(|i| i.as_ref()))
            .set(
                "env",
                options.env.as_ref().map(|e| e.as_ref().map(OrderedJson)),
            )
            .set("memory", options.memory.as_ref().map(|v| v.as_ref()))
            .set("swap", options.swap.as_ref().map(|v| v.as_ref()))
            .set("disk", options.disk.as_ref().map(|v| v.as_ref()))
            .set("io_weight", options.io_weight.as_ref().map(|v| v.as_ref()))
            .set("cpu", options.cpu.as_ref().map(|v| v.as_ref()))
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut **transaction).await?;

        if let Some(name) = options.name {
            self.name = name;
        }
        if let Some(locked) = options.locked {
            self.locked = locked;
        }
        if let Some(image) = options.image {
            self.image = image;
        }
        if let Some(env) = options.env {
            self.env = env;
        }
        if let Some(memory) = options.memory {
            self.memory = memory;
        }
        if let Some(swap) = options.swap {
            self.swap = swap;
        }
        if let Some(disk) = options.disk {
            self.disk = disk;
        }
        if let Some(io_weight) = options.io_weight {
            self.io_weight = io_weight;
        }
        if let Some(cpu) = options.cpu {
            self.cpu = cpu;
        }

        self.run_after_update_handlers(state, transaction).await?;

        Ok(())
    }
}

impl ServerDatabaseInstance {
    pub async fn by_database_agent_template_uuid_uuid(
        database: &crate::database::Database,
        database_agent_template_uuid: uuid::Uuid,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM server_database_instances
            JOIN database_agent_hosts ON database_agent_hosts.uuid = server_database_instances.database_agent_host_uuid
            WHERE server_database_instances.database_agent_template_uuid = $1 AND server_database_instances.uuid = $2
            "#,
            Self::columns_sql(None)
        )))
        .bind(database_agent_template_uuid)
        .bind(uuid)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
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
#[schema(title = "AdminServerServerDatabaseInstance")]
pub struct AdminApiServerServerDatabaseInstance {
    pub uuid: uuid::Uuid,
    pub database_agent_host: super::database_agent_host::AdminApiDatabaseAgentHost,
    pub database_agent_template:
        Option<super::database_agent_template::AdminApiDatabaseAgentTemplate>,
    pub template_version: Option<i32>,
    pub update_available: bool,

    pub r#type: db_agent_api::DatabaseAgentType,
    pub host: Option<compact_str::CompactString>,
    pub port: Option<i32>,

    pub name: compact_str::CompactString,
    pub is_locked: bool,

    pub image: Option<compact_str::CompactString>,
    pub image_override: Option<compact_str::CompactString>,
    pub env: IndexMap<compact_str::CompactString, compact_str::CompactString>,
    pub env_overrides: Option<IndexMap<compact_str::CompactString, compact_str::CompactString>>,

    pub memory: i64,
    pub swap: i64,
    pub disk: i64,
    pub io_weight: Option<i16>,
    pub cpu: i32,

    pub memory_override: Option<i64>,
    pub swap_override: Option<i64>,
    pub disk_override: Option<i64>,
    pub io_weight_override: Option<i16>,
    pub cpu_override: Option<i32>,

    pub created: chrono::DateTime<chrono::Utc>,
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
    pub template_version: Option<i32>,
    pub update_available: bool,

    pub r#type: db_agent_api::DatabaseAgentType,
    pub host: Option<compact_str::CompactString>,
    pub port: Option<i32>,

    pub name: compact_str::CompactString,
    pub is_locked: bool,

    pub image: Option<compact_str::CompactString>,
    pub image_override: Option<compact_str::CompactString>,
    pub env: IndexMap<compact_str::CompactString, compact_str::CompactString>,
    pub env_overrides: Option<IndexMap<compact_str::CompactString, compact_str::CompactString>>,

    pub memory: i64,
    pub swap: i64,
    pub disk: i64,
    pub io_weight: Option<i16>,
    pub cpu: i32,

    pub memory_override: Option<i64>,
    pub swap_override: Option<i64>,
    pub disk_override: Option<i64>,
    pub io_weight_override: Option<i16>,
    pub cpu_override: Option<i32>,

    pub created: chrono::DateTime<chrono::Utc>,
}

#[schema_extension_derive::extendible]
#[init_args(ServerDatabaseInstance, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "ServerDatabaseInstance")]
pub struct ApiServerDatabaseInstance {
    pub uuid: uuid::Uuid,
    pub update_available: bool,

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
