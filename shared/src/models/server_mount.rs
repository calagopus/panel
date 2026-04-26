use crate::{models::InsertQueryBuilder, prelude::*, storage::StorageUrlRetriever};
use garde::Validate;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{
    collections::BTreeMap,
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

#[derive(Serialize, Deserialize)]
pub struct ServerMount {
    pub mount: Fetchable<super::mount::Mount>,
    pub server: Option<Fetchable<super::server::Server>>,

    pub created: Option<chrono::NaiveDateTime>,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for ServerMount {
    const NAME: &'static str = "server_mount";

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
                "server_mounts.mount_uuid",
                compact_str::format_compact!("{prefix}mount_uuid"),
            ),
            (
                "server_mounts.server_uuid",
                compact_str::format_compact!("{prefix}server_uuid"),
            ),
            (
                "server_mounts.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ])
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            mount: super::mount::Mount::get_fetchable(
                row.try_get(compact_str::format_compact!("{prefix}mount_uuid").as_str())
                    .or_else(|_| row.try_get("alt_mount_uuid"))?,
            ),
            server: super::server::Server::get_fetchable_from_row(
                row,
                compact_str::format_compact!("{prefix}server_uuid"),
            ),
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl ServerMount {
    pub async fn by_server_uuid_mount_uuid(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
        mount_uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM server_mounts
            WHERE server_mounts.server_uuid = $1 AND server_mounts.mount_uuid = $2
            "#,
            Self::columns_sql(None)
        ))
        .bind(server_uuid)
        .bind(mount_uuid)
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

        let rows = sqlx::query(&format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM server_mounts
            JOIN mounts ON mounts.uuid = server_mounts.mount_uuid
            WHERE server_mounts.server_uuid = $1 AND ($2 IS NULL OR mounts.name ILIKE '%' || $2 || '%')
            ORDER BY server_mounts.mount_uuid ASC
            LIMIT $3 OFFSET $4
            "#,
            Self::columns_sql(None)
        ))
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

    pub async fn available_by_server_with_pagination(
        database: &crate::database::Database,
        server: &super::server::Server,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(&format!(
            r#"
            SELECT {}, mounts.uuid AS alt_mount_uuid, COUNT(*) OVER() AS total_count
            FROM mounts
            JOIN node_mounts ON mounts.uuid = node_mounts.mount_uuid AND node_mounts.node_uuid = $1
            JOIN nest_egg_mounts ON mounts.uuid = nest_egg_mounts.mount_uuid AND nest_egg_mounts.egg_uuid = $2
            LEFT JOIN server_mounts ON server_mounts.mount_uuid = mounts.uuid AND server_mounts.server_uuid = $3
            WHERE $4 IS NULL OR mounts.name ILIKE '%' || $4 || '%'
            ORDER BY mounts.created
            LIMIT $5 OFFSET $6
            "#,
            Self::columns_sql(None)
        ))
        .bind(server.node.uuid)
        .bind(server.egg.uuid)
        .bind(server.uuid)
        .bind(search)
        .bind(per_page)
        .bind(offset)
        .fetch_all(database.read())
        .await
        ?;

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

    pub async fn mountable_by_server_with_pagination(
        database: &crate::database::Database,
        server: &super::server::Server,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(&format!(
            r#"
            SELECT {}, mounts.uuid AS alt_mount_uuid, COUNT(*) OVER() AS total_count
            FROM mounts
            JOIN node_mounts ON mounts.uuid = node_mounts.mount_uuid AND node_mounts.node_uuid = $1
            JOIN nest_egg_mounts ON mounts.uuid = nest_egg_mounts.mount_uuid AND nest_egg_mounts.egg_uuid = $2
            LEFT JOIN server_mounts ON server_mounts.mount_uuid = mounts.uuid AND server_mounts.server_uuid = $3
            WHERE mounts.user_mountable = TRUE AND ($4 IS NULL OR mounts.name ILIKE '%' || $4 || '%')
            ORDER BY mounts.created
            LIMIT $5 OFFSET $6
            "#,
            Self::columns_sql(None)
        ))
        .bind(server.node.uuid)
        .bind(server.egg.uuid)
        .bind(server.uuid)
        .bind(search)
        .bind(per_page)
        .bind(offset)
        .fetch_all(database.read())
        .await
        ?;

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
            FROM server_mounts
            JOIN servers ON servers.uuid = server_mounts.server_uuid
            WHERE server_mounts.mount_uuid = $1 AND ($2 IS NULL OR servers.name ILIKE '%' || $2 || '%')
            ORDER BY server_mounts.mount_uuid ASC
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

    pub async fn into_admin_server_api_object(
        self,
        state: &crate::State,
        storage_url_retriever: &StorageUrlRetriever<'_>,
    ) -> Result<AdminApiServerServerMount, crate::database::DatabaseError> {
        let created = match self.created {
            Some(created) => created,
            None => {
                return Err(crate::database::DatabaseError::Any(anyhow::anyhow!(
                    "This mount does not have a server attached"
                )));
            }
        };
        let server = match self.server {
            Some(server) => server.fetch_cached(&state.database).await?,
            None => {
                return Err(crate::database::DatabaseError::Any(anyhow::anyhow!(
                    "This mount does not have a server attached"
                )));
            }
        };

        Ok(AdminApiServerServerMount {
            server: server
                .into_admin_api_object(state, storage_url_retriever)
                .await?,
            created: created.and_utc(),
        })
    }
}

#[async_trait::async_trait]
impl IntoApiObject for ServerMount {
    type ApiObject = ApiServerMount;
    type ExtraArgs<'a> = ();

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::ApiObject, crate::database::DatabaseError> {
        let api_object = ApiServerMount::init_hooks(&self, state).await?;
        let mount = self.mount.fetch_cached(&state.database).await?;

        let api_object = finish_extendible!(
            ApiServerMount {
                uuid: mount.uuid,
                name: mount.name,
                description: mount.description,
                target: mount.target,
                read_only: mount.read_only,
                created: self.created.map(|dt| dt.and_utc()),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[async_trait::async_trait]
impl IntoAdminApiObject for ServerMount {
    type AdminApiObject = AdminApiServerMount;
    type ExtraArgs<'a> = ();

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiServerMount::init_hooks(&self, state).await?;
        let mount = self.mount.fetch_cached(&state.database).await?;

        let api_object = finish_extendible!(
            AdminApiServerMount {
                mount: mount.into_admin_api_object(state, ()).await?,
                created: self.created.map(|dt| dt.and_utc()),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[derive(Validate)]
pub struct CreateServerMountOptions {
    #[garde(skip)]
    pub server_uuid: uuid::Uuid,
    #[garde(skip)]
    pub mount_uuid: uuid::Uuid,
}

#[async_trait::async_trait]
impl CreatableModel for ServerMount {
    type CreateOptions<'a> = CreateServerMountOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<ServerMount>> =
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

        let mut query_builder = InsertQueryBuilder::new("server_mounts");

        Self::run_create_handlers(&mut options, &mut query_builder, state, &mut transaction)
            .await?;

        query_builder
            .set("server_uuid", options.server_uuid)
            .set("mount_uuid", options.mount_uuid);

        query_builder.execute(&mut *transaction).await?;

        transaction.commit().await?;

        Self::by_server_uuid_mount_uuid(&state.database, options.server_uuid, options.mount_uuid)
            .await?
            .ok_or(sqlx::Error::RowNotFound.into())
    }
}

#[async_trait::async_trait]
impl DeletableModel for ServerMount {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteListenerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteListenerList<ServerMount>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &DELETE_LISTENERS
    }

    async fn delete(
        &self,
        state: &crate::State,
        options: Self::DeleteOptions,
    ) -> Result<(), anyhow::Error> {
        let server_uuid = match &self.server {
            Some(server) => server.uuid,
            None => {
                return Err(anyhow::anyhow!(
                    "This server mount does not have a server attached, cannot delete"
                ));
            }
        };

        let mut transaction = state.database.write().begin().await?;

        self.run_delete_handlers(&options, state, &mut transaction)
            .await?;

        sqlx::query(
            r#"
            DELETE FROM server_mounts
            WHERE server_mounts.server_uuid = $1 AND server_mounts.mount_uuid = $2
            "#,
        )
        .bind(server_uuid)
        .bind(self.mount.uuid)
        .execute(&mut *transaction)
        .await?;

        transaction.commit().await?;

        Ok(())
    }
}

#[schema_extension_derive::extendible]
#[init_args(ServerMount, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "ServerMount")]
pub struct ApiServerMount {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,

    pub target: compact_str::CompactString,
    pub read_only: bool,

    pub created: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(ToSchema, Serialize)]
#[schema(title = "AdminServerServerMount")]
pub struct AdminApiServerServerMount {
    pub server: super::server::AdminApiServer,

    pub created: chrono::DateTime<chrono::Utc>,
}

#[schema_extension_derive::extendible]
#[init_args(ServerMount, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "AdminServerMount")]
pub struct AdminApiServerMount {
    pub mount: super::mount::AdminApiMount,

    pub created: Option<chrono::DateTime<chrono::Utc>>,
}
