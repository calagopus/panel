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

#[derive(ToSchema, Validate, Serialize, Deserialize)]
pub struct ExportedServerScheduleStep {
    #[garde(dive)]
    pub action: wings_api::ScheduleActionInner,
    #[garde(skip)]
    pub order: i16,
}

#[derive(Serialize, Deserialize)]
pub struct ServerScheduleStep {
    pub uuid: uuid::Uuid,

    pub action: wings_api::ScheduleActionInner,
    pub order: i16,
    pub error: Option<compact_str::CompactString>,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for ServerScheduleStep {
    const NAME: &'static str = "server_schedule_step";

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
                "server_schedule_steps.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "server_schedule_steps.action",
                compact_str::format_compact!("{prefix}action"),
            ),
            (
                "server_schedule_steps.order_",
                compact_str::format_compact!("{prefix}order"),
            ),
            (
                "server_schedule_steps.error",
                compact_str::format_compact!("{prefix}error"),
            ),
            (
                "server_schedule_steps.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ])
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            uuid: row.try_get(compact_str::format_compact!("{prefix}uuid").as_str())?,
            action: serde_json::from_value(
                row.try_get(compact_str::format_compact!("{prefix}action").as_str())?,
            )?,
            order: row.try_get(compact_str::format_compact!("{prefix}order").as_str())?,
            error: row.try_get(compact_str::format_compact!("{prefix}error").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl ServerScheduleStep {
    pub async fn by_schedule_uuid_uuid(
        database: &crate::database::Database,
        schedule_uuid: uuid::Uuid,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM server_schedule_steps
            WHERE server_schedule_steps.schedule_uuid = $1 AND server_schedule_steps.uuid = $2
            "#,
            Self::columns_sql(None)
        )))
        .bind(schedule_uuid)
        .bind(uuid)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn all_by_schedule_uuid(
        database: &crate::database::Database,
        schedule_uuid: uuid::Uuid,
    ) -> Result<Vec<Self>, crate::database::DatabaseError> {
        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM server_schedule_steps
            WHERE server_schedule_steps.schedule_uuid = $1
            ORDER BY server_schedule_steps.order_, server_schedule_steps.created
            "#,
            Self::columns_sql(None)
        )))
        .bind(schedule_uuid)
        .fetch_all(database.read())
        .await?;

        rows.into_iter()
            .map(|row| Self::map(None, &row))
            .try_collect_vec()
    }

    pub async fn count_by_schedule_uuid(
        database: &crate::database::Database,
        schedule_uuid: uuid::Uuid,
    ) -> Result<i64, sqlx::Error> {
        sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM server_schedule_steps
            WHERE server_schedule_steps.schedule_uuid = $1
            "#,
        )
        .bind(schedule_uuid)
        .fetch_one(database.read())
        .await
    }

    #[inline]
    pub fn into_exported(self) -> ExportedServerScheduleStep {
        ExportedServerScheduleStep {
            action: self.action,
            order: self.order,
        }
    }
}

#[async_trait::async_trait]
impl IntoApiObject for ServerScheduleStep {
    type ApiObject = ApiServerScheduleStep;
    type ExtraArgs<'a> = ();

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::ApiObject, crate::database::DatabaseError> {
        let api_object = ApiServerScheduleStep::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            ApiServerScheduleStep {
                uuid: self.uuid,
                action: self.action,
                order: self.order,
                error: self.error,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[derive(ToSchema, Deserialize, Validate)]
pub struct CreateServerScheduleStepOptions {
    #[garde(skip)]
    pub schedule_uuid: uuid::Uuid,
    #[garde(dive)]
    pub action: wings_api::ScheduleActionInner,
    #[garde(skip)]
    pub order: i16,
}

#[async_trait::async_trait]
impl CreatableModel for ServerScheduleStep {
    type CreateOptions<'a> = CreateServerScheduleStepOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<ServerScheduleStep>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create_with_transaction(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        let mut query_builder = InsertQueryBuilder::new("server_schedule_steps");

        Self::run_create_handlers(&mut options, &mut query_builder, state, transaction).await?;

        query_builder
            .set("schedule_uuid", options.schedule_uuid)
            .set("action", serde_json::to_value(&options.action)?)
            .set("order_", options.order);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut **transaction)
            .await?;
        let mut step = Self::map(None, &row)?;

        Self::run_after_create_handlers(&mut step, &options, state, transaction).await?;

        Ok(step)
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Default)]
pub struct UpdateServerScheduleStepOptions {
    #[garde(dive)]
    pub action: Option<wings_api::ScheduleActionInner>,
    #[garde(skip)]
    pub order: Option<i16>,
}

#[async_trait::async_trait]
impl UpdatableModel for ServerScheduleStep {
    type UpdateOptions = UpdateServerScheduleStepOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateHandlerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateHandlerList<ServerScheduleStep>> =
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

        let mut query_builder = UpdateQueryBuilder::new("server_schedule_steps");

        self.run_update_handlers(&mut options, &mut query_builder, state, transaction)
            .await?;

        query_builder
            .set(
                "action",
                if let Some(action) = &options.action {
                    Some(serde_json::to_value(action)?)
                } else {
                    None
                },
            )
            .set("order_", options.order)
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut **transaction).await?;

        if let Some(action) = options.action {
            self.action = action;
        }
        if let Some(order) = options.order {
            self.order = order;
        }

        self.run_after_update_handlers(state, transaction).await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl DeletableModel for ServerScheduleStep {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteHandlerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteHandlerList<ServerScheduleStep>> =
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
            DELETE FROM server_schedule_steps
            WHERE server_schedule_steps.uuid = $1
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
pub struct DuplicateServerScheduleStepOptions {
    #[garde(skip)]
    pub schedule_uuid: uuid::Uuid,
}

#[async_trait::async_trait]
impl DuplicableModel for ServerScheduleStep {
    type DuplicateOptions<'a> = DuplicateServerScheduleStepOptions;

    fn get_duplicate_handlers() -> &'static LazyLock<DuplicateHandlerList<Self>> {
        static DUPLICATE_LISTENERS: LazyLock<DuplicateHandlerList<ServerScheduleStep>> =
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

        let mut query_builder = InsertQueryBuilder::new("server_schedule_steps");

        query_builder
            .set("schedule_uuid", options.schedule_uuid)
            .set("action", serde_json::to_value(&self.action)?)
            .set("order_", self.order);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut **transaction)
            .await?;
        let mut step = Self::map(None, &row)?;

        self.run_after_duplicate_handlers(&mut step, &options, state, transaction)
            .await?;

        Ok(step)
    }
}

#[schema_extension_derive::extendible]
#[init_args(ServerScheduleStep, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "ServerScheduleStep")]
pub struct ApiServerScheduleStep {
    pub uuid: uuid::Uuid,

    pub action: wings_api::ScheduleActionInner,
    pub order: i16,
    pub error: Option<compact_str::CompactString>,

    pub created: chrono::DateTime<chrono::Utc>,
}
