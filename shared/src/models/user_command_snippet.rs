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
pub enum UserCommandSnippetMatcher {
    Never,
    All,
    And {
        #[garde(dive)]
        matchers: Vec<UserCommandSnippetMatcher>,
    },
    Or {
        #[garde(dive)]
        matchers: Vec<UserCommandSnippetMatcher>,
    },
    Not {
        #[garde(dive)]
        matcher: Box<UserCommandSnippetMatcher>,
    },
    Eggs {
        #[garde(length(max = 100))]
        #[schema(max_length = 100)]
        eggs: Vec<uuid::Uuid>,
    },
}

impl UserCommandSnippetMatcher {
    pub const MAX_NESTING_DEPTH: usize = 3;

    fn nested_within_limit(&self, depth: usize) -> bool {
        match self {
            UserCommandSnippetMatcher::And { matchers }
            | UserCommandSnippetMatcher::Or { matchers } => {
                depth < Self::MAX_NESTING_DEPTH
                    && matchers.iter().all(|m| m.nested_within_limit(depth + 1))
            }
            UserCommandSnippetMatcher::Not { matcher } => {
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

    pub fn matches(&self, egg_uuid: uuid::Uuid) -> bool {
        match self {
            UserCommandSnippetMatcher::Never => false,
            UserCommandSnippetMatcher::All => true,
            UserCommandSnippetMatcher::And { matchers } => {
                matchers.iter().all(|m| m.matches(egg_uuid))
            }
            UserCommandSnippetMatcher::Or { matchers } => {
                matchers.iter().any(|m| m.matches(egg_uuid))
            }
            UserCommandSnippetMatcher::Not { matcher } => !matcher.matches(egg_uuid),
            UserCommandSnippetMatcher::Eggs { eggs } => eggs.contains(&egg_uuid),
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct UserCommandSnippet {
    pub uuid: uuid::Uuid,
    pub name: compact_str::CompactString,

    pub matcher: UserCommandSnippetMatcher,
    pub command: compact_str::CompactString,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for UserCommandSnippet {
    const NAME: &'static str = "user_command_snippet";

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
                "user_command_snippets.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "user_command_snippets.name",
                compact_str::format_compact!("{prefix}name"),
            ),
            (
                "user_command_snippets.matcher",
                compact_str::format_compact!("{prefix}matcher"),
            ),
            (
                "user_command_snippets.command",
                compact_str::format_compact!("{prefix}command"),
            ),
            (
                "user_command_snippets.created",
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
            matcher: serde_json::from_value(
                row.try_get(compact_str::format_compact!("{prefix}matcher").as_str())?,
            )?,
            command: row.try_get(compact_str::format_compact!("{prefix}command").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl UserCommandSnippet {
    pub async fn by_user_uuid_uuid(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM user_command_snippets
            WHERE user_command_snippets.user_uuid = $1 AND user_command_snippets.uuid = $2
            "#,
            Self::columns_sql(None)
        )))
        .bind(user_uuid)
        .bind(uuid)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn by_user_uuid_with_pagination(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        super::PaginatedQueryBuilder::new(
            Self::columns_sql(None),
            format!(
                r#"
                FROM user_command_snippets
                WHERE user_command_snippets.user_uuid = $1 AND {search}
                "#,
                search = super::search_sql(
                    2,
                    &["user_command_snippets.name"],
                    &["user_command_snippets.uuid"]
                ),
            ),
            "user_command_snippets.created, user_command_snippets.uuid",
        )
        .bind(user_uuid)
        .bind(search)
        .fetch(database, page, per_page)
        .await
    }

    pub async fn all_by_user_uuid_nest_egg_uuid(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
        nest_egg_uuid: uuid::Uuid,
    ) -> Result<Vec<Self>, crate::database::DatabaseError> {
        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM user_command_snippets
            WHERE user_command_snippets.user_uuid = $1
            ORDER BY user_command_snippets.created, user_command_snippets.uuid
            "#,
            Self::columns_sql(None)
        )))
        .bind(user_uuid)
        .fetch_all(database.read())
        .await?;

        let mut command_snippets = rows
            .into_iter()
            .map(|row| Self::map(None, &row))
            .try_collect_vec()?;
        command_snippets.retain(|command_snippet| command_snippet.matcher.matches(nest_egg_uuid));

        Ok(command_snippets)
    }

    pub async fn count_by_user_uuid(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
    ) -> Result<i64, sqlx::Error> {
        sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM user_command_snippets
            WHERE user_command_snippets.user_uuid = $1
            "#,
        )
        .bind(user_uuid)
        .fetch_one(database.read())
        .await
    }
}

#[async_trait::async_trait]
impl IntoApiObject for UserCommandSnippet {
    type ApiObject = ApiUserCommandSnippet;
    type ExtraArgs<'a> = ();

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::ApiObject, crate::database::DatabaseError> {
        let api_object = ApiUserCommandSnippet::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            ApiUserCommandSnippet {
                uuid: self.uuid,
                name: self.name,
                matcher: self.matcher,
                command: self.command,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[derive(ToSchema, Deserialize, Validate)]
pub struct CreateUserCommandSnippetOptions {
    #[garde(skip)]
    pub user_uuid: uuid::Uuid,

    #[garde(length(chars, min = 1, max = 31))]
    #[schema(min_length = 1, max_length = 31)]
    pub name: compact_str::CompactString,

    #[garde(dive, custom(UserCommandSnippetMatcher::validate_nesting))]
    pub matcher: UserCommandSnippetMatcher,
    #[garde(length(chars, min = 1, max = 1024))]
    #[schema(min_length = 1, max_length = 1024)]
    pub command: compact_str::CompactString,
}

#[async_trait::async_trait]
impl CreatableModel for UserCommandSnippet {
    type CreateOptions<'a> = CreateUserCommandSnippetOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<UserCommandSnippet>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create_with_transaction(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        let mut query_builder = InsertQueryBuilder::new("user_command_snippets");

        Self::run_create_handlers(&mut options, &mut query_builder, state, transaction).await?;

        query_builder
            .set("user_uuid", options.user_uuid)
            .set("name", &options.name)
            .set("matcher", serde_json::to_value(&options.matcher)?)
            .set("command", &options.command);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut **transaction)
            .await?;
        let mut user_command_snippet = Self::map(None, &row)?;

        Self::run_after_create_handlers(&mut user_command_snippet, &options, state, transaction)
            .await?;

        Ok(user_command_snippet)
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Default)]
pub struct UpdateUserCommandSnippetOptions {
    #[garde(length(chars, min = 1, max = 31))]
    #[schema(min_length = 1, max_length = 31, value_type = String)]
    pub name: Option<compact_str::CompactString>,

    #[garde(dive, custom(UserCommandSnippetMatcher::validate_optional_nesting))]
    pub matcher: Option<UserCommandSnippetMatcher>,
    #[garde(length(chars, min = 1, max = 1024))]
    #[schema(min_length = 1, max_length = 1024)]
    pub command: Option<compact_str::CompactString>,
}

#[async_trait::async_trait]
impl UpdatableModel for UserCommandSnippet {
    type UpdateOptions = UpdateUserCommandSnippetOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateHandlerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateHandlerList<UserCommandSnippet>> =
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

        let mut query_builder = UpdateQueryBuilder::new("user_command_snippets");

        self.run_update_handlers(&mut options, &mut query_builder, state, transaction)
            .await?;

        query_builder
            .set("name", options.name.as_ref())
            .set(
                "matcher",
                options
                    .matcher
                    .as_ref()
                    .map(serde_json::to_value)
                    .transpose()?,
            )
            .set("command", options.command.as_ref())
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut **transaction).await?;

        if let Some(name) = options.name {
            self.name = name;
        }
        if let Some(matcher) = options.matcher {
            self.matcher = matcher;
        }
        if let Some(command) = options.command {
            self.command = command;
        }

        self.run_after_update_handlers(state, transaction).await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl DeletableModel for UserCommandSnippet {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteHandlerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteHandlerList<UserCommandSnippet>> =
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
            DELETE FROM user_command_snippets
            WHERE user_command_snippets.uuid = $1
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
pub struct DuplicateUserCommandSnippetOptions {
    #[garde(skip)]
    pub user_uuid: uuid::Uuid,
    #[garde(length(chars, min = 1, max = 31))]
    pub name: compact_str::CompactString,
}

#[async_trait::async_trait]
impl DuplicableModel for UserCommandSnippet {
    type DuplicateOptions<'a> = DuplicateUserCommandSnippetOptions;
    type DuplicateResult = Self;

    fn get_duplicate_handlers() -> &'static LazyLock<DuplicateHandlerList<Self>> {
        static DUPLICATE_LISTENERS: LazyLock<DuplicateHandlerList<UserCommandSnippet>> =
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

        let mut query_builder = InsertQueryBuilder::new("user_command_snippets");

        query_builder
            .set("user_uuid", options.user_uuid)
            .set("name", &options.name)
            .set("matcher", serde_json::to_value(&self.matcher)?)
            .set("command", &self.command);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut **transaction)
            .await?;
        let mut user_command_snippet = Self::map(None, &row)?;

        self.run_after_duplicate_handlers(&mut user_command_snippet, &options, state, transaction)
            .await?;

        Ok(user_command_snippet)
    }
}

#[schema_extension_derive::extendible]
#[init_args(UserCommandSnippet, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "UserCommandSnippet")]
pub struct ApiUserCommandSnippet {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,

    pub matcher: UserCommandSnippetMatcher,
    pub command: compact_str::CompactString,

    pub created: chrono::DateTime<chrono::Utc>,
}
