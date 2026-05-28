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
pub struct UserServerGroup {
    pub uuid: uuid::Uuid,
    pub name: compact_str::CompactString,
    pub order: i16,

    pub server_order: Vec<uuid::Uuid>,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for UserServerGroup {
    const NAME: &'static str = "user_server_group";

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
                "user_server_groups.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "user_server_groups.name",
                compact_str::format_compact!("{prefix}name"),
            ),
            (
                "user_server_groups.order_",
                compact_str::format_compact!("{prefix}order"),
            ),
            (
                "user_server_groups.server_order",
                compact_str::format_compact!("{prefix}server_order"),
            ),
            (
                "user_server_groups.created",
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
            order: row.try_get(compact_str::format_compact!("{prefix}order").as_str())?,
            server_order: row
                .try_get(compact_str::format_compact!("{prefix}server_order").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl UserServerGroup {
    pub async fn by_user_uuid_uuid(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM user_server_groups
            WHERE user_server_groups.user_uuid = $1 AND user_server_groups.uuid = $2
            "#,
            Self::columns_sql(None)
        )))
        .bind(user_uuid)
        .bind(uuid)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn all_by_user_uuid(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
    ) -> Result<Vec<Self>, crate::database::DatabaseError> {
        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM user_server_groups
            WHERE user_server_groups.user_uuid = $1
            ORDER BY user_server_groups.order_, user_server_groups.created
            "#,
            Self::columns_sql(None)
        )))
        .bind(user_uuid)
        .fetch_all(database.read())
        .await?;

        rows.into_iter()
            .map(|row| Self::map(None, &row))
            .try_collect_vec()
    }

    pub async fn count_by_user_uuid(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
    ) -> Result<i64, sqlx::Error> {
        sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM user_server_groups
            WHERE user_server_groups.user_uuid = $1
            "#,
        )
        .bind(user_uuid)
        .fetch_one(database.read())
        .await
    }

    pub async fn cleanup_uuid_arrays(
        database: &crate::database::Database,
    ) -> Result<u64, crate::database::DatabaseError> {
        let result = sqlx::query(
            "UPDATE user_server_groups
            SET server_order = COALESCE(
                (SELECT array_agg(u) FROM unnest(server_order) AS u
                WHERE EXISTS (SELECT 1 FROM servers WHERE uuid = u)),
                '{}'::uuid[]
            )
            WHERE EXISTS (
                SELECT 1 FROM unnest(server_order) AS u
                WHERE NOT EXISTS (SELECT 1 FROM servers WHERE uuid = u)
            )",
        )
        .execute(database.write())
        .await?;

        Ok(result.rows_affected())
    }
}

#[async_trait::async_trait]
impl IntoApiObject for UserServerGroup {
    type ApiObject = ApiUserServerGroup;
    type ExtraArgs<'a> = ();

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::ApiObject, crate::database::DatabaseError> {
        let api_object = ApiUserServerGroup::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            ApiUserServerGroup {
                uuid: self.uuid,
                name: self.name,
                order: self.order,
                server_order: self.server_order,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[derive(ToSchema, Deserialize, Validate)]
pub struct CreateUserServerGroupOptions {
    #[garde(skip)]
    pub user_uuid: uuid::Uuid,

    #[garde(length(chars, min = 2, max = 31))]
    #[schema(min_length = 2, max_length = 31)]
    pub name: compact_str::CompactString,

    #[garde(length(max = 100))]
    #[schema(max_length = 100)]
    pub server_order: Vec<uuid::Uuid>,
}

#[async_trait::async_trait]
impl CreatableModel for UserServerGroup {
    type CreateOptions<'a> = CreateUserServerGroupOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<UserServerGroup>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create_with_transaction(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        let mut query_builder = InsertQueryBuilder::new("user_server_groups");

        Self::run_create_handlers(&mut options, &mut query_builder, state, transaction).await?;

        query_builder
            .set("user_uuid", options.user_uuid)
            .set("name", &options.name)
            .set("server_order", &options.server_order);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut **transaction)
            .await?;
        let mut user_server_group = Self::map(None, &row)?;

        Self::run_after_create_handlers(&mut user_server_group, &options, state, transaction)
            .await?;

        Ok(user_server_group)
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Default)]
pub struct UpdateUserServerGroupOptions {
    #[garde(length(chars, min = 2, max = 31))]
    #[schema(min_length = 2, max_length = 31, value_type = String)]
    pub name: Option<compact_str::CompactString>,

    #[garde(length(max = 100))]
    #[schema(max_length = 100)]
    pub server_order: Option<Vec<uuid::Uuid>>,
}

#[async_trait::async_trait]
impl UpdatableModel for UserServerGroup {
    type UpdateOptions = UpdateUserServerGroupOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateHandlerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateHandlerList<UserServerGroup>> =
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

        let mut query_builder = UpdateQueryBuilder::new("user_server_groups");

        self.run_update_handlers(&mut options, &mut query_builder, state, transaction)
            .await?;

        query_builder
            .set("name", options.name.as_ref())
            .set("server_order", options.server_order.as_ref())
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut **transaction).await?;

        if let Some(name) = options.name {
            self.name = name;
        }
        if let Some(server_order) = options.server_order {
            self.server_order = server_order;
        }

        self.run_after_update_handlers(state, transaction).await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl DeletableModel for UserServerGroup {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteHandlerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteHandlerList<UserServerGroup>> =
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
            DELETE FROM user_server_groups
            WHERE user_server_groups.uuid = $1
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
#[init_args(UserServerGroup, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "UserServerGroup")]
pub struct ApiUserServerGroup {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub order: i16,

    pub server_order: Vec<uuid::Uuid>,

    pub created: chrono::DateTime<chrono::Utc>,
}
