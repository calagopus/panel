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

pub fn validate_config_allocations(
    config_allocations: &EggConfigAllocations,
    _context: &(),
) -> Result<(), garde::Error> {
    if !config_allocations.user_self_assign.is_valid() {
        return Err(garde::Error::new(
            "port ranges must be 1024-65535 and start_port < end_port",
        ));
    }

    Ok(())
}

#[derive(ToSchema, Serialize, Deserialize, Clone, Copy)]
pub struct EggConfigAllocationsUserSelfAssign {
    pub enabled: bool,
    pub require_primary_allocation: bool,

    pub start_port: u16,
    pub end_port: u16,
}

impl Default for EggConfigAllocationsUserSelfAssign {
    fn default() -> Self {
        Self {
            enabled: false,
            require_primary_allocation: true,
            start_port: 49152,
            end_port: 65535,
        }
    }
}

impl EggConfigAllocationsUserSelfAssign {
    #[inline]
    pub fn is_valid(&self) -> bool {
        self.start_port < self.end_port && self.start_port >= 1024
    }
}

#[derive(ToSchema, Validate, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum EggConfigAllocationDeploymentAdditionalAllocationMode {
    Random,
    Range {
        #[garde(range(min = 1024, max = 65535))]
        start_port: u16,
        #[garde(range(min = 1024, max = 65535))]
        end_port: u16,
    },
    AddPrimary {
        #[garde(skip)]
        value: u16,
    },
    SubtractPrimary {
        #[garde(skip)]
        value: u16,
    },
    MultiplyPrimary {
        #[garde(skip)]
        value: f64,
    },
    DividePrimary {
        #[garde(skip)]
        value: f64,
    },
}

#[derive(ToSchema, Validate, Serialize, Deserialize, Clone)]
pub struct EggConfigAllocationDeploymentAdditionalAllocation {
    #[schema(inline)]
    #[garde(dive)]
    pub mode: EggConfigAllocationDeploymentAdditionalAllocationMode,
    #[garde(length(chars, min = 1, max = 255))]
    pub assign_to_variable: Option<compact_str::CompactString>,
}

#[derive(ToSchema, Validate, Serialize, Deserialize, Clone)]
pub struct EggConfigAllocationDeploymentPrimaryAllocation {
    #[garde(range(min = 1024, max = 65535))]
    pub start_port: u16,
    #[garde(range(min = 1024, max = 65535))]
    pub end_port: u16,

    #[garde(length(chars, min = 1, max = 255))]
    pub assign_to_variable: Option<compact_str::CompactString>,
}

#[derive(ToSchema, Validate, Serialize, Deserialize, Default, Clone)]
pub struct EggConfigAllocationsDeployment {
    #[garde(skip)]
    pub dedicated: bool,

    #[schema(inline)]
    #[garde(dive)]
    pub primary: Option<EggConfigAllocationDeploymentPrimaryAllocation>,
    #[schema(inline)]
    #[garde(dive)]
    pub additional: Vec<EggConfigAllocationDeploymentAdditionalAllocation>,
}

#[derive(ToSchema, Serialize, Deserialize, Default, Clone)]
pub struct EggConfigAllocations {
    #[serde(default)]
    pub user_self_assign: EggConfigAllocationsUserSelfAssign,
    #[serde(default)]
    pub deployment: EggConfigAllocationsDeployment,
}

#[derive(ToSchema, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum EggConfigRoutesRouteItem {
    Route {
        path: compact_str::CompactString,
    },
    Divider {
        name: Option<compact_str::CompactString>,
        name_translations: BTreeMap<compact_str::CompactString, compact_str::CompactString>,
    },
    Redirect {
        name: compact_str::CompactString,
        name_translations: BTreeMap<compact_str::CompactString, compact_str::CompactString>,
        destination: compact_str::CompactString,
    },
}

