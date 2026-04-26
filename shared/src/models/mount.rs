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
pub struct Mount {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,

    pub source: compact_str::CompactString,
    pub target: compact_str::CompactString,

    pub read_only: bool,
    pub user_mountable: bool,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for Mount {
    const NAME: &'static str = "mount";

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

        BTreeMap::from([
            ("mounts.uuid", compact_str::format_compact!("{prefix}uuid")),
            ("mounts.name", compact_str::format_compact!("{prefix}name")),
            (
                "mounts.description",
                compact_str::format_compact!("{prefix}description"),
            ),
            (
                "mounts.source",
                compact_str::format_compact!("{prefix}source"),
            ),
            (
                "mounts.target",
                compact_str::format_compact!("{prefix}target"),
            ),
            (
                "mounts.read_only",
                compact_str::format_compact!("{prefix}read_only"),
            ),
            (
                "mounts.user_mountable",
                compact_str::format_compact!("{prefix}user_mountable"),
            ),
            (
                "mounts.created",
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
            source: row.try_get(compact_str::format_compact!("{prefix}source").as_str())?,
            target: row.try_get(compact_str::format_compact!("{prefix}target").as_str())?,
            read_only: row.try_get(compact_str::format_compact!("{prefix}read_only").as_str())?,
            user_mountable: row
                .try_get(compact_str::format_compact!("{prefix}user_mountable").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl Mount {
    pub async fn by_node_uuid_egg_uuid_uuid(
        database: &crate::database::Database,
        node_uuid: uuid::Uuid,
        egg_uuid: uuid::Uuid,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM mounts
            JOIN node_mounts ON mounts.uuid = node_mounts.mount_uuid
            JOIN nest_egg_mounts ON mounts.uuid = nest_egg_mounts.mount_uuid
            WHERE node_mounts.node_uuid = $1 AND nest_egg_mounts.egg_uuid = $2 AND mounts.uuid = $3
            "#,
            Self::columns_sql(None)
        ))
        .bind(node_uuid)
        .bind(egg_uuid)
        .bind(uuid)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
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
            FROM mounts
            WHERE ($1 IS NULL OR mounts.name ILIKE '%' || $1 || '%')
            ORDER BY mounts.created
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
}

#[async_trait::async_trait]
impl IntoAdminApiObject for Mount {
    type AdminApiObject = AdminApiMount;
    type ExtraArgs<'a> = ();

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiMount::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            AdminApiMount {
                uuid: self.uuid,
                name: self.name,
                description: self.description,
                source: self.source,
                target: self.target,
                read_only: self.read_only,
                user_mountable: self.user_mountable,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[async_trait::async_trait]
impl ByUuid for Mount {
    async fn by_uuid(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
    ) -> Result<Self, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM mounts
            WHERE mounts.uuid = $1
            "#,
            Self::columns_sql(None)
        ))
        .bind(uuid)
        .fetch_one(database.read())
        .await?;

        Self::map(None, &row)
    }
}

#[derive(ToSchema, Deserialize, Validate)]
pub struct CreateMountOptions {
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: compact_str::CompactString,
    #[garde(length(chars, min = 1, max = 1024))]
    #[schema(min_length = 1, max_length = 1024)]
    pub description: Option<compact_str::CompactString>,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub source: compact_str::CompactString,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub target: compact_str::CompactString,
    #[garde(skip)]
    pub read_only: bool,
    #[garde(skip)]
    pub user_mountable: bool,
}

#[async_trait::async_trait]
impl CreatableModel for Mount {
    type CreateOptions<'a> = CreateMountOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<Mount>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        let mut transaction = state.database.write().begin().await?;

        let mut query_builder = InsertQueryBuilder::new("mounts");

        Self::run_create_handlers(&mut options, &mut query_builder, state, &mut transaction)
            .await?;

        query_builder
            .set("name", &options.name)
            .set("description", &options.description)
            .set("source", &options.source)
            .set("target", &options.target)
            .set("read_only", options.read_only)
            .set("user_mountable", options.user_mountable);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut *transaction)
            .await?;
        let mount = Self::map(None, &row)?;

        transaction.commit().await?;

        Ok(mount)
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Clone, Default)]
pub struct UpdateMountOptions {
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
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub source: Option<compact_str::CompactString>,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub target: Option<compact_str::CompactString>,
    #[garde(skip)]
    pub read_only: Option<bool>,
    #[garde(skip)]
    pub user_mountable: Option<bool>,
}

#[async_trait::async_trait]
impl UpdatableModel for Mount {
    type UpdateOptions = UpdateMountOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateListenerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateListenerList<Mount>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &UPDATE_LISTENERS
    }

    async fn update(
        &mut self,
        state: &crate::State,
        mut options: Self::UpdateOptions,
    ) -> Result<(), crate::database::DatabaseError> {
        options.validate()?;

        let mut transaction = state.database.write().begin().await?;

        let mut query_builder = UpdateQueryBuilder::new("mounts");

        Self::run_update_handlers(
            self,
            &mut options,
            &mut query_builder,
            state,
            &mut transaction,
        )
        .await?;

        query_builder
            .set("name", options.name.as_ref())
            .set(
                "description",
                options.description.as_ref().map(|d| d.as_ref()),
            )
            .set("source", options.source.as_ref())
            .set("target", options.target.as_ref())
            .set("read_only", options.read_only)
            .set("user_mountable", options.user_mountable)
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut *transaction).await?;

        if let Some(name) = options.name {
            self.name = name;
        }
        if let Some(description) = options.description {
            self.description = description;
        }
        if let Some(source) = options.source {
            self.source = source;
        }
        if let Some(target) = options.target {
            self.target = target;
        }
        if let Some(read_only) = options.read_only {
            self.read_only = read_only;
        }
        if let Some(user_mountable) = options.user_mountable {
            self.user_mountable = user_mountable;
        }

        transaction.commit().await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl DeletableModel for Mount {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteListenerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteListenerList<Mount>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &DELETE_LISTENERS
    }

    async fn delete(
        &self,
        state: &crate::State,
        options: Self::DeleteOptions,
    ) -> Result<(), anyhow::Error> {
        let mut transaction = state.database.write().begin().await?;

        self.run_delete_handlers(&options, state, &mut transaction)
            .await?;

        sqlx::query(
            r#"
            DELETE FROM mounts
            WHERE mounts.uuid = $1
            "#,
        )
        .bind(self.uuid)
        .execute(&mut *transaction)
        .await?;

        transaction.commit().await?;

        Ok(())
    }
}

#[schema_extension_derive::extendible]
#[init_args(Mount, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "Mount")]
pub struct AdminApiMount {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,

    pub source: compact_str::CompactString,
    pub target: compact_str::CompactString,

    pub read_only: bool,
    pub user_mountable: bool,

    pub created: chrono::DateTime<chrono::Utc>,
}
