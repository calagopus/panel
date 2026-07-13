use crate::{
    models::{InsertQueryBuilder, UpdateQueryBuilder},
    prelude::*,
};
use garde::Validate;
use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{
    collections::{BTreeMap, HashSet},
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

pub fn validate_docker_images(
    docker_images: &IndexMap<compact_str::CompactString, compact_str::CompactString>,
    _context: &(),
) -> Result<(), garde::Error> {
    if docker_images.is_empty() {
        return Err(garde::Error::new("at least one docker image is required"));
    }

    let mut seen_images = HashSet::new();
    for image in docker_images.values() {
        if !seen_images.insert(image) {
            return Err(garde::Error::new(compact_str::format_compact!(
                "duplicate docker image: {}",
                image
            )));
        }
    }

    Ok(())
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DatabaseAgentTemplate {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,

    pub r#type: db_agent_api::DatabaseAgentType,
    pub deployment_enabled: bool,

    pub docker_images: IndexMap<compact_str::CompactString, compact_str::CompactString>,
    pub env: IndexMap<compact_str::CompactString, compact_str::CompactString>,

    pub image_uid: i32,
    pub image_gid: i32,
    pub cmd: Option<Vec<compact_str::CompactString>>,
    pub volumes: IndexMap<compact_str::CompactString, compact_str::CompactString>,
    pub socket_path: compact_str::CompactString,

    pub memory: i64,
    pub swap: i64,
    pub disk: i64,
    pub io_weight: Option<i16>,
    pub cpu: i32,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for DatabaseAgentTemplate {
    const NAME: &'static str = "database_agent_template";

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
                "database_agent_templates.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "database_agent_templates.name",
                compact_str::format_compact!("{prefix}name"),
            ),
            (
                "database_agent_templates.description",
                compact_str::format_compact!("{prefix}description"),
            ),
            (
                "database_agent_templates.type",
                compact_str::format_compact!("{prefix}type"),
            ),
            (
                "database_agent_templates.deployment_enabled",
                compact_str::format_compact!("{prefix}deployment_enabled"),
            ),
            (
                "database_agent_templates.docker_images",
                compact_str::format_compact!("{prefix}docker_images"),
            ),
            (
                "database_agent_templates.env",
                compact_str::format_compact!("{prefix}env"),
            ),
            (
                "database_agent_templates.image_uid",
                compact_str::format_compact!("{prefix}image_uid"),
            ),
            (
                "database_agent_templates.image_gid",
                compact_str::format_compact!("{prefix}image_gid"),
            ),
            (
                "database_agent_templates.cmd",
                compact_str::format_compact!("{prefix}cmd"),
            ),
            (
                "database_agent_templates.volumes",
                compact_str::format_compact!("{prefix}volumes"),
            ),
            (
                "database_agent_templates.socket_path",
                compact_str::format_compact!("{prefix}socket_path"),
            ),
            (
                "database_agent_templates.memory",
                compact_str::format_compact!("{prefix}memory"),
            ),
            (
                "database_agent_templates.swap",
                compact_str::format_compact!("{prefix}swap"),
            ),
            (
                "database_agent_templates.disk",
                compact_str::format_compact!("{prefix}disk"),
            ),
            (
                "database_agent_templates.io_weight",
                compact_str::format_compact!("{prefix}io_weight"),
            ),
            (
                "database_agent_templates.cpu",
                compact_str::format_compact!("{prefix}cpu"),
            ),
            (
                "database_agent_templates.created",
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
            r#type: row.try_get(compact_str::format_compact!("{prefix}type").as_str())?,
            deployment_enabled: row
                .try_get(compact_str::format_compact!("{prefix}deployment_enabled").as_str())?,
            docker_images: serde_json::from_value(
                row.try_get(compact_str::format_compact!("{prefix}docker_images").as_str())?,
            )?,
            env: serde_json::from_value(
                row.try_get(compact_str::format_compact!("{prefix}env").as_str())?,
            )?,
            image_uid: row.try_get(compact_str::format_compact!("{prefix}image_uid").as_str())?,
            image_gid: row.try_get(compact_str::format_compact!("{prefix}image_gid").as_str())?,
            cmd: row.try_get(compact_str::format_compact!("{prefix}cmd").as_str())?,
            volumes: serde_json::from_value(
                row.try_get(compact_str::format_compact!("{prefix}volumes").as_str())?,
            )?,
            socket_path: row
                .try_get(compact_str::format_compact!("{prefix}socket_path").as_str())?,
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

impl DatabaseAgentTemplate {
    pub async fn all_deployment_enabled(
        database: &crate::database::Database,
    ) -> Result<Vec<Self>, crate::database::DatabaseError> {
        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM database_agent_templates
            WHERE database_agent_templates.deployment_enabled
            ORDER BY database_agent_templates.created
            "#,
            Self::columns_sql(None)
        )))
        .fetch_all(database.read())
        .await?;

        rows.into_iter()
            .map(|row| Self::map(None, &row))
            .try_collect_vec()
    }

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
            FROM database_agent_templates
            WHERE ($1 IS NULL OR database_agent_templates.name ILIKE '%' || $1 || '%')
            ORDER BY database_agent_templates.created
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
}

#[async_trait::async_trait]
impl IntoAdminApiObject for DatabaseAgentTemplate {
    type AdminApiObject = AdminApiDatabaseAgentTemplate;
    type ExtraArgs<'a> = ();

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiDatabaseAgentTemplate::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            AdminApiDatabaseAgentTemplate {
                uuid: self.uuid,
                name: self.name,
                description: self.description,
                r#type: self.r#type,
                deployment_enabled: self.deployment_enabled,
                docker_images: self.docker_images,
                env: self.env,
                image_uid: self.image_uid,
                image_gid: self.image_gid,
                cmd: self.cmd,
                volumes: self.volumes,
                socket_path: self.socket_path,
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
impl IntoApiObject for DatabaseAgentTemplate {
    type ApiObject = ApiDatabaseAgentTemplate;
    type ExtraArgs<'a> = ();

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::ApiObject, crate::database::DatabaseError> {
        let api_object = ApiDatabaseAgentTemplate::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            ApiDatabaseAgentTemplate {
                uuid: self.uuid,
                name: self.name,
                description: self.description,
                r#type: self.r#type,
                docker_images: self.docker_images,
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
impl ByUuid for DatabaseAgentTemplate {
    async fn by_uuid(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
    ) -> Result<Self, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM database_agent_templates
            WHERE database_agent_templates.uuid = $1
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
            FROM database_agent_templates
            WHERE database_agent_templates.uuid = $1
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
pub struct CreateDatabaseAgentTemplateOptions {
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: compact_str::CompactString,
    #[garde(length(chars, min = 1, max = 1024))]
    #[schema(min_length = 1, max_length = 1024)]
    pub description: Option<compact_str::CompactString>,

    #[garde(skip)]
    pub r#type: db_agent_api::DatabaseAgentType,
    #[garde(skip)]
    pub deployment_enabled: bool,

    #[garde(custom(validate_docker_images))]
    pub docker_images: IndexMap<compact_str::CompactString, compact_str::CompactString>,
    #[garde(skip)]
    pub env: IndexMap<compact_str::CompactString, compact_str::CompactString>,

    #[garde(range(min = 0))]
    #[schema(minimum = 0)]
    pub image_uid: i32,
    #[garde(range(min = 0))]
    #[schema(minimum = 0)]
    pub image_gid: i32,
    #[garde(skip)]
    pub cmd: Option<Vec<compact_str::CompactString>>,
    #[garde(skip)]
    pub volumes: IndexMap<compact_str::CompactString, compact_str::CompactString>,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub socket_path: compact_str::CompactString,

    #[garde(range(min = 0))]
    #[schema(minimum = 0)]
    pub memory: i64,
    #[garde(range(min = -1))]
    #[schema(minimum = -1)]
    pub swap: i64,
    #[garde(range(min = 0))]
    #[schema(minimum = 0)]
    pub disk: i64,
    #[garde(range(min = 0))]
    #[schema(minimum = 0)]
    pub io_weight: Option<i16>,
    #[garde(range(min = 0))]
    #[schema(minimum = 0)]
    pub cpu: i32,
}

#[async_trait::async_trait]
impl CreatableModel for DatabaseAgentTemplate {
    type CreateOptions<'a> = CreateDatabaseAgentTemplateOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<DatabaseAgentTemplate>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create_with_transaction(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        let mut query_builder = InsertQueryBuilder::new("database_agent_templates");

        Self::run_create_handlers(&mut options, &mut query_builder, state, transaction).await?;

        query_builder
            .set("name", &options.name)
            .set("description", &options.description)
            .set("type", options.r#type)
            .set("deployment_enabled", options.deployment_enabled)
            .set("docker_images", OrderedJson(&options.docker_images))
            .set("env", OrderedJson(&options.env))
            .set("image_uid", options.image_uid)
            .set("image_gid", options.image_gid)
            .set("cmd", options.cmd.as_ref())
            .set("volumes", OrderedJson(&options.volumes))
            .set("socket_path", &options.socket_path)
            .set("memory", options.memory)
            .set("swap", options.swap)
            .set("disk", options.disk)
            .set("io_weight", options.io_weight)
            .set("cpu", options.cpu);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut **transaction)
            .await?;
        let mut database_agent_template = Self::map(None, &row)?;

        Self::run_after_create_handlers(&mut database_agent_template, &options, state, transaction)
            .await?;

        Ok(database_agent_template)
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Clone, Default)]
pub struct UpdateDatabaseAgentTemplateOptions {
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
    pub r#type: Option<db_agent_api::DatabaseAgentType>,
    #[garde(skip)]
    pub deployment_enabled: Option<bool>,

    #[garde(inner(custom(validate_docker_images)))]
    pub docker_images: Option<IndexMap<compact_str::CompactString, compact_str::CompactString>>,
    #[garde(skip)]
    pub env: Option<IndexMap<compact_str::CompactString, compact_str::CompactString>>,

    #[garde(range(min = 0))]
    #[schema(minimum = 0)]
    pub image_uid: Option<i32>,
    #[garde(range(min = 0))]
    #[schema(minimum = 0)]
    pub image_gid: Option<i32>,
    #[garde(skip)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub cmd: Option<Option<Vec<compact_str::CompactString>>>,
    #[garde(skip)]
    pub volumes: Option<IndexMap<compact_str::CompactString, compact_str::CompactString>>,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub socket_path: Option<compact_str::CompactString>,

    #[garde(range(min = 0))]
    #[schema(minimum = 0)]
    pub memory: Option<i64>,
    #[garde(range(min = -1))]
    #[schema(minimum = -1)]
    pub swap: Option<i64>,
    #[garde(range(min = 0))]
    #[schema(minimum = 0)]
    pub disk: Option<i64>,
    #[garde(skip)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub io_weight: Option<Option<i16>>,
    #[garde(range(min = 0))]
    #[schema(minimum = 0)]
    pub cpu: Option<i32>,
}

#[async_trait::async_trait]
impl UpdatableModel for DatabaseAgentTemplate {
    type UpdateOptions = UpdateDatabaseAgentTemplateOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateHandlerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateHandlerList<DatabaseAgentTemplate>> =
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

        let mut query_builder = UpdateQueryBuilder::new("database_agent_templates");

        self.run_update_handlers(&mut options, &mut query_builder, state, transaction)
            .await?;

        query_builder
            .set("name", options.name.as_ref())
            .set(
                "description",
                options.description.as_ref().map(|d| d.as_ref()),
            )
            .set("type", options.r#type)
            .set("deployment_enabled", options.deployment_enabled)
            .set(
                "docker_images",
                options.docker_images.as_ref().map(OrderedJson),
            )
            .set("env", options.env.as_ref().map(OrderedJson))
            .set("image_uid", options.image_uid)
            .set("image_gid", options.image_gid)
            .set("cmd", options.cmd.as_ref().map(|c| c.as_ref()))
            .set("volumes", options.volumes.as_ref().map(OrderedJson))
            .set("socket_path", options.socket_path.as_ref())
            .set("memory", options.memory)
            .set("swap", options.swap)
            .set("disk", options.disk)
            .set("io_weight", options.io_weight.as_ref().map(|w| w.as_ref()))
            .set("cpu", options.cpu)
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut **transaction).await?;

        if let Some(name) = options.name {
            self.name = name;
        }
        if let Some(description) = options.description {
            self.description = description;
        }
        if let Some(r#type) = options.r#type {
            self.r#type = r#type;
        }
        if let Some(deployment_enabled) = options.deployment_enabled {
            self.deployment_enabled = deployment_enabled;
        }
        if let Some(docker_images) = options.docker_images {
            self.docker_images = docker_images;
        }
        if let Some(env) = options.env {
            self.env = env;
        }
        if let Some(image_uid) = options.image_uid {
            self.image_uid = image_uid;
        }
        if let Some(image_gid) = options.image_gid {
            self.image_gid = image_gid;
        }
        if let Some(cmd) = options.cmd {
            self.cmd = cmd;
        }
        if let Some(volumes) = options.volumes {
            self.volumes = volumes;
        }
        if let Some(socket_path) = options.socket_path {
            self.socket_path = socket_path;
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

#[async_trait::async_trait]
impl DeletableModel for DatabaseAgentTemplate {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteHandlerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteHandlerList<DatabaseAgentTemplate>> =
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
            DELETE FROM database_agent_templates
            WHERE database_agent_templates.uuid = $1
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
#[init_args(DatabaseAgentTemplate, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "AdminDatabaseAgentTemplate")]
pub struct AdminApiDatabaseAgentTemplate {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,

    pub r#type: db_agent_api::DatabaseAgentType,
    pub deployment_enabled: bool,

    pub docker_images: IndexMap<compact_str::CompactString, compact_str::CompactString>,
    pub env: IndexMap<compact_str::CompactString, compact_str::CompactString>,

    pub image_uid: i32,
    pub image_gid: i32,
    pub cmd: Option<Vec<compact_str::CompactString>>,
    pub volumes: IndexMap<compact_str::CompactString, compact_str::CompactString>,
    pub socket_path: compact_str::CompactString,

    pub memory: i64,
    pub swap: i64,
    pub disk: i64,
    pub io_weight: Option<i16>,
    pub cpu: i32,

    pub created: chrono::DateTime<chrono::Utc>,
}

#[schema_extension_derive::extendible]
#[init_args(DatabaseAgentTemplate, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "DatabaseAgentTemplate")]
pub struct ApiDatabaseAgentTemplate {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,

    pub r#type: db_agent_api::DatabaseAgentType,

    pub docker_images: IndexMap<compact_str::CompactString, compact_str::CompactString>,

    pub memory: i64,
    pub swap: i64,
    pub disk: i64,
    pub io_weight: Option<i16>,
    pub cpu: i32,

    pub created: chrono::DateTime<chrono::Utc>,
}
