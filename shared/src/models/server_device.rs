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
pub struct ServerDevice {
    pub device: Fetchable<super::device::Device>,
    pub server: Option<Fetchable<super::server::Server>>,

    pub created: Option<chrono::NaiveDateTime>,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for ServerDevice {
    const NAME: &'static str = "server_device";

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
                "server_devices.device_uuid",
                compact_str::format_compact!("{prefix}device_uuid"),
            ),
            (
                "server_devices.server_uuid",
                compact_str::format_compact!("{prefix}server_uuid"),
            ),
            (
                "server_devices.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ])
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            device: super::device::Device::get_fetchable(
                row.try_get(compact_str::format_compact!("{prefix}device_uuid").as_str())
                    .or_else(|_| row.try_get("alt_device_uuid"))?,
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

impl ServerDevice {
    pub async fn by_server_uuid_device_uuid(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
        device_uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM server_devices
            WHERE server_devices.server_uuid = $1 AND server_devices.device_uuid = $2
            "#,
            Self::columns_sql(None)
        )))
        .bind(server_uuid)
        .bind(device_uuid)
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
                FROM server_devices
                JOIN devices ON devices.uuid = server_devices.device_uuid
                WHERE server_devices.server_uuid = $1 AND {search}
                "#,
                search = super::search_sql(2, &["devices.name"], &["devices.uuid"]),
            ),
            "server_devices.device_uuid ASC",
        )
        .bind(server_uuid)
        .bind(search)
        .fetch(database, page, per_page)
        .await
    }

    pub async fn available_by_server_with_pagination(
        database: &crate::database::Database,
        server: &super::server::Server,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        super::PaginatedQueryBuilder::new(
            format!("{}, devices.uuid AS alt_device_uuid", Self::columns_sql(None)),
            format!(
                r#"
                FROM devices
                JOIN node_devices ON devices.uuid = node_devices.device_uuid AND node_devices.node_uuid = $1
                JOIN nest_egg_devices ON devices.uuid = nest_egg_devices.device_uuid AND nest_egg_devices.egg_uuid = $2
                LEFT JOIN server_devices ON server_devices.device_uuid = devices.uuid AND server_devices.server_uuid = $3
                WHERE {search}
                "#,
                search = super::search_sql(4, &["devices.name"], &["devices.uuid"]),
            ),
            "devices.created, devices.uuid",
        )
        .bind(server.node.uuid)
        .bind(server.egg.uuid)
        .bind(server.uuid)
        .bind(search)
        .fetch(database, page, per_page)
        .await
    }

    pub async fn attachable_by_server_with_pagination(
        database: &crate::database::Database,
        server: &super::server::Server,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        super::PaginatedQueryBuilder::new(
            format!("{}, devices.uuid AS alt_device_uuid", Self::columns_sql(None)),
            format!(
                r#"
                FROM devices
                JOIN node_devices ON devices.uuid = node_devices.device_uuid AND node_devices.node_uuid = $1
                JOIN nest_egg_devices ON devices.uuid = nest_egg_devices.device_uuid AND nest_egg_devices.egg_uuid = $2
                LEFT JOIN server_devices ON server_devices.device_uuid = devices.uuid AND server_devices.server_uuid = $3
                WHERE devices.user_attachable = TRUE AND {search}
                "#,
                search = super::search_sql(4, &["devices.name"], &["devices.uuid"]),
            ),
            "devices.created, devices.uuid",
        )
        .bind(server.node.uuid)
        .bind(server.egg.uuid)
        .bind(server.uuid)
        .bind(search)
        .fetch(database, page, per_page)
        .await
    }

    pub async fn by_device_uuid_with_pagination(
        database: &crate::database::Database,
        device_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        super::PaginatedQueryBuilder::new(
            Self::columns_sql(None),
            format!(
                r#"
                FROM server_devices
                JOIN servers ON servers.uuid = server_devices.server_uuid
                WHERE server_devices.device_uuid = $1 AND {search}
                "#,
                search = super::search_sql(2, &["servers.name"], &["servers.uuid"]),
            ),
            "server_devices.created, server_devices.server_uuid",
        )
        .bind(device_uuid)
        .bind(search)
        .fetch(database, page, per_page)
        .await
    }

    pub async fn into_admin_server_api_object(
        self,
        state: &crate::State,
        storage_url_retriever: &StorageUrlRetriever<'_>,
    ) -> Result<AdminApiServerServerDevice, crate::database::DatabaseError> {
        let created = match self.created {
            Some(created) => created,
            None => {
                return Err(crate::database::DatabaseError::Any(anyhow::anyhow!(
                    "This device does not have a server attached"
                )));
            }
        };
        let server = match self.server {
            Some(server) => server.fetch_cached(&state.database).await?,
            None => {
                return Err(crate::database::DatabaseError::Any(anyhow::anyhow!(
                    "This device does not have a server attached"
                )));
            }
        };

        Ok(AdminApiServerServerDevice {
            server: server
                .into_admin_api_object(state, storage_url_retriever)
                .await?,
            created: created.and_utc(),
        })
    }
}