#[derive(ToSchema, Validate, Serialize, Deserialize, Default, Clone)]
pub struct EggConfigRoutes {
    #[garde(length(max = 100))]
    #[schema(max_length = 100)]
    pub order: Vec<EggConfigRoutesRouteItem>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct EggConfiguration {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,
    pub order: i16,

    pub eggs: Vec<uuid::Uuid>,

    pub config_allocations: Option<EggConfigAllocations>,
    pub config_routes: Option<EggConfigRoutes>,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for EggConfiguration {
    const NAME: &'static str = "egg_configuration";

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
                "egg_configurations.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "egg_configurations.name",
                compact_str::format_compact!("{prefix}name"),
            ),
            (
                "egg_configurations.description",
                compact_str::format_compact!("{prefix}description"),
            ),
            (
                "egg_configurations.order_",
                compact_str::format_compact!("{prefix}order_"),
            ),
            (
                "egg_configurations.eggs",
                compact_str::format_compact!("{prefix}eggs"),
            ),
            (
                "egg_configurations.config_allocations",
                compact_str::format_compact!("{prefix}config_allocations"),
            ),
            (
                "egg_configurations.config_routes",
                compact_str::format_compact!("{prefix}config_routes"),
            ),
            (
                "egg_configurations.created",
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
            order: row.try_get(compact_str::format_compact!("{prefix}order_").as_str())?,
            eggs: row.try_get(compact_str::format_compact!("{prefix}eggs").as_str())?,
            config_allocations: row
                .try_get::<Option<serde_json::Value>, _>(
                    compact_str::format_compact!("{prefix}config_allocations").as_str(),
                )?
                .and_then(|v| serde_json::from_value(v).ok()),
            config_routes: row
                .try_get::<Option<serde_json::Value>, _>(
                    compact_str::format_compact!("{prefix}config_routes").as_str(),
                )?
                .and_then(|v| serde_json::from_value(v).ok()),
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl EggConfiguration {
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
            FROM egg_configurations
            WHERE ($1 IS NULL OR egg_configurations.name ILIKE '%' || $1 || '%')
            ORDER BY egg_configurations.order_, egg_configurations.created
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

    pub async fn merged_by_egg_uuid(
        database: &crate::database::Database,
        egg_uuid: uuid::Uuid,
    ) -> Result<MergedEggConfiguration, crate::database::DatabaseError> {
        let rows = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM egg_configurations
            WHERE $1 = ANY(egg_configurations.eggs)
            ORDER BY egg_configurations.order_, egg_configurations.created
            "#,
            Self::columns_sql(None)
        ))
        .bind(egg_uuid)
        .fetch_all(database.read())
        .await?;

        let rows = rows
            .into_iter()
            .map(|row| Self::map(None, &row))
            .try_collect_vec()?;

        let mut base = MergedEggConfiguration {
            config_allocations: None,
            config_routes: None,
        };

        for row in rows {
            if row.config_allocations.is_some() {
                base.config_allocations = row.config_allocations;
            }
            if row.config_routes.is_some() {
                base.config_routes = row.config_routes;
            }
        }

        Ok(base)
    }
}

#[async_trait::async_trait]
impl IntoAdminApiObject for EggConfiguration {
    type AdminApiObject = AdminApiEggConfiguration;
    type ExtraArgs<'a> = ();

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiEggConfiguration::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            AdminApiEggConfiguration {
                uuid: self.uuid,
                name: self.name,
                description: self.description,
                order: self.order,
                eggs: self.eggs,
                config_allocations: self.config_allocations,
                config_routes: self.config_routes,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[async_trait::async_trait]
impl ByUuid for EggConfiguration {
    async fn by_uuid(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
    ) -> Result<Self, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM egg_configurations
            WHERE egg_configurations.uuid = $1
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
pub struct CreateEggConfigurationOptions {
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: compact_str::CompactString,
    #[garde(length(chars, min = 1, max = 1024))]
    #[schema(min_length = 1, max_length = 1024)]
    pub description: Option<compact_str::CompactString>,
    #[garde(skip)]
    pub order: i16,
    #[garde(length(max = 100))]
    #[schema(max_length = 100)]
    pub eggs: Vec<uuid::Uuid>,
    #[garde(inner(custom(validate_config_allocations)))]
    #[schema(inline)]
    pub config_allocations: Option<EggConfigAllocations>,
    #[garde(dive)]
    #[schema(inline)]
    pub config_routes: Option<EggConfigRoutes>,
}

#[async_trait::async_trait]
impl CreatableModel for EggConfiguration {
    type CreateOptions<'a> = CreateEggConfigurationOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<EggConfiguration>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        let mut transaction = state.database.write().begin().await?;

        let mut query_builder = InsertQueryBuilder::new("egg_configurations");

        Self::run_create_handlers(&mut options, &mut query_builder, state, &mut transaction)
            .await?;

        query_builder
            .set("name", &options.name)
            .set("description", &options.description)
            .set("order_", options.order)
            .set("eggs", options.eggs)
            .set(
                "config_allocations",
                options
                    .config_allocations
                    .as_ref()
                    .map(serde_json::to_value)
                    .transpose()?,
            )
            .set(
                "config_routes",
                options
                    .config_routes
                    .as_ref()
                    .map(serde_json::to_value)
                    .transpose()?,
            );

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut *transaction)
            .await?;
        let egg_configuration = Self::map(None, &row)?;

        transaction.commit().await?;

        Ok(egg_configuration)
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Clone, Default)]
pub struct UpdateEggConfigurationOptions {
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
    pub order: Option<i16>,
    #[garde(length(max = 100))]
    #[schema(max_length = 100)]
    pub eggs: Option<Vec<uuid::Uuid>>,

