use crate::{models::InsertQueryBuilder, prelude::*};
use garde::Validate;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{
    collections::BTreeMap,
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, Clone)]
pub struct LocationDatabaseHost {
    pub location: Fetchable<super::location::Location>,
    pub database_host: super::database_host::DatabaseHost,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for LocationDatabaseHost {
    const NAME: &'static str = "location_database_host";

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
                "location_database_hosts.location_uuid",
                compact_str::format_compact!("{prefix}location_uuid"),
            ),
            (
                "location_database_hosts.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ]);

        columns.extend(super::database_host::DatabaseHost::base_columns(Some(
            "database_host_",
        )));

        columns
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            location: super::location::Location::get_fetchable(
                row.try_get(compact_str::format_compact!("{prefix}location_uuid").as_str())?,
            ),
            database_host: super::database_host::DatabaseHost::map(Some("database_host_"), row)?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl LocationDatabaseHost {
    pub async fn by_location_uuid_database_host_uuid(
        database: &crate::database::Database,
        location_uuid: uuid::Uuid,
        database_host_uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM location_database_hosts
            JOIN database_hosts ON location_database_hosts.database_host_uuid = database_hosts.uuid
            WHERE location_database_hosts.location_uuid = $1 AND location_database_hosts.database_host_uuid = $2
            "#,
            Self::columns_sql(None)
        )))
        .bind(location_uuid)
        .bind(database_host_uuid)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn by_location_uuid_database_host_uuid_with_transaction(
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        location_uuid: uuid::Uuid,
        database_host_uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM location_database_hosts
            JOIN database_hosts ON location_database_hosts.database_host_uuid = database_hosts.uuid
            WHERE location_database_hosts.location_uuid = $1 AND location_database_hosts.database_host_uuid = $2
            "#,
            Self::columns_sql(None)
        )))
        .bind(location_uuid)
        .bind(database_host_uuid)
        .fetch_optional(&mut **transaction)
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn by_location_uuid_with_pagination(
        database: &crate::database::Database,
        location_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM location_database_hosts
            JOIN database_hosts ON location_database_hosts.database_host_uuid = database_hosts.uuid
            WHERE location_database_hosts.location_uuid = $1 AND ($2 IS NULL OR database_hosts.name ILIKE '%' || $2 || '%')
            ORDER BY location_database_hosts.created
            LIMIT $3 OFFSET $4
            "#,
            Self::columns_sql(None)
        )))
        .bind(location_uuid)
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

    pub async fn all_public_by_location_uuid(
        database: &crate::database::Database,
        location_uuid: uuid::Uuid,
    ) -> Result<Vec<Self>, crate::database::DatabaseError> {
        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM location_database_hosts
            JOIN database_hosts ON location_database_hosts.database_host_uuid = database_hosts.uuid
            WHERE location_database_hosts.location_uuid = $1 AND database_hosts.deployment_enabled
            ORDER BY location_database_hosts.created DESC
            "#,
            Self::columns_sql(None)
        )))
        .bind(location_uuid)
        .fetch_all(database.read())
        .await?;

        rows.into_iter()
            .map(|row| Self::map(None, &row))
            .try_collect_vec()
    }
}

#[async_trait::async_trait]
impl IntoAdminApiObject for LocationDatabaseHost {
    type AdminApiObject = AdminApiLocationDatabaseHost;
    type ExtraArgs<'a> = ();

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiLocationDatabaseHost::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            AdminApiLocationDatabaseHost {
                database_host: self.database_host.into_admin_api_object(state, ()).await?,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[derive(ToSchema, Deserialize, Validate)]
pub struct CreateLocationDatabaseHostOptions {
    #[garde(skip)]
    pub location_uuid: uuid::Uuid,
    #[garde(skip)]
    pub database_host_uuid: uuid::Uuid,
}

#[async_trait::async_trait]
impl CreatableModel for LocationDatabaseHost {
    type CreateOptions<'a> = CreateLocationDatabaseHostOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<LocationDatabaseHost>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create_with_transaction(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        super::database_host::DatabaseHost::by_uuid_optional_cached(
            &state.database,
            options.database_host_uuid,
        )
        .await?
        .ok_or(crate::database::InvalidRelationError("database_host"))?;

        let mut query_builder = InsertQueryBuilder::new("location_database_hosts");

        Self::run_create_handlers(&mut options, &mut query_builder, state, transaction).await?;

        query_builder
            .set("location_uuid", options.location_uuid)
            .set("database_host_uuid", options.database_host_uuid);

        query_builder.execute(&mut **transaction).await?;

        let mut result = match Self::by_location_uuid_database_host_uuid_with_transaction(
            transaction,
            options.location_uuid,
            options.database_host_uuid,
        )
        .await?
        {
            Some(location_database_host) => location_database_host,
            None => return Err(sqlx::Error::RowNotFound.into()),
        };

        Self::run_after_create_handlers(&mut result, &options, state, transaction).await?;

        Ok(result)
    }
}

#[async_trait::async_trait]
impl DeletableModel for LocationDatabaseHost {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteHandlerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteHandlerList<LocationDatabaseHost>> =
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
            DELETE FROM location_database_hosts
            WHERE location_database_hosts.location_uuid = $1 AND location_database_hosts.database_host_uuid = $2
            "#,
        )
        .bind(self.location.uuid)
        .bind(self.database_host.uuid)
        .execute(&mut **transaction)
        .await?;

        self.run_after_delete_handlers(&options, state, transaction)
            .await?;

        Ok(())
    }
}

#[schema_extension_derive::extendible]
#[init_args(LocationDatabaseHost, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "LocationDatabaseHost")]
pub struct AdminApiLocationDatabaseHost {
    pub database_host: super::database_host::AdminApiDatabaseHost,

    pub created: chrono::DateTime<chrono::Utc>,
}
