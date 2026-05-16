use crate::{models::InsertQueryBuilder, prelude::*};
use garde::Validate;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{
    collections::BTreeMap,
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

#[derive(Serialize, Deserialize)]
pub struct NestEggMount {
    pub mount: Fetchable<super::mount::Mount>,
    pub nest_egg: Fetchable<super::nest_egg::NestEgg>,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for NestEggMount {
    const NAME: &'static str = "nest_egg_mount";

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
            (
                "nest_egg_mounts.mount_uuid",
                compact_str::format_compact!("{prefix}mount_uuid"),
            ),
            (
                "nest_egg_mounts.egg_uuid",
                compact_str::format_compact!("{prefix}egg_uuid"),
            ),
            (
                "nest_egg_mounts.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ])
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            mount: super::mount::Mount::get_fetchable(
                row.try_get(compact_str::format_compact!("{prefix}mount_uuid").as_str())?,
            ),
            nest_egg: super::nest_egg::NestEgg::get_fetchable(
                row.try_get(compact_str::format_compact!("{prefix}egg_uuid").as_str())?,
            ),
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl NestEggMount {
    pub async fn by_egg_uuid_mount_uuid(
        database: &crate::database::Database,
        egg_uuid: uuid::Uuid,
        mount_uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM nest_egg_mounts
            WHERE nest_egg_mounts.egg_uuid = $1 AND nest_egg_mounts.mount_uuid = $2
            "#,
            Self::columns_sql(None)
        ))
        .bind(egg_uuid)
        .bind(mount_uuid)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn by_egg_uuid_with_pagination(
        database: &crate::database::Database,
        egg_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(&format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM nest_egg_mounts
            JOIN mounts ON mounts.uuid = nest_egg_mounts.mount_uuid
            WHERE nest_egg_mounts.egg_uuid = $1 AND ($2 IS NULL OR mounts.name ILIKE '%' || $2 || '%')
            ORDER BY nest_egg_mounts.created
            LIMIT $3 OFFSET $4
            "#,
            Self::columns_sql(None)
        ))
        .bind(egg_uuid)
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

    pub async fn by_mount_uuid_with_pagination(
        database: &crate::database::Database,
        mount_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(&format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM nest_egg_mounts
            JOIN nest_eggs ON nest_eggs.uuid = nest_egg_mounts.egg_uuid
            WHERE nest_egg_mounts.mount_uuid = $1 AND ($2 IS NULL OR nest_eggs.name ILIKE '%' || $2 || '%')
            ORDER BY nest_egg_mounts.created
            LIMIT $3 OFFSET $4
            "#,
            Self::columns_sql(None)
        ))
        .bind(mount_uuid)
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

    pub async fn into_admin_nest_egg_api_object(
        self,
        state: &crate::State,
        _args: (),
    ) -> Result<AdminApiNestEggNestEggMount, crate::database::DatabaseError> {
        let nest_egg = self.nest_egg.fetch_cached(&state.database).await?;
        let nest = nest_egg.nest.clone();
        let (nest, nest_egg) = tokio::try_join!(nest.fetch_cached(&state.database), async {
            Ok(nest_egg.into_admin_api_object(state, ()).await?)
        })?;

        Ok(AdminApiNestEggNestEggMount {
            nest: nest.into_admin_api_object(state, ()).await?,
            nest_egg,
            created: self.created.and_utc(),
        })
    }
}

#[async_trait::async_trait]
impl IntoAdminApiObject for NestEggMount {
    type AdminApiObject = AdminApiNestEggMount;
    type ExtraArgs<'a> = ();

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiNestEggMount::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            AdminApiNestEggMount {
                mount: self
                    .mount
                    .fetch_cached(&state.database)
                    .await?
                    .into_admin_api_object(state, ())
                    .await?,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[derive(ToSchema, Deserialize, Validate)]
pub struct CreateNestEggMountOptions {
    #[garde(skip)]
    pub egg_uuid: uuid::Uuid,
    #[garde(skip)]
    pub mount_uuid: uuid::Uuid,
}

#[async_trait::async_trait]
impl CreatableModel for NestEggMount {
    type CreateOptions<'a> = CreateNestEggMountOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<NestEggMount>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create_with_transaction(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        super::mount::Mount::by_uuid_optional_cached(&state.database, options.mount_uuid)
            .await?
            .ok_or(crate::database::InvalidRelationError("mount"))?;

        let mut query_builder = InsertQueryBuilder::new("nest_egg_mounts");

        Self::run_create_handlers(&mut options, &mut query_builder, state, transaction).await?;

        query_builder
            .set("egg_uuid", options.egg_uuid)
            .set("mount_uuid", options.mount_uuid);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut **transaction)
            .await?;
        let mut nest_egg_mount = Self::map(None, &row)?;

        Self::run_after_create_handlers(&mut nest_egg_mount, &options, state, transaction).await?;

        Ok(nest_egg_mount)
    }
}

#[async_trait::async_trait]
impl DeletableModel for NestEggMount {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteHandlerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteHandlerList<NestEggMount>> =
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
            DELETE FROM nest_egg_mounts
            WHERE nest_egg_mounts.egg_uuid = $1 AND nest_egg_mounts.mount_uuid = $2
            "#,
        )
        .bind(self.nest_egg.uuid)
        .bind(self.mount.uuid)
        .execute(&mut **transaction)
        .await?;

        self.run_after_delete_handlers(&options, state, transaction)
            .await?;

        Ok(())
    }
}

#[derive(ToSchema, Serialize)]
#[schema(title = "AdminNestEggNestEggMount")]
pub struct AdminApiNestEggNestEggMount {
    pub nest: super::nest::AdminApiNest,
    pub nest_egg: super::nest_egg::AdminApiNestEgg,

    pub created: chrono::DateTime<chrono::Utc>,
}

#[schema_extension_derive::extendible]
#[init_args(NestEggMount, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "AdminNestEggMount")]
pub struct AdminApiNestEggMount {
    pub mount: super::mount::AdminApiMount,

    pub created: chrono::DateTime<chrono::Utc>,
}