    #[garde(inner(inner(custom(validate_config_allocations))))]
    #[schema(inline)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub config_allocations: Option<Option<EggConfigAllocations>>,
    #[garde(dive)]
    #[schema(inline)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub config_routes: Option<Option<EggConfigRoutes>>,
}

#[async_trait::async_trait]
impl UpdatableModel for EggConfiguration {
    type UpdateOptions = UpdateEggConfigurationOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateListenerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateListenerList<EggConfiguration>> =
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

        let mut query_builder = UpdateQueryBuilder::new("egg_configurations");

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
            .set("order_", options.order)
            .set("eggs", options.eggs.as_ref())
            .set(
                "config_allocations",
                options
                    .config_allocations
                    .as_ref()
                    .map(|c| c.as_ref().map(serde_json::to_value).transpose())
                    .transpose()?,
            )
            .set(
                "config_routes",
                options
                    .config_routes
                    .as_ref()
                    .map(|c| c.as_ref().map(serde_json::to_value).transpose())
                    .transpose()?,
            )
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut *transaction).await?;

        if let Some(name) = options.name {
            self.name = name;
        }
        if let Some(description) = options.description {
            self.description = description;
        }
        if let Some(order) = options.order {
            self.order = order;
        }
        if let Some(eggs) = options.eggs {
            self.eggs = eggs;
        }
        if let Some(config_allocations) = options.config_allocations {
            self.config_allocations = config_allocations;
        }
        if let Some(config_routes) = options.config_routes {
            self.config_routes = config_routes;
        }

        transaction.commit().await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl DeletableModel for EggConfiguration {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteListenerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteListenerList<EggConfiguration>> =
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
            DELETE FROM egg_configurations
            WHERE egg_configurations.uuid = $1
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
#[init_args(EggConfiguration, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "AdminEggConfiguration")]
pub struct AdminApiEggConfiguration {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,
    pub order: i16,

    pub eggs: Vec<uuid::Uuid>,

    #[schema(inline)]
    pub config_allocations: Option<EggConfigAllocations>,
    #[schema(inline)]
    pub config_routes: Option<EggConfigRoutes>,

    pub created: chrono::DateTime<chrono::Utc>,
}

#[derive(Deserialize, Serialize)]
pub struct MergedEggConfiguration {
    pub config_allocations: Option<EggConfigAllocations>,
    pub config_routes: Option<EggConfigRoutes>,
}

impl MergedEggConfiguration {}

#[async_trait::async_trait]
impl IntoApiObject for MergedEggConfiguration {
    type ApiObject = ApiEggConfiguration;
    type ExtraArgs<'a> = ();

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::ApiObject, crate::database::DatabaseError> {
        let api_object = ApiEggConfiguration::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            ApiEggConfiguration {
                allocation_self_assign_enabled: self
                    .config_allocations
                    .as_ref()
                    .is_some_and(|c| c.user_self_assign.enabled),
                allocation_self_assign_require_primary: self
                    .config_allocations
                    .as_ref()
                    .is_some_and(|c| c.user_self_assign.require_primary_allocation),
                route_order: self.config_routes.map(|c| c.order),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[schema_extension_derive::extendible]
#[init_args(MergedEggConfiguration, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "NestEggConfiguration")]
pub struct ApiEggConfiguration {
    pub allocation_self_assign_enabled: bool,
    pub allocation_self_assign_require_primary: bool,
    pub route_order: Option<Vec<EggConfigRoutesRouteItem>>,
}
