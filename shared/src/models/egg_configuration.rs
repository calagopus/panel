use crate::{
    models::{InsertQueryBuilder, UpdateQueryBuilder},
    prelude::*,
};
use garde::Validate;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{
    collections::{BTreeMap, HashSet},
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

fn validate_user_self_assign(
    user_self_assign: &EggConfigAllocationsUserSelfAssign,
    _context: &(),
) -> Result<(), garde::Error> {
    if !user_self_assign.is_valid() {
        return Err(garde::Error::new(
            "port ranges must be 1-65535 and start_port < end_port",
        ));
    }

    Ok(())
}

fn validate_primary_allocation(
    primary: &Option<EggConfigAllocationDeploymentPrimaryAllocation>,
    _context: &(),
) -> Result<(), garde::Error> {
    if let Some(primary) = primary
        && primary.start_port > primary.end_port
    {
        return Err(garde::Error::new("start_port must be <= end_port"));
    }

    Ok(())
}

fn validate_additional_allocation_mode(
    mode: &EggConfigAllocationDeploymentAdditionalAllocationMode,
    _context: &(),
) -> Result<(), garde::Error> {
    if let EggConfigAllocationDeploymentAdditionalAllocationMode::Range {
        start_port,
        end_port,
    } = mode
        && start_port > end_port
    {
        return Err(garde::Error::new("start_port must be <= end_port"));
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
        self.start_port < self.end_port && self.start_port >= 1
    }
}

#[derive(ToSchema, Validate, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum EggConfigAllocationDeploymentAdditionalAllocationMode {
    Random,
    Range {
        #[garde(range(min = 1, max = 65535))]
        start_port: u16,
        #[garde(range(min = 1, max = 65535))]
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
    #[garde(dive, custom(validate_additional_allocation_mode))]
    pub mode: EggConfigAllocationDeploymentAdditionalAllocationMode,
    #[garde(length(chars, min = 1, max = 255))]
    pub assign_to_variable: Option<compact_str::CompactString>,
}

#[derive(ToSchema, Validate, Serialize, Deserialize, Clone)]
pub struct EggConfigAllocationDeploymentPrimaryAllocation {
    #[garde(range(min = 1, max = 65535))]
    pub start_port: u16,
    #[garde(range(min = 1, max = 65535))]
    pub end_port: u16,

    #[garde(length(chars, min = 1, max = 255))]
    pub assign_to_variable: Option<compact_str::CompactString>,
}

#[derive(ToSchema, Validate, Serialize, Deserialize, Default, Clone)]
pub struct EggConfigAllocationsDeployment {
    #[garde(skip)]
    pub dedicated: bool,

    #[schema(inline)]
    #[garde(dive, custom(validate_primary_allocation))]
    pub primary: Option<EggConfigAllocationDeploymentPrimaryAllocation>,
    #[schema(inline)]
    #[garde(dive)]
    pub additional: Vec<EggConfigAllocationDeploymentAdditionalAllocation>,
}

#[derive(ToSchema, Validate, Serialize, Deserialize, Default, Clone)]
pub struct EggConfigAllocations {
    #[garde(custom(validate_user_self_assign))]
    #[serde(default)]
    pub user_self_assign: EggConfigAllocationsUserSelfAssign,
    #[garde(dive)]
    #[serde(default)]
    pub deployment: EggConfigAllocationsDeployment,
}

#[derive(ToSchema, Validate, Serialize, Deserialize, Default, Clone)]
pub struct EggConfigStartup {
    #[garde(skip)]
    pub allow_custom_startup_command: bool,
}

#[derive(ToSchema, Validate, Serialize, Deserialize, Default, Clone)]
pub struct EggConfigRoutes {
    #[garde(length(max = 100), dive)]
    #[schema(max_length = 100)]
    pub order: Vec<crate::settings::RouteOrderItem>,
}

/// Unlike the other sections this one merges per field: `None` leaves the value of an earlier
/// configuration in place, so a broad configuration can disable a feature without a narrower one
/// having to repeat it.
#[derive(ToSchema, Validate, Serialize, Deserialize, Default, Clone, Copy)]
pub struct EggConfigFeatures {
    #[garde(skip)]
    #[serde(default)]
    pub firewall: Option<bool>,
    #[garde(skip)]
    #[serde(default)]
    pub private_network: Option<bool>,
}

#[derive(ToSchema, Validate, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
#[schema(no_recursion)]
pub enum EggConfigurationMatcher {
    Never,
    All,
    And {
        #[garde(dive)]
        matchers: Vec<EggConfigurationMatcher>,
    },
    Or {
        #[garde(dive)]
        matchers: Vec<EggConfigurationMatcher>,
    },
    Not {
        #[garde(dive)]
        matcher: Box<EggConfigurationMatcher>,
    },
    Eggs {
        #[garde(length(max = 100))]
        #[schema(max_length = 100)]
        eggs: Vec<uuid::Uuid>,
    },
    Nests {
        #[garde(length(max = 100))]
        #[schema(max_length = 100)]
        nests: Vec<uuid::Uuid>,
    },
    Nodes {
        #[garde(length(max = 100))]
        #[schema(max_length = 100)]
        nodes: Vec<uuid::Uuid>,
    },
    Locations {
        #[garde(length(max = 100))]
        #[schema(max_length = 100)]
        locations: Vec<uuid::Uuid>,
    },
}

impl EggConfigurationMatcher {
    pub const MAX_NESTING_DEPTH: usize = 3;

    fn nested_within_limit(&self, depth: usize) -> bool {
        match self {
            EggConfigurationMatcher::And { matchers }
            | EggConfigurationMatcher::Or { matchers } => {
                depth < Self::MAX_NESTING_DEPTH
                    && matchers.iter().all(|m| m.nested_within_limit(depth + 1))
            }
            EggConfigurationMatcher::Not { matcher } => {
                depth < Self::MAX_NESTING_DEPTH && matcher.nested_within_limit(depth + 1)
            }
            _ => true,
        }
    }

    pub fn validate_nesting(value: &Self, _context: &()) -> garde::Result {
        if value.nested_within_limit(0) {
            Ok(())
        } else {
            Err(garde::Error::new(format!(
                "matcher may not nest groups more than {} levels deep",
                Self::MAX_NESTING_DEPTH
            )))
        }
    }

    pub fn validate_optional_nesting(value: &Option<Self>, context: &()) -> garde::Result {
        match value {
            Some(matcher) => Self::validate_nesting(matcher, context),
            None => Ok(()),
        }
    }

    pub fn matches(&self, target: &EggConfigurationTarget) -> bool {
        match self {
            EggConfigurationMatcher::Never => false,
            EggConfigurationMatcher::All => true,
            EggConfigurationMatcher::And { matchers } => matchers.iter().all(|m| m.matches(target)),
            EggConfigurationMatcher::Or { matchers } => matchers.iter().any(|m| m.matches(target)),
            EggConfigurationMatcher::Not { matcher } => !matcher.matches(target),
            EggConfigurationMatcher::Eggs { eggs } => eggs.contains(&target.egg_uuid),
            EggConfigurationMatcher::Nests { nests } => nests.contains(&target.nest_uuid),
            EggConfigurationMatcher::Nodes { nodes } => nodes.contains(&target.node_uuid),
            EggConfigurationMatcher::Locations { locations } => {
                locations.contains(&target.location_uuid)
            }
        }
    }
}

#[derive(Clone, Copy)]
pub struct EggConfigurationTarget {
    pub egg_uuid: uuid::Uuid,
    pub nest_uuid: uuid::Uuid,
    pub node_uuid: uuid::Uuid,
    pub location_uuid: uuid::Uuid,
}

impl EggConfigurationTarget {
    pub fn new(egg: &super::nest_egg::NestEgg, node: &super::node::Node) -> Self {
        Self {
            egg_uuid: egg.uuid,
            nest_uuid: egg.nest.uuid,
            node_uuid: node.uuid,
            location_uuid: node.location.uuid,
        }
    }

    pub fn map(row: &PgRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            egg_uuid: row.try_get("egg_uuid")?,
            nest_uuid: row.try_get("nest_uuid")?,
            node_uuid: row.try_get("node_uuid")?,
            location_uuid: row.try_get("location_uuid")?,
        })
    }
}

