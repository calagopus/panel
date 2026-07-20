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

#[derive(ToSchema, Validate, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
#[schema(no_recursion)]
pub enum OAuthProviderMappingMatcher {
    None,
    And {
        #[garde(dive)]
        matchers: Vec<OAuthProviderMappingMatcher>,
    },
    Or {
        #[garde(dive)]
        matchers: Vec<OAuthProviderMappingMatcher>,
    },
    Not {
        #[garde(dive)]
        matcher: Box<OAuthProviderMappingMatcher>,
    },
    Scopes {
        #[garde(length(max = 255), inner(length(max = 255)))]
        #[schema(max_length = 255)]
        scopes: Vec<compact_str::CompactString>,
    },
    FieldExists {
        #[garde(
            length(chars, min = 1, max = 255),
            custom(crate::utils::validate_json_path)
        )]
        #[schema(min_length = 1, max_length = 255)]
        path: String,
    },
    FieldEquals {
        #[garde(
            length(chars, min = 1, max = 255),
            custom(crate::utils::validate_json_path)
        )]
        #[schema(min_length = 1, max_length = 255)]
        path: String,
        #[garde(length(max = 255))]
        #[schema(max_length = 255)]
        equals: compact_str::CompactString,
    },
    FieldContains {
        #[garde(
            length(chars, min = 1, max = 255),
            custom(crate::utils::validate_json_path)
        )]
        #[schema(min_length = 1, max_length = 255)]
        path: String,
        #[garde(length(max = 255))]
        #[schema(max_length = 255)]
        contains: compact_str::CompactString,
    },
    FieldStartsWith {
        #[garde(
            length(chars, min = 1, max = 255),
            custom(crate::utils::validate_json_path)
        )]
        #[schema(min_length = 1, max_length = 255)]
        path: String,
        #[garde(length(max = 255))]
        #[schema(max_length = 255)]
        starts_with: compact_str::CompactString,
    },
    FieldEndsWith {
        #[garde(
            length(chars, min = 1, max = 255),
            custom(crate::utils::validate_json_path)
        )]
        #[schema(min_length = 1, max_length = 255)]
        path: String,
        #[garde(length(max = 255))]
        #[schema(max_length = 255)]
        ends_with: compact_str::CompactString,
    },
}

impl OAuthProviderMappingMatcher {
    pub const MAX_NESTING_DEPTH: usize = 3;