#[async_trait::async_trait]
impl IntoApiObject for ServerDevice {
    type ApiObject = ApiServerDevice;
    type ExtraArgs<'a> = ();

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::ApiObject, crate::database::DatabaseError> {
        let api_object = ApiServerDevice::init_hooks(&self, state).await?;
        let device = self.device.fetch_cached(&state.database).await?;

        let api_object = finish_extendible!(
            ApiServerDevice {
                uuid: device.uuid,
                name: device.name,
                description: device.description,
                target: device.target,
                permissions: device.permissions,
                created: self.created.map(|dt| dt.and_utc()),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[async_trait::async_trait]
impl IntoAdminApiObject for ServerDevice {
    type AdminApiObject = AdminApiServerDevice;
    type ExtraArgs<'a> = ();

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiServerDevice::init_hooks(&self, state).await?;
        let device = self.device.fetch_cached(&state.database).await?;

        let api_object = finish_extendible!(
            AdminApiServerDevice {
                device: device.into_admin_api_object(state, ()).await?,
                created: self.created.map(|dt| dt.and_utc()),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[derive(Validate)]
pub struct CreateServerDeviceOptions {
    #[garde(skip)]
    pub server_uuid: uuid::Uuid,
    #[garde(skip)]
    pub device_uuid: uuid::Uuid,
}

#[async_trait::async_trait]
impl CreatableModel for ServerDevice {
    type CreateOptions<'a> = CreateServerDeviceOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<ServerDevice>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create_with_transaction(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        super::device::Device::by_uuid_optional_cached(&state.database, options.device_uuid)
            .await?
            .ok_or(crate::database::InvalidRelationError("device"))?;

        let mut query_builder = InsertQueryBuilder::new("server_devices");

        Self::run_create_handlers(&mut options, &mut query_builder, state, transaction).await?;

        query_builder
            .set("server_uuid", options.server_uuid)
            .set("device_uuid", options.device_uuid);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut **transaction)
            .await?;
        let mut server_device = Self::map(None, &row)?;

        Self::run_after_create_handlers(&mut server_device, &options, state, transaction).await?;

        Ok(server_device)
    }
}

#[async_trait::async_trait]
impl DeletableModel for ServerDevice {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteHandlerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteHandlerList<ServerDevice>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &DELETE_LISTENERS
    }

    async fn delete_with_transaction(
        &self,
        state: &crate::State,
        options: Self::DeleteOptions,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<(), anyhow::Error> {
        let server_uuid = match &self.server {
            Some(server) => server.uuid,
            None => {
                return Err(anyhow::anyhow!(
                    "This server device does not have a server attached, cannot delete"
                ));
            }
        };

        self.run_delete_handlers(&options, state, transaction)
            .await?;

        sqlx::query(
            r#"
            DELETE FROM server_devices
            WHERE server_devices.server_uuid = $1 AND server_devices.device_uuid = $2
            "#,
        )
        .bind(server_uuid)
        .bind(self.device.uuid)
        .execute(&mut **transaction)
        .await?;

        self.run_after_delete_handlers(&options, state, transaction)
            .await?;

        Ok(())
    }
}

#[schema_extension_derive::extendible]
#[init_args(ServerDevice, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "ServerDevice")]
pub struct ApiServerDevice {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,

    pub target: compact_str::CompactString,
    pub permissions: compact_str::CompactString,

    pub created: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(ToSchema, Serialize)]
#[schema(title = "AdminServerServerDevice")]
pub struct AdminApiServerServerDevice {
    pub server: super::server::AdminApiServer,

    pub created: chrono::DateTime<chrono::Utc>,
}

#[schema_extension_derive::extendible]
#[init_args(ServerDevice, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "AdminServerDevice")]
pub struct AdminApiServerDevice {
    pub device: super::device::AdminApiDevice,

    pub created: Option<chrono::DateTime<chrono::Utc>>,
}