/// Servers whose resolved configuration disables a feature, keyed by (egg, node) since that is
/// all a matcher can tell servers apart by.
#[derive(Default)]
pub struct DisabledFeatures {
    pub firewall: HashSet<(uuid::Uuid, uuid::Uuid)>,
    pub private_network: HashSet<(uuid::Uuid, uuid::Uuid)>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct EggConfiguration {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,
    pub order: i16,

    pub matcher: EggConfigurationMatcher,

    pub config_allocations: Option<EggConfigAllocations>,
    pub config_startup: Option<EggConfigStartup>,
    pub config_routes: Option<EggConfigRoutes>,
    pub config_features: Option<EggConfigFeatures>,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for EggConfiguration {
    const NAME: &'static str = "egg_configuration";

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
                "egg_configurations.matcher",
                compact_str::format_compact!("{prefix}matcher"),
            ),
            (
                "egg_configurations.config_allocations",
                compact_str::format_compact!("{prefix}config_allocations"),
            ),
            (
                "egg_configurations.config_startup",
                compact_str::format_compact!("{prefix}config_startup"),
            ),
            (
                "egg_configurations.config_routes",
                compact_str::format_compact!("{prefix}config_routes"),
            ),
            (
                "egg_configurations.config_features",
                compact_str::format_compact!("{prefix}config_features"),
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
            matcher: serde_json::from_value(
                row.try_get(compact_str::format_compact!("{prefix}matcher").as_str())?,
            )?,
            config_allocations: row
                .try_get::<Option<serde_json::Value>, _>(
                    compact_str::format_compact!("{prefix}config_allocations").as_str(),
                )?
                .and_then(|v| serde_json::from_value(v).ok()),
            config_startup: row
                .try_get::<Option<serde_json::Value>, _>(
                    compact_str::format_compact!("{prefix}config_startup").as_str(),
                )?
                .and_then(|v| serde_json::from_value(v).ok()),
            config_routes: row
                .try_get::<Option<serde_json::Value>, _>(
                    compact_str::format_compact!("{prefix}config_routes").as_str(),
                )?
                .and_then(|v| serde_json::from_value(v).ok()),
            config_features: row
                .try_get::<Option<serde_json::Value>, _>(
                    compact_str::format_compact!("{prefix}config_features").as_str(),
                )?
                .and_then(|v| serde_json::from_value(v).ok()),
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }

    fn cache_invalidation_keys(&self) -> Vec<compact_str::CompactString> {
        vec![
            compact_str::format_compact!("{}::{}", Self::NAME, self.uuid),
            Self::ALL_CACHE_KEY.into(),
            crate::icons::REFERENCED_ICONS_CACHE_KEY.into(),
        ]
    }
}

impl EggConfiguration {
    pub const ALL_CACHE_KEY: &'static str = "egg_configurations::all";