    fn nested_within_limit(&self, depth: usize) -> bool {
        match self {
            OAuthProviderMappingMatcher::And { matchers }
            | OAuthProviderMappingMatcher::Or { matchers } => {
                depth < Self::MAX_NESTING_DEPTH
                    && matchers.iter().all(|m| m.nested_within_limit(depth + 1))
            }
            OAuthProviderMappingMatcher::Not { matcher } => {
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

    fn query_nodes<'a>(path: &str, info: &'a serde_json::Value) -> Vec<&'a serde_json::Value> {
        match serde_json_path::JsonPath::parse(path) {
            Ok(path) => path.query(info).all(),
            Err(err) => {
                tracing::warn!(
                    path,
                    "failed to parse oauth provider mapping matcher path: {err}"
                );

                Vec::new()
            }
        }
    }

    fn node_equals_str(node: &serde_json::Value, expected: &str) -> bool {
        match node {
            serde_json::Value::String(value) => value == expected,
            node => node == expected,
        }
    }

    fn node_string(node: &serde_json::Value) -> String {
        match node {
            serde_json::Value::String(value) => value.clone(),
            node => node.to_string(),
        }
    }

    pub fn matches(
        &self,
        granted_scopes: &[compact_str::CompactString],
        info: &serde_json::Value,
    ) -> bool {
        match self {
            OAuthProviderMappingMatcher::None => true,
            OAuthProviderMappingMatcher::And { matchers } => {
                matchers.iter().all(|m| m.matches(granted_scopes, info))
            }
            OAuthProviderMappingMatcher::Or { matchers } => {
                matchers.iter().any(|m| m.matches(granted_scopes, info))
            }
            OAuthProviderMappingMatcher::Not { matcher } => !matcher.matches(granted_scopes, info),
            OAuthProviderMappingMatcher::Scopes { scopes } => {
                scopes.iter().all(|scope| granted_scopes.contains(scope))
            }
            OAuthProviderMappingMatcher::FieldExists { path } => {
                !Self::query_nodes(path, info).is_empty()
            }
            OAuthProviderMappingMatcher::FieldEquals { path, equals } => {
                Self::query_nodes(path, info)
                    .into_iter()
                    .any(|node| Self::node_equals_str(node, equals))
            }
            OAuthProviderMappingMatcher::FieldContains { path, contains } => {
                Self::query_nodes(path, info)
                    .into_iter()
                    .any(|node| match node {
                        serde_json::Value::Array(values) => values
                            .iter()
                            .any(|value| Self::node_equals_str(value, contains)),
                        node => Self::node_string(node).contains(contains.as_str()),
                    })
            }
            OAuthProviderMappingMatcher::FieldStartsWith { path, starts_with } => {
                Self::query_nodes(path, info)
                    .into_iter()
                    .any(|node| Self::node_string(node).starts_with(starts_with.as_str()))
            }
            OAuthProviderMappingMatcher::FieldEndsWith { path, ends_with } => {
                Self::query_nodes(path, info)
                    .into_iter()
                    .any(|node| Self::node_string(node).ends_with(ends_with.as_str()))
            }
        }
    }
}

#[derive(ToSchema, Validate, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum OAuthProviderMappingType {
    Role {
        #[garde(skip)]
        role_uuid: uuid::Uuid,
    },
    ServerSubuser {
        #[garde(skip)]
        server_uuid: uuid::Uuid,
        #[garde(custom(crate::permissions::validate_server_permissions))]
        permissions: Vec<compact_str::CompactString>,
        #[garde(skip)]
        ignored_files: Vec<compact_str::CompactString>,
    },
}

#[derive(Serialize, Deserialize, Clone)]
pub struct OAuthProviderMapping {
    pub uuid: uuid::Uuid,
    pub oauth_provider: Fetchable<super::oauth_provider::OAuthProvider>,

