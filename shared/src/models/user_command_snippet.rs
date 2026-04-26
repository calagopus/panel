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
pub struct UserCommandSnippet {
    pub uuid: uuid::Uuid,
    pub name: compact_str::CompactString,

    pub eggs: Vec<uuid::Uuid>,
    pub command: compact_str::CompactString,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for UserCommandSnippet {
    const NAME: &'static str = "user_command_snippet";

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
                "user_command_snippets.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "user_command_snippets.name",
                compact_str::format_compact!("{prefix}name"),
            ),
            (
                "user_command_snippets.eggs",
                compact_str::format_compact!("{prefix}eggs"),
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
            eggs: row.try_get(compact_str::format_compact!("{prefix}eggs").as_str())?,
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
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM user_command_snippets
            WHERE user_command_snippets.user_uuid = $1 AND user_command_snippets.uuid = $2
            "#,
            Self::columns_sql(None)
        ))
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
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(&format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM user_command_snippets
            WHERE user_command_snippets.user_uuid = $1 AND ($2 IS NULL OR user_command_snippets.name ILIKE '%' || $2 || '%')
            ORDER BY user_command_snippets.created
            LIMIT $3 OFFSET $4
            "#,
            Self::columns_sql(None)
        ))
        .bind(user_uuid)
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

    pub async fn all_by_user_uuid_nest_egg_uuid(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
        nest_egg_uuid: uuid::Uuid,
    ) -> Result<Vec<Self>, crate::database::DatabaseError> {
        let rows = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM user_command_snippets
            WHERE user_command_snippets.user_uuid = $1 AND $2 = ANY(user_command_snippets.eggs)
            ORDER BY user_command_snippets.created
            "#,
            Self::columns_sql(None)
        ))
        .bind(user_uuid)
        .bind(nest_egg_uuid)
        .fetch_all(database.read())
        .await?;

        rows.into_iter()
            .map(|row| Self::map(None, &row))
            .try_collect_vec()
    }

    pub async fn count_by_user_uuid(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
    ) -> i64 {
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
        .unwrap_or(0)
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
                eggs: self.eggs,
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

    #[garde(length(max = 100))]
    #[schema(max_length = 100)]
    pub eggs: Vec<uuid::Uuid>,
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

    async fn create(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        let mut transaction = state.database.write().begin().await?;

        let mut query_builder = InsertQueryBuilder::new("user_command_snippets");

        Self::run_create_handlers(&mut options, &mut query_builder, state, &mut transaction)
            .await?;

        query_builder
            .set("user_uuid", options.user_uuid)
            .set("name", &options.name)
            .set("eggs", &options.eggs)
            .set("command", &options.command);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut *transaction)
            .await?;
        let user_command_snippet = Self::map(None, &row)?;

        transaction.commit().await?;

        Ok(user_command_snippet)
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Default)]
pub struct UpdateUserCommandSnippetOptions {
    #[garde(length(chars, min = 1, max = 31))]
    #[schema(min_length = 1, max_length = 31, value_type = String)]
    pub name: Option<compact_str::CompactString>,

    #[garde(length(max = 100))]
    #[schema(max_length = 100)]
    pub eggs: Option<Vec<uuid::Uuid>>,
    #[garde(length(chars, min = 1, max = 1024))]
    #[schema(min_length = 1, max_length = 1024)]
    pub command: Option<compact_str::CompactString>,
}

#[async_trait::async_trait]
impl UpdatableModel for UserCommandSnippet {
    type UpdateOptions = UpdateUserCommandSnippetOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateListenerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateListenerList<UserCommandSnippet>> =
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

        let mut query_builder = UpdateQueryBuilder::new("user_command_snippets");

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
            .set("eggs", options.eggs.as_ref())
            .set("command", options.command.as_ref())
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut *transaction).await?;

        if let Some(name) = options.name {
            self.name = name;
        }
        if let Some(eggs) = options.eggs {
            self.eggs = eggs;
        }
        if let Some(command) = options.command {
            self.command = command;
        }

        transaction.commit().await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl DeletableModel for UserCommandSnippet {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteListenerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteListenerList<UserCommandSnippet>> =
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
            DELETE FROM user_command_snippets
            WHERE user_command_snippets.uuid = $1
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
#[init_args(UserCommandSnippet, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "UserCommandSnippet")]
pub struct ApiUserCommandSnippet {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,

    pub eggs: Vec<uuid::Uuid>,
    pub command: compact_str::CompactString,

    pub created: chrono::DateTime<chrono::Utc>,
}