    pub async fn all_with_pagination(
        database: &crate::database::Database,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        super::PaginatedQueryBuilder::new(
            Self::columns_sql(None),
            format!(
                r#"
                FROM egg_configurations
                WHERE {search}
                "#,
                search = super::search_sql(
                    1,
                    &["egg_configurations.name"],
                    &["egg_configurations.uuid"]
                ),
            ),
            "egg_configurations.order_, egg_configurations.created, egg_configurations.uuid",
        )
        .bind(search)
        .fetch(database, page, per_page)
        .await
    }

    pub async fn all<'a>(
        executor: impl sqlx::PgExecutor<'a>,
    ) -> Result<Vec<Self>, crate::database::DatabaseError> {
        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM egg_configurations
            ORDER BY egg_configurations.order_, egg_configurations.created, egg_configurations.uuid
            "#,
            Self::columns_sql(None)
        )))
        .fetch_all(executor)
        .await?;

        rows.into_iter()
            .map(|row| Self::map(None, &row))
            .try_collect_vec()
    }

    pub async fn all_cached(
        database: &crate::database::Database,
    ) -> Result<Vec<Self>, anyhow::Error> {
        database
            .cache
            .cached(Self::ALL_CACHE_KEY, 60, || Self::all(database.read()))
            .await
    }

    async fn server_targets(
        database: &crate::database::Database,
    ) -> Result<Vec<EggConfigurationTarget>, crate::database::DatabaseError> {
        let rows = sqlx::query!(
            r#"
            SELECT DISTINCT
                servers.egg_uuid,
                nest_eggs.nest_uuid,
                servers.node_uuid,
                nodes.location_uuid
            FROM servers
            JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
            JOIN nodes ON nodes.uuid = servers.node_uuid
            "#
        )
        .fetch_all(database.write())
        .await?;

        Ok(rows
            .into_iter()
            .map(|row| EggConfigurationTarget {
                egg_uuid: row.egg_uuid,
                nest_uuid: row.nest_uuid,
                node_uuid: row.node_uuid,
                location_uuid: row.location_uuid,
            })
            .collect())
    }

    /// `configurations` must be in precedence order, as [`Self::all`] returns them.
    pub fn merge<'a>(
        configurations: impl IntoIterator<Item = &'a Self>,
        target: &EggConfigurationTarget,
    ) -> MergedEggConfiguration {
        let mut base = MergedEggConfiguration::default();

        for configuration in configurations {
            if !configuration.matcher.matches(target) {
                continue;
            }

            if configuration.config_allocations.is_some() {
                base.config_allocations = configuration.config_allocations.clone();
            }
            if configuration.config_startup.is_some() {
                base.config_startup = configuration.config_startup.clone();
            }
            if configuration.config_routes.is_some() {
                base.config_routes = configuration.config_routes.clone();
            }
            if let Some(features) = configuration.config_features {
                if features.firewall.is_some() {
                    base.config_features.firewall = features.firewall;
                }
                if features.private_network.is_some() {
                    base.config_features.private_network = features.private_network;
                }
            }
        }

        base
    }

    pub async fn merged_for_target(
        database: &crate::database::Database,
        target: &EggConfigurationTarget,
    ) -> Result<MergedEggConfiguration, anyhow::Error> {
        Ok(Self::merge(&Self::all_cached(database).await?, target))
    }
}