    pub matcher: OAuthProviderMappingMatcher,
    pub mapping: OAuthProviderMappingType,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for OAuthProviderMapping {
    const NAME: &'static str = "oauth_provider_mapping";

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
                "oauth_provider_mappings.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "oauth_provider_mappings.oauth_provider_uuid",
                compact_str::format_compact!("{prefix}oauth_provider_uuid"),
            ),
            (
                "oauth_provider_mappings.matcher",
                compact_str::format_compact!("{prefix}matcher"),
            ),
            (
                "oauth_provider_mappings.mapping",
                compact_str::format_compact!("{prefix}mapping"),
            ),
            (
                "oauth_provider_mappings.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ])
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            uuid: row.try_get(compact_str::format_compact!("{prefix}uuid").as_str())?,
            oauth_provider: super::oauth_provider::OAuthProvider::get_fetchable(
                row.try_get(compact_str::format_compact!("{prefix}oauth_provider_uuid").as_str())?,
            ),
            matcher: serde_json::from_value(
                row.try_get(compact_str::format_compact!("{prefix}matcher").as_str())?,
            )?,
            mapping: serde_json::from_value(
                row.try_get(compact_str::format_compact!("{prefix}mapping").as_str())?,
            )?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl OAuthProviderMapping {
    pub async fn by_oauth_provider_uuid_uuid(
        database: &crate::database::Database,
        oauth_provider_uuid: uuid::Uuid,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM oauth_provider_mappings
            WHERE oauth_provider_mappings.oauth_provider_uuid = $1 AND oauth_provider_mappings.uuid = $2
            "#,
            Self::columns_sql(None)
        )))
        .bind(oauth_provider_uuid)
        .bind(uuid)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn by_oauth_provider_uuid_with_pagination(
        database: &crate::database::Database,
        oauth_provider_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM oauth_provider_mappings
            WHERE oauth_provider_mappings.oauth_provider_uuid = $1
            ORDER BY oauth_provider_mappings.created
            LIMIT $2 OFFSET $3
            "#,
            Self::columns_sql(None)
        )))
        .bind(oauth_provider_uuid)
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

    pub async fn all_by_oauth_provider_uuid(
        database: &crate::database::Database,
        oauth_provider_uuid: uuid::Uuid,
    ) -> Result<Vec<Self>, crate::database::DatabaseError> {
        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM oauth_provider_mappings
            WHERE oauth_provider_mappings.oauth_provider_uuid = $1
            ORDER BY oauth_provider_mappings.created
            "#,
            Self::columns_sql(None)
        )))
        .bind(oauth_provider_uuid)
        .fetch_all(database.read())
        .await?;

        rows.into_iter()
            .map(|row| Self::map(None, &row))
            .try_collect_vec()
    }

    pub async fn apply_for_user(
        state: &crate::State,
        oauth_provider_uuid: uuid::Uuid,
        user_uuid: uuid::Uuid,
        granted_scopes: &[compact_str::CompactString],
        info: &serde_json::Value,
    ) -> Result<(), crate::database::DatabaseError> {
        let mut mappings =
            Self::all_by_oauth_provider_uuid(&state.database, oauth_provider_uuid).await?;
        mappings.retain(|mapping| mapping.matcher.matches(granted_scopes, info));
        if mappings.is_empty() {
            return Ok(());
        }

        let mut user =
            match super::user::User::by_uuid_optional_cached(&state.database, user_uuid).await? {
                Some(user) => user,
                None => return Ok(()),
            };

        for mapping in mappings {
            if let Err(err) = mapping.apply(state, &mut user).await {
                tracing::warn!(
                    mapping = %mapping.uuid,
                    user = %user.uuid,
                    "failed to apply oauth provider mapping: {:#?}",
                    err
                );
            }
        }

        Ok(())
    }

    async fn apply(
        &self,
        state: &crate::State,
        user: &mut super::user::User,
    ) -> Result<(), crate::database::DatabaseError> {
        match &self.mapping {
            OAuthProviderMappingType::Role { role_uuid } => {
                if super::role::Role::by_uuid_optional_cached(&state.database, *role_uuid)
                    .await?
                    .is_none()
                {
                    return Ok(());
                }

                user.update(
                    state,
                    super::user::UpdateUserOptions {
                        role_uuid: Some(Some(*role_uuid)),
                        ..Default::default()
                    },
                )
                .await
            }
            OAuthProviderMappingType::ServerSubuser {
                server_uuid,
                permissions,
                ignored_files,
            } => {
                let server = match super::server::Server::by_uuid_optional_cached(
                    &state.database,
                    *server_uuid,
                )
                .await?
                {
                    Some(server) => server,
                    None => return Ok(()),
                };

                if server.owner.uuid == user.uuid {
                    return Ok(());
                }

                if let Some(mut subuser) =
                    super::server_subuser::ServerSubuser::by_server_uuid_user_uuid(
                        &state.database,
                        server.uuid,
                        user.uuid,
                    )
                    .await?
                {
                    subuser
                        .update(
                            state,
                            super::server_subuser::UpdateServerSubuserOptions {
                                permissions: Some(permissions.clone()),
                                ignored_files: Some(ignored_files.clone()),
                            },
                        )
                        .await?;
                } else {
                    super::server_subuser::ServerSubuser::create(
                        state,
                        super::server_subuser::CreateServerSubuserOptions {
                            server: &server,
                            email: user.email.clone(),
                            permissions: permissions.clone(),
                            ignored_files: ignored_files.clone(),
                        },
                    )
                    .await?;
                }

                Ok(())
            }
        }
    }

    pub async fn cleanup_uuid_arrays(
        database: &crate::database::Database,
    ) -> Result<u64, crate::database::DatabaseError> {
        let result = sqlx::query(
            "DELETE FROM oauth_provider_mappings
            WHERE (
                mapping->>'type' = 'role'
                AND NOT EXISTS (SELECT 1 FROM roles WHERE uuid = (mapping->>'role_uuid')::uuid)
            ) OR (
                mapping->>'type' = 'server_subuser'
                AND NOT EXISTS (SELECT 1 FROM servers WHERE uuid = (mapping->>'server_uuid')::uuid)
            )",
        )
        .execute(database.write())
        .await?;

        Ok(result.rows_affected())
    }
}

