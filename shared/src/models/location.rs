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
pub struct Location {
    pub uuid: uuid::Uuid,
    pub backup_configuration: Option<Fetchable<super::backup_configuration::BackupConfiguration>>,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for Location {
    const NAME: &'static str = "location";

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
                "locations.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "locations.backup_configuration_uuid",
                compact_str::format_compact!("{prefix}location_backup_configuration_uuid"),
            ),
            (
                "locations.name",
                compact_str::format_compact!("{prefix}name"),
            ),
            (
                "locations.description",
                compact_str::format_compact!("{prefix}description"),
            ),
            (
                "locations.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ])
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            uuid: row.try_get(compact_str::format_compact!("{prefix}uuid").as_str())?,
            backup_configuration:
                super::backup_configuration::BackupConfiguration::get_fetchable_from_row(
                    row,
                    compact_str::format_compact!("{prefix}location_backup_configuration_uuid"),
                ),
            name: row.try_get(compact_str::format_compact!("{prefix}name").as_str())?,
            description: row
                .try_get(compact_str::format_compact!("{prefix}description").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl Location {
    pub async fn by_backup_configuration_uuid_with_pagination(
        database: &crate::database::Database,
        backup_configuration_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(&format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM locations
            WHERE locations.backup_configuration_uuid = $1 AND ($2 IS NULL OR locations.name ILIKE '%' || $2 || '%')
            ORDER BY locations.created
            LIMIT $3 OFFSET $4
            "#,
            Self::columns_sql(None)
        ))
        .bind(backup_configuration_uuid)
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
            FROM locations
            WHERE $1 IS NULL OR locations.name ILIKE '%' || $1 || '%'
            ORDER BY locations.created
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
impl IntoAdminApiObject for Location {
    type AdminApiObject = AdminApiLocation;
    type ExtraArgs<'a> = ();

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiLocation::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            AdminApiLocation {
                uuid: self.uuid,
                backup_configuration: if let Some(backup_configuration) = self.backup_configuration
                {
                    if let Ok(backup_configuration) =
                        backup_configuration.fetch_cached(&state.database).await
                    {
                        backup_configuration
                            .into_admin_api_object(state, ())
                            .await
                            .ok()
                    } else {
                        None
                    }
                } else {
                    None
                },
                name: self.name,
                description: self.description,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[async_trait::async_trait]
impl ByUuid for Location {
    async fn by_uuid(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
    ) -> Result<Self, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM locations
            WHERE locations.uuid = $1
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
pub struct CreateLocationOptions {
    #[garde(skip)]
    pub backup_configuration_uuid: Option<uuid::Uuid>,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: compact_str::CompactString,
    #[garde(length(chars, min = 1, max = 1024))]
    #[schema(min_length = 1, max_length = 1024)]
    pub description: Option<compact_str::CompactString>,
}

#[async_trait::async_trait]
impl CreatableModel for Location {
    type CreateOptions<'a> = CreateLocationOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<Location>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        if let Some(backup_configuration_uuid) = &options.backup_configuration_uuid {
            super::backup_configuration::BackupConfiguration::by_uuid_optional_cached(
                &state.database,
                *backup_configuration_uuid,
            )
            .await?
            .ok_or(crate::database::InvalidRelationError(
                "backup_configuration",
            ))?;
        }

        let mut transaction = state.database.write().begin().await?;

        let mut query_builder = InsertQueryBuilder::new("locations");

        Self::run_create_handlers(&mut options, &mut query_builder, state, &mut transaction)
            .await?;

        query_builder
            .set(
                "backup_configuration_uuid",
                options.backup_configuration_uuid,
            )
            .set("name", &options.name)
            .set("description", &options.description);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut *transaction)
            .await?;
        let location = Self::map(None, &row)?;

        transaction.commit().await?;

        Ok(location)
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Clone, Default)]
pub struct UpdateLocationOptions {
    #[garde(skip)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub backup_configuration_uuid: Option<Option<uuid::Uuid>>,
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
}

#[async_trait::async_trait]
impl UpdatableModel for Location {
    type UpdateOptions = UpdateLocationOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateListenerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateListenerList<Location>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &UPDATE_LISTENERS
    }

    async fn update(
        &mut self,
        state: &crate::State,
        mut options: Self::UpdateOptions,
    ) -> Result<(), crate::database::DatabaseError> {
        options.validate()?;

        let backup_configuration =
            if let Some(backup_configuration_uuid) = &options.backup_configuration_uuid {
                match backup_configuration_uuid {
                    Some(uuid) => {
                        super::backup_configuration::BackupConfiguration::by_uuid_optional_cached(
                            &state.database,
                            *uuid,
                        )
                        .await?
                        .ok_or(crate::database::InvalidRelationError(
                            "backup_configuration",
                        ))?;

                        Some(Some(
                            super::backup_configuration::BackupConfiguration::get_fetchable(*uuid),
                        ))
                    }
                    None => Some(None),
                }
            } else {
                None
            };

        let mut transaction = state.database.write().begin().await?;

        let mut query_builder = UpdateQueryBuilder::new("locations");

        Self::run_update_handlers(
            self,
            &mut options,
            &mut query_builder,
            state,
            &mut transaction,
        )
        .await?;

        query_builder
            .set(
                "backup_configuration_uuid",
                options
                    .backup_configuration_uuid
                    .as_ref()
                    .map(|u| u.as_ref()),
            )
            .set("name", options.name.as_ref())
            .set(
                "description",
                options.description.as_ref().map(|d| d.as_ref()),
            )
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut *transaction).await?;

        if let Some(backup_configuration) = backup_configuration {
            self.backup_configuration = backup_configuration;
        }
        if let Some(name) = options.name {
            self.name = name;
        }
        if let Some(description) = options.description {
            self.description = description;
        }

        transaction.commit().await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl DeletableModel for Location {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteListenerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteListenerList<Location>> =
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
            DELETE FROM locations
            WHERE locations.uuid = $1
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
#[init_args(Location, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "Location")]
pub struct AdminApiLocation {
    pub uuid: uuid::Uuid,
    pub backup_configuration: Option<super::backup_configuration::AdminApiBackupConfiguration>,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,

    pub created: chrono::DateTime<chrono::Utc>,
}