impl DisabledFeatures {
    fn from_targets(
        configurations: &[EggConfiguration],
        targets: &[EggConfigurationTarget],
    ) -> Self {
        let mut disabled = Self::default();
        for target in targets {
            let merged = EggConfiguration::merge(configurations, target);
            let pair = (target.egg_uuid, target.node_uuid);

            if !merged.firewall_enabled() {
                disabled.firewall.insert(pair);
            }
            if !merged.private_network_enabled() {
                disabled.private_network.insert(pair);
            }
        }

        disabled
    }

    pub async fn resolve(
        database: &crate::database::Database,
    ) -> Result<Self, crate::database::DatabaseError> {
        let configurations = EggConfiguration::all(database.write()).await?;
        if !configurations.iter().any(|c| c.config_features.is_some()) {
            return Ok(Self::default());
        }

        let targets = EggConfiguration::server_targets(database).await?;

        Ok(Self::from_targets(&configurations, &targets))
    }

    /// Takes the features resolved *before* a change and pushes whatever flipped since to the
    /// affected nodes. Logs instead of failing, since the change itself has already been made.
    pub async fn propagate(self, state: &crate::State) {
        if let Err(err) = self.propagate_now(state).await {
            tracing::error!("failed to propagate egg configuration changes: {:?}", err);
        }
    }