#[async_trait::async_trait]
impl IntoAdminApiObject for OAuthProviderMapping {
    type AdminApiObject = AdminApiOAuthProviderMapping;
    type ExtraArgs<'a> = ();

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiOAuthProviderMapping::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            AdminApiOAuthProviderMapping {
                uuid: self.uuid,
                matcher: self.matcher,
                mapping: self.mapping,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[derive(ToSchema, Deserialize, Validate)]
pub struct CreateOAuthProviderMappingOptions {
    #[garde(skip)]
    pub oauth_provider_uuid: uuid::Uuid,

    #[garde(dive, custom(OAuthProviderMappingMatcher::validate_nesting))]
    pub matcher: OAuthProviderMappingMatcher,
    #[garde(dive)]
    pub mapping: OAuthProviderMappingType,
}

#[async_trait::async_trait]
impl CreatableModel for OAuthProviderMapping {
    type CreateOptions<'a> = CreateOAuthProviderMappingOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<OAuthProviderMapping>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create_with_transaction(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        super::oauth_provider::OAuthProvider::by_uuid_optional_cached(
            &state.database,
            options.oauth_provider_uuid,
        )
        .await?
        .ok_or(crate::database::InvalidRelationError("oauth_provider"))?;

        let mut query_builder = InsertQueryBuilder::new("oauth_provider_mappings");

        Self::run_create_handlers(&mut options, &mut query_builder, state, transaction).await?;

        query_builder
            .set("oauth_provider_uuid", options.oauth_provider_uuid)
            .set("matcher", serde_json::to_value(&options.matcher)?)
            .set("mapping", serde_json::to_value(&options.mapping)?);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut **transaction)
            .await?;
        let mut mapping = Self::map(None, &row)?;

        Self::run_after_create_handlers(&mut mapping, &options, state, transaction).await?;

        Ok(mapping)
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Default)]
pub struct UpdateOAuthProviderMappingOptions {
    #[garde(dive, custom(OAuthProviderMappingMatcher::validate_optional_nesting))]
    pub matcher: Option<OAuthProviderMappingMatcher>,
    #[garde(dive)]
    pub mapping: Option<OAuthProviderMappingType>,
}

#[async_trait::async_trait]
impl UpdatableModel for OAuthProviderMapping {
    type UpdateOptions = UpdateOAuthProviderMappingOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateHandlerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateHandlerList<OAuthProviderMapping>> =
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

        let mut query_builder = UpdateQueryBuilder::new("oauth_provider_mappings");

        self.run_update_handlers(&mut options, &mut query_builder, state, transaction)
            .await?;

        let matcher = options
            .matcher
            .as_ref()
            .map(serde_json::to_value)
            .transpose()?;
        let mapping = options
            .mapping
            .as_ref()
            .map(serde_json::to_value)
            .transpose()?;

        query_builder
            .set("matcher", matcher)
            .set("mapping", mapping)
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut **transaction).await?;

        if let Some(matcher) = options.matcher {
            self.matcher = matcher;
        }
        if let Some(mapping) = options.mapping {
            self.mapping = mapping;
        }

        self.run_after_update_handlers(state, transaction).await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl DeletableModel for OAuthProviderMapping {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteHandlerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteHandlerList<OAuthProviderMapping>> =
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
            DELETE FROM oauth_provider_mappings
            WHERE oauth_provider_mappings.uuid = $1
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
#[init_args(OAuthProviderMapping, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "AdminOAuthProviderMapping")]
pub struct AdminApiOAuthProviderMapping {
    pub uuid: uuid::Uuid,

    pub matcher: OAuthProviderMappingMatcher,
    pub mapping: OAuthProviderMappingType,

    pub created: chrono::DateTime<chrono::Utc>,
}
