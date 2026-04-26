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
pub struct NodeMount {
    pub mount: Fetchable<super::mount::Mount>,
    pub node: Fetchable<super::node::Node>,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for NodeMount {
    const NAME: &'static str = "node_mount";

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
                "node_mounts.mount_uuid",
                compact_str::format_compact!("{prefix}mount_uuid"),
            ),
            (
                "node_mounts.node_uuid",
                compact_str::format_compact!("{prefix}node_uuid"),
            ),
            (
                "node_mounts.created",
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
            node: super::node::Node::get_fetchable(
                row.try_get(compact_str::format_compact!("{prefix}node_uuid").as_str())?,
            ),
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl NodeMount {
    pub async fn by_node_uuid_mount_uuid(
        database: &crate::database::Database,
        node_uuid: uuid::Uuid,
        mount_uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM node_mounts
            WHERE node_mounts.node_uuid = $1 AND node_mounts.mount_uuid = $2
            "#,
            Self::columns_sql(None)
        ))
        .bind(node_uuid)
        .bind(mount_uuid)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn by_node_uuid_with_pagination(
        database: &crate::database::Database,
        node_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(&format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM node_mounts
            JOIN mounts ON mounts.uuid = node_mounts.mount_uuid
            WHERE node_mounts.node_uuid = $1 AND ($2 IS NULL OR mounts.name ILIKE '%' || $2 || '%')
            ORDER BY node_mounts.created
            LIMIT $3 OFFSET $4
            "#,
            Self::columns_sql(None)
        ))
        .bind(node_uuid)
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
            FROM node_mounts
            JOIN nodes ON nodes.uuid = node_mounts.node_uuid
            WHERE node_mounts.mount_uuid = $1 AND ($2 IS NULL OR nodes.name ILIKE '%' || $2 || '%')
            ORDER BY node_mounts.created
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

    #[inline]
    pub async fn into_admin_node_api_object(
        self,
        state: &crate::State,
        _args: (),
    ) -> Result<AdminApiNodeNodeMount, crate::database::DatabaseError> {
        Ok(AdminApiNodeNodeMount {
            node: self
                .node
                .fetch_cached(&state.database)
                .await?
                .into_admin_api_object(state, ())
                .await?,
            created: self.created.and_utc(),
        })
    }
}

#[async_trait::async_trait]
impl IntoAdminApiObject for NodeMount {
    type AdminApiObject = AdminApiNodeMount;
    type ExtraArgs<'a> = ();

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiNodeMount::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            AdminApiNodeMount {
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
pub struct CreateNodeMountOptions {
    #[garde(skip)]
    pub node_uuid: uuid::Uuid,
    #[garde(skip)]
    pub mount_uuid: uuid::Uuid,
}

#[async_trait::async_trait]
impl CreatableModel for NodeMount {
    type CreateOptions<'a> = CreateNodeMountOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<NodeMount>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        super::mount::Mount::by_uuid_optional_cached(&state.database, options.mount_uuid)
            .await?
            .ok_or(crate::database::InvalidRelationError("mount"))?;

        let mut transaction = state.database.write().begin().await?;

        let mut query_builder = InsertQueryBuilder::new("node_mounts");

        Self::run_create_handlers(&mut options, &mut query_builder, state, &mut transaction)
            .await?;

        query_builder
            .set("node_uuid", options.node_uuid)
            .set("mount_uuid", options.mount_uuid);

        query_builder.execute(&mut *transaction).await?;

        transaction.commit().await?;

        match Self::by_node_uuid_mount_uuid(&state.database, options.node_uuid, options.mount_uuid)
            .await?
        {
            Some(node_mount) => Ok(node_mount),
            None => Err(sqlx::Error::RowNotFound.into()),
        }
    }
}

#[async_trait::async_trait]
impl DeletableModel for NodeMount {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteListenerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteListenerList<NodeMount>> =
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
            DELETE FROM node_mounts
            WHERE node_mounts.node_uuid = $1 AND node_mounts.mount_uuid = $2
            "#,
        )
        .bind(self.node.uuid)
        .bind(self.mount.uuid)
        .execute(&mut *transaction)
        .await?;

        transaction.commit().await?;

        Ok(())
    }
}

#[derive(ToSchema, Serialize)]
#[schema(title = "AdminNodeNodeMount")]
pub struct AdminApiNodeNodeMount {
    pub node: super::node::AdminApiNode,

    pub created: chrono::DateTime<chrono::Utc>,
}

#[schema_extension_derive::extendible]
#[init_args(NodeMount, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "AdminNodeMount")]
pub struct AdminApiNodeMount {
    pub mount: super::mount::AdminApiMount,

    pub created: chrono::DateTime<chrono::Utc>,
}