    async fn propagate_now(self, state: &crate::State) -> Result<(), anyhow::Error> {
        state
            .database
            .cache
            .invalidate(EggConfiguration::ALL_CACHE_KEY)
            .await?;

        let after = Self::resolve(&state.database).await?;

        if self.private_network != after.private_network {
            crate::tunnel::bump_epoch(state.database.write()).await?;
            crate::tunnel::poke_nodes(&state.database).await;
        }

        let firewall_flipped = self
            .firewall
            .symmetric_difference(&after.firewall)
            .copied()
            .collect::<HashSet<_>>();
        if firewall_flipped.is_empty() {
            return Ok(());
        }

        for server in super::server::Server::all_with_firewall_by_egg_node_pairs(
            &state.database,
            &firewall_flipped,
        )
        .await?
        {
            server.batch_sync(state).await;
        }

        Ok(())
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
                matcher: self.matcher,
                config_allocations: self.config_allocations,
                config_startup: self.config_startup,
                config_routes: self.config_routes,
                config_features: self.config_features,
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
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM egg_configurations
            WHERE egg_configurations.uuid = $1
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
            FROM egg_configurations
            WHERE egg_configurations.uuid = $1
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
pub struct CreateEggConfigurationOptions {
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: compact_str::CompactString,
    #[garde(length(chars, min = 1, max = 1024))]
    #[schema(min_length = 1, max_length = 1024)]
    pub description: Option<compact_str::CompactString>,
    #[garde(skip)]
    pub order: i16,
    #[garde(dive, custom(EggConfigurationMatcher::validate_nesting))]
    pub matcher: EggConfigurationMatcher,
    #[garde(dive)]
    #[schema(inline)]
    pub config_allocations: Option<EggConfigAllocations>,
    #[garde(dive)]
    #[schema(inline)]
    pub config_startup: Option<EggConfigStartup>,
    #[garde(dive)]
    #[schema(inline)]
    pub config_routes: Option<EggConfigRoutes>,
    #[garde(dive)]
    #[schema(inline)]
    pub config_features: Option<EggConfigFeatures>,
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

    async fn create_with_transaction(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        let mut query_builder = InsertQueryBuilder::new("egg_configurations");

        Self::run_create_handlers(&mut options, &mut query_builder, state, transaction).await?;

        query_builder
            .set("name", &options.name)
            .set("description", &options.description)
            .set("order_", options.order)
            .set("matcher", serde_json::to_value(&options.matcher)?)
            .set(
                "config_allocations",
                options
                    .config_allocations
                    .as_ref()
                    .map(serde_json::to_value)
                    .transpose()?,
            )
            .set(
                "config_startup",
                options
                    .config_startup
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
            )
            .set(
                "config_features",
                options
                    .config_features
                    .as_ref()
                    .map(serde_json::to_value)
                    .transpose()?,
            );

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut **transaction)
            .await?;
        let mut egg_configuration = Self::map(None, &row)?;

        Self::run_after_create_handlers(&mut egg_configuration, &options, state, transaction)
            .await?;

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
    #[garde(dive, custom(EggConfigurationMatcher::validate_optional_nesting))]
    pub matcher: Option<EggConfigurationMatcher>,

    #[garde(dive)]
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
    pub config_startup: Option<Option<EggConfigStartup>>,
    #[garde(dive)]
    #[schema(inline)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub config_routes: Option<Option<EggConfigRoutes>>,
    #[garde(dive)]
    #[schema(inline)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub config_features: Option<Option<EggConfigFeatures>>,
}

#[async_trait::async_trait]
impl UpdatableModel for EggConfiguration {
    type UpdateOptions = UpdateEggConfigurationOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateHandlerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateHandlerList<EggConfiguration>> =
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

        let mut query_builder = UpdateQueryBuilder::new("egg_configurations");

        self.run_update_handlers(&mut options, &mut query_builder, state, transaction)
            .await?;

        query_builder
            .set("name", options.name.as_ref())
            .set(
                "description",
                options.description.as_ref().map(|d| d.as_ref()),
            )
            .set("order_", options.order)
            .set(
                "matcher",
                options
                    .matcher
                    .as_ref()
                    .map(serde_json::to_value)
                    .transpose()?,
            )
            .set(
                "config_allocations",
                options
                    .config_allocations
                    .as_ref()
                    .map(|c| c.as_ref().map(serde_json::to_value).transpose())
                    .transpose()?,
            )
            .set(
                "config_startup",
                options
                    .config_startup
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
            .set(
                "config_features",
                options
                    .config_features
                    .as_ref()
                    .map(|c| c.as_ref().map(serde_json::to_value).transpose())
                    .transpose()?,
            )
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut **transaction).await?;

        if let Some(name) = options.name {
            self.name = name;
        }
        if let Some(description) = options.description {
            self.description = description;
        }
        if let Some(order) = options.order {
            self.order = order;
        }
        if let Some(matcher) = options.matcher {
            self.matcher = matcher;
        }
        if let Some(config_allocations) = options.config_allocations {
            self.config_allocations = config_allocations;
        }
        if let Some(config_startup) = options.config_startup {
            self.config_startup = config_startup;
        }
        if let Some(config_routes) = options.config_routes {
            self.config_routes = config_routes;
        }
        if let Some(config_features) = options.config_features {
            self.config_features = config_features;
        }

        self.run_after_update_handlers(state, transaction).await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl DeletableModel for EggConfiguration {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteHandlerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteHandlerList<EggConfiguration>> =
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
            DELETE FROM egg_configurations
            WHERE egg_configurations.uuid = $1
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

#[derive(Validate)]
pub struct DuplicateEggConfigurationOptions {
    #[garde(length(chars, min = 1, max = 255))]
    pub name: compact_str::CompactString,
}

#[async_trait::async_trait]
impl DuplicableModel for EggConfiguration {
    type DuplicateOptions<'a> = DuplicateEggConfigurationOptions;
    type DuplicateResult = Self;

    fn get_duplicate_handlers() -> &'static LazyLock<DuplicateHandlerList<Self>> {
        static DUPLICATE_LISTENERS: LazyLock<DuplicateHandlerList<EggConfiguration>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &DUPLICATE_LISTENERS
    }

    async fn duplicate_with_transaction(
        &self,
        state: &crate::State,
        options: Self::DuplicateOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        self.run_duplicate_handlers(&options, state, transaction)
            .await?;

        let mut query_builder = InsertQueryBuilder::new("egg_configurations");

        query_builder
            .set("name", &options.name)
            .set("description", &self.description)
            .set("order_", self.order)
            .set("matcher", serde_json::to_value(&self.matcher)?)
            .set(
                "config_allocations",
                self.config_allocations
                    .as_ref()
                    .map(serde_json::to_value)
                    .transpose()?,
            )
            .set(
                "config_startup",
                self.config_startup
                    .as_ref()
                    .map(serde_json::to_value)
                    .transpose()?,
            )
            .set(
                "config_routes",
                self.config_routes
                    .as_ref()
                    .map(serde_json::to_value)
                    .transpose()?,
            )
            .set(
                "config_features",
                self.config_features
                    .as_ref()
                    .map(serde_json::to_value)
                    .transpose()?,
            );

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut **transaction)
            .await?;
        let mut egg_configuration = Self::map(None, &row)?;

        self.run_after_duplicate_handlers(&mut egg_configuration, &options, state, transaction)
            .await?;

        Ok(egg_configuration)
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

    pub matcher: EggConfigurationMatcher,

    #[schema(inline)]
    pub config_allocations: Option<EggConfigAllocations>,
    #[schema(inline)]
    pub config_startup: Option<EggConfigStartup>,
    #[schema(inline)]
    pub config_routes: Option<EggConfigRoutes>,
    #[schema(inline)]
    pub config_features: Option<EggConfigFeatures>,

    pub created: chrono::DateTime<chrono::Utc>,
}

#[derive(Deserialize, Serialize, Default)]
pub struct MergedEggConfiguration {
    pub config_allocations: Option<EggConfigAllocations>,
    pub config_startup: Option<EggConfigStartup>,
    pub config_routes: Option<EggConfigRoutes>,
    pub config_features: EggConfigFeatures,
}

impl MergedEggConfiguration {
    #[inline]
    pub fn firewall_enabled(&self) -> bool {
        self.config_features.firewall.unwrap_or(true)
    }

    #[inline]
    pub fn private_network_enabled(&self) -> bool {
        self.config_features.private_network.unwrap_or(true)
    }
}

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
                startup_allow_custom_command: self
                    .config_startup
                    .as_ref()
                    .is_some_and(|c| c.allow_custom_startup_command),
                firewall_enabled: self.firewall_enabled(),
                private_network_enabled: self.private_network_enabled(),
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
    pub startup_allow_custom_command: bool,
    pub firewall_enabled: bool,
    pub private_network_enabled: bool,
    pub route_order: Option<Vec<crate::settings::RouteOrderItem>>,
}

#[cfg(test)]
mod tests {
    use super::*;

    const EGG: uuid::Uuid = uuid::Uuid::from_u128(1);
    const NEST: uuid::Uuid = uuid::Uuid::from_u128(2);
    const OTHER_EGG: uuid::Uuid = uuid::Uuid::from_u128(3);
    const OTHER_NEST: uuid::Uuid = uuid::Uuid::from_u128(4);
    const NODE: uuid::Uuid = uuid::Uuid::from_u128(5);
    const LOCATION: uuid::Uuid = uuid::Uuid::from_u128(6);
    const OTHER_NODE: uuid::Uuid = uuid::Uuid::from_u128(7);
    const OTHER_LOCATION: uuid::Uuid = uuid::Uuid::from_u128(8);

    fn target(egg_uuid: uuid::Uuid, nest_uuid: uuid::Uuid) -> EggConfigurationTarget {
        EggConfigurationTarget {
            egg_uuid,
            nest_uuid,
            node_uuid: NODE,
            location_uuid: LOCATION,
        }
    }

    fn config(
        matcher: EggConfigurationMatcher,
        startup: Option<bool>,
        features: Option<EggConfigFeatures>,
    ) -> EggConfiguration {
        EggConfiguration {
            uuid: uuid::Uuid::new_v4(),
            name: "test".into(),
            description: None,
            order: 0,
            matcher,
            config_allocations: None,
            config_startup: startup.map(|allow_custom_startup_command| EggConfigStartup {
                allow_custom_startup_command,
            }),
            config_routes: None,
            config_features: features,
            created: chrono::NaiveDateTime::default(),
            extension_data: Vec::new(),
        }
    }

    fn features(
        firewall: Option<bool>,
        private_network: Option<bool>,
    ) -> Option<EggConfigFeatures> {
        Some(EggConfigFeatures {
            firewall,
            private_network,
        })
    }

    // EggConfigurationMatcher::matches
    #[test]
    fn matcher_combinators_and_leaves() {
        let eggs = |eggs: Vec<uuid::Uuid>| EggConfigurationMatcher::Eggs { eggs };
        let nests = |nests: Vec<uuid::Uuid>| EggConfigurationMatcher::Nests { nests };

        assert!(EggConfigurationMatcher::All.matches(&target(EGG, NEST)));
        assert!(!EggConfigurationMatcher::Never.matches(&target(EGG, NEST)));
        assert!(eggs(vec![OTHER_EGG, EGG]).matches(&target(EGG, NEST)));
        assert!(!eggs(vec![OTHER_EGG]).matches(&target(EGG, NEST)));
        assert!(nests(vec![NEST]).matches(&target(EGG, NEST)));
        assert!(!nests(vec![OTHER_NEST]).matches(&target(EGG, NEST)));
        assert!(!nests(vec![EGG]).matches(&target(EGG, NEST)));

        assert!(
            EggConfigurationMatcher::And {
                matchers: vec![eggs(vec![EGG]), nests(vec![NEST])],
            }
            .matches(&target(EGG, NEST))
        );
        assert!(
            !EggConfigurationMatcher::And {
                matchers: vec![eggs(vec![EGG]), nests(vec![OTHER_NEST])],
            }
            .matches(&target(EGG, NEST))
        );
        assert!(
            EggConfigurationMatcher::Or {
                matchers: vec![eggs(vec![OTHER_EGG]), nests(vec![NEST])],
            }
            .matches(&target(EGG, NEST))
        );
        assert!(
            !EggConfigurationMatcher::Or {
                matchers: vec![eggs(vec![OTHER_EGG]), nests(vec![OTHER_NEST])],
            }
            .matches(&target(EGG, NEST))
        );
        assert!(
            EggConfigurationMatcher::Not {
                matcher: Box::new(eggs(vec![OTHER_EGG])),
            }
            .matches(&target(EGG, NEST))
        );
        assert!(
            !EggConfigurationMatcher::Not {
                matcher: Box::new(nests(vec![NEST])),
            }
            .matches(&target(EGG, NEST))
        );
    }

    // EggConfigurationMatcher (Deserialize)
    #[test]
    fn legacy_backfill_json_deserializes_to_eggs_matcher() {
        let matcher: EggConfigurationMatcher = serde_json::from_value(serde_json::json!({
            "type": "eggs",
            "eggs": [EGG.to_string()],
        }))
        .unwrap();

        assert!(matches!(&matcher, EggConfigurationMatcher::Eggs { eggs } if eggs == &[EGG]));
        assert!(matcher.matches(&target(EGG, NEST)));
        assert!(!matcher.matches(&target(OTHER_EGG, NEST)));
    }

    // EggConfigurationMatcher::matches
    #[test]
    fn node_and_location_leaves_match_their_own_field() {
        let elsewhere = EggConfigurationTarget {
            node_uuid: OTHER_NODE,
            location_uuid: OTHER_LOCATION,
            ..target(EGG, NEST)
        };
        let nodes = |nodes: Vec<uuid::Uuid>| EggConfigurationMatcher::Nodes { nodes };
        let locations =
            |locations: Vec<uuid::Uuid>| EggConfigurationMatcher::Locations { locations };

        assert!(nodes(vec![OTHER_NODE, NODE]).matches(&target(EGG, NEST)));
        assert!(!nodes(vec![NODE]).matches(&elsewhere));
        assert!(!nodes(vec![LOCATION]).matches(&target(EGG, NEST)));
        assert!(locations(vec![LOCATION]).matches(&target(EGG, NEST)));
        assert!(!locations(vec![LOCATION]).matches(&elsewhere));
        assert!(!locations(vec![NODE]).matches(&target(EGG, NEST)));

        let not_on_node = EggConfigurationMatcher::Not {
            matcher: Box::new(nodes(vec![NODE])),
        };
        assert!(!not_on_node.matches(&target(EGG, NEST)));
        assert!(not_on_node.matches(&elsewhere));
    }

    // EggConfigurationMatcher::validate_nesting
    #[test]
    fn nesting_limit_counts_groups_only() {
        let nest = |inner: EggConfigurationMatcher| EggConfigurationMatcher::And {
            matchers: vec![inner],
        };
        let leaf = EggConfigurationMatcher::Eggs { eggs: vec![EGG] };

        let at_limit = nest(EggConfigurationMatcher::Or {
            matchers: vec![EggConfigurationMatcher::Not {
                matcher: Box::new(leaf.clone()),
            }],
        });
        assert!(EggConfigurationMatcher::validate_nesting(&at_limit, &()).is_ok());

        let over_limit = nest(at_limit);
        assert!(EggConfigurationMatcher::validate_nesting(&over_limit, &()).is_err());

        assert!(EggConfigurationMatcher::validate_nesting(&leaf, &()).is_ok());
    }

    // EggConfiguration::merge
    #[test]
    fn features_merge_per_field_across_configs() {
        let global = config(
            EggConfigurationMatcher::All,
            None,
            features(None, Some(false)),
        );
        let specific = config(
            EggConfigurationMatcher::Eggs { eggs: vec![EGG] },
            None,
            features(Some(false), None),
        );

        let merged = EggConfiguration::merge([&global, &specific], &target(EGG, NEST));

        assert!(!merged.firewall_enabled());
        assert!(!merged.private_network_enabled());
    }

    #[test]
    fn later_config_wins_and_none_section_keeps_earlier() {
        let first = config(
            EggConfigurationMatcher::All,
            Some(true),
            features(Some(false), None),
        );
        let second = config(
            EggConfigurationMatcher::Nests { nests: vec![NEST] },
            Some(false),
            features(Some(true), None),
        );
        let third = config(EggConfigurationMatcher::All, None, None);

        let merged = EggConfiguration::merge([&first, &second, &third], &target(EGG, NEST));

        assert!(
            !merged
                .config_startup
                .as_ref()
                .unwrap()
                .allow_custom_startup_command
        );
        assert!(merged.firewall_enabled());
    }

    #[test]
    fn non_matching_configs_are_skipped() {
        let global = config(EggConfigurationMatcher::All, Some(true), None);
        let other = config(
            EggConfigurationMatcher::Eggs {
                eggs: vec![OTHER_EGG],
            },
            Some(false),
            features(Some(false), Some(false)),
        );

        let merged = EggConfiguration::merge([&global, &other], &target(EGG, NEST));

        assert!(
            merged
                .config_startup
                .as_ref()
                .unwrap()
                .allow_custom_startup_command
        );
        assert!(merged.firewall_enabled());
        assert!(merged.private_network_enabled());
    }

    #[test]
    fn same_egg_resolves_per_location() {
        let global = config(
            EggConfigurationMatcher::All,
            None,
            features(None, Some(false)),
        );
        let on_location = config(
            EggConfigurationMatcher::And {
                matchers: vec![
                    EggConfigurationMatcher::Eggs { eggs: vec![EGG] },
                    EggConfigurationMatcher::Locations {
                        locations: vec![LOCATION],
                    },
                ],
            },
            None,
            features(None, Some(true)),
        );
        let other_location = EggConfigurationTarget {
            location_uuid: OTHER_LOCATION,
            ..target(EGG, NEST)
        };

        let here = EggConfiguration::merge([&global, &on_location], &target(EGG, NEST));
        let there = EggConfiguration::merge([&global, &on_location], &other_location);

        assert!(here.private_network_enabled());
        assert!(!there.private_network_enabled());
    }

    #[test]
    fn features_default_enabled_without_configs() {
        let merged = EggConfiguration::merge([], &target(EGG, NEST));

        assert!(merged.firewall_enabled());
        assert!(merged.private_network_enabled());
        assert!(merged.config_startup.is_none());
    }
}
