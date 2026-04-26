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
pub struct ExportedServerSchedule {
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: compact_str::CompactString,
    #[garde(skip)]
    pub enabled: bool,

    #[garde(dive)]
    pub triggers: Vec<wings_api::ScheduleTrigger>,
    #[garde(dive)]
    pub condition: wings_api::SchedulePreCondition,

    #[garde(dive)]
    pub steps: Vec<super::server_schedule_step::ExportedServerScheduleStep>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ServerSchedule {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub enabled: bool,

    pub triggers: Vec<wings_api::ScheduleTrigger>,
    pub condition: wings_api::SchedulePreCondition,

    pub last_run: Option<chrono::NaiveDateTime>,
    pub last_failure: Option<chrono::NaiveDateTime>,
    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for ServerSchedule {
    const NAME: &'static str = "server_schedule";

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
                "server_schedules.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "server_schedules.name",
                compact_str::format_compact!("{prefix}name"),
            ),
            (
                "server_schedules.enabled",
                compact_str::format_compact!("{prefix}enabled"),
            ),
            (
                "server_schedules.triggers",
                compact_str::format_compact!("{prefix}triggers"),
            ),
            (
                "server_schedules.condition",
                compact_str::format_compact!("{prefix}condition"),
            ),
            (
                "server_schedules.last_run",
                compact_str::format_compact!("{prefix}last_run"),
            ),
            (
                "server_schedules.last_failure",
                compact_str::format_compact!("{prefix}last_failure"),
            ),
            (
                "server_schedules.created",
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
            enabled: row.try_get(compact_str::format_compact!("{prefix}enabled").as_str())?,
            triggers: serde_json::from_value(
                row.try_get(compact_str::format_compact!("{prefix}triggers").as_str())?,
            )?,
            condition: serde_json::from_value(
                row.try_get(compact_str::format_compact!("{prefix}condition").as_str())?,
            )?,
            last_run: row.try_get(compact_str::format_compact!("{prefix}last_run").as_str())?,
            last_failure: row
                .try_get(compact_str::format_compact!("{prefix}last_failure").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl ServerSchedule {
    pub async fn by_server_uuid_uuid(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM server_schedules
            WHERE server_schedules.server_uuid = $1 AND server_schedules.uuid = $2
            "#,
            Self::columns_sql(None)
        ))
        .bind(server_uuid)
        .bind(uuid)
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
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(&format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM server_schedules
            WHERE server_schedules.server_uuid = $1 AND ($2 IS NULL OR server_schedules.name ILIKE '%' || $2 || '%')
            ORDER BY server_schedules.created
            LIMIT $3 OFFSET $4
            "#,
            Self::columns_sql(None)
        ))
        .bind(server_uuid)
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

    pub async fn count_by_server_uuid(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
    ) -> i64 {
        sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM server_schedules
            WHERE server_schedules.server_uuid = $1
            "#,
        )
        .bind(server_uuid)
        .fetch_one(database.read())
        .await
        .unwrap_or(0)
    }

    #[inline]
    pub async fn into_exported(
        self,
        database: &crate::database::Database,
    ) -> Result<ExportedServerSchedule, crate::database::DatabaseError> {
        Ok(ExportedServerSchedule {
            name: self.name,
            enabled: self.enabled,
            triggers: self.triggers,
            condition: self.condition,
            steps: super::server_schedule_step::ServerScheduleStep::all_by_schedule_uuid(
                database, self.uuid,
            )
            .await?
            .into_iter()
            .map(|step| step.into_exported())
            .collect(),
        })
    }
}

#[async_trait::async_trait]
impl IntoApiObject for ServerSchedule {
    type ApiObject = ApiServerSchedule;
    type ExtraArgs<'a> = ();

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::ApiObject, crate::database::DatabaseError> {
        let api_object = ApiServerSchedule::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            ApiServerSchedule {
                uuid: self.uuid,
                name: self.name,
                enabled: self.enabled,
                triggers: self.triggers,
                condition: self.condition,
                last_run: self.last_run.map(|dt| dt.and_utc()),
                last_failure: self.last_failure.map(|dt| dt.and_utc()),
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[derive(ToSchema, Deserialize, Validate)]
pub struct CreateServerScheduleOptions {
    #[garde(skip)]
    pub server_uuid: uuid::Uuid,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: compact_str::CompactString,
    #[garde(skip)]
    pub enabled: bool,
    #[garde(dive)]
    pub triggers: Vec<wings_api::ScheduleTrigger>,
    #[garde(dive)]
    pub condition: wings_api::SchedulePreCondition,
}

#[async_trait::async_trait]
impl CreatableModel for ServerSchedule {
    type CreateOptions<'a> = CreateServerScheduleOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<ServerSchedule>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        let mut transaction = state.database.write().begin().await?;

        let mut query_builder = InsertQueryBuilder::new("server_schedules");

        Self::run_create_handlers(&mut options, &mut query_builder, state, &mut transaction)
            .await?;

        query_builder
            .set("server_uuid", options.server_uuid)
            .set("name", &options.name)
            .set("enabled", options.enabled)
            .set("triggers", serde_json::to_value(&options.triggers)?)
            .set("condition", serde_json::to_value(&options.condition)?);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut *transaction)
            .await?;
        let schedule = Self::map(None, &row)?;

        transaction.commit().await?;

        Ok(schedule)
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Default)]
pub struct UpdateServerScheduleOptions {
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: Option<compact_str::CompactString>,
    #[garde(skip)]
    pub enabled: Option<bool>,
    #[garde(dive)]
    pub triggers: Option<Vec<wings_api::ScheduleTrigger>>,
    #[garde(dive)]
    pub condition: Option<wings_api::SchedulePreCondition>,
}

#[async_trait::async_trait]
impl UpdatableModel for ServerSchedule {
    type UpdateOptions = UpdateServerScheduleOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateListenerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateListenerList<ServerSchedule>> =
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

        let mut query_builder = UpdateQueryBuilder::new("server_schedules");

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
            .set("enabled", options.enabled)
            .set(
                "triggers",
                if let Some(triggers) = &options.triggers {
                    Some(serde_json::to_value(triggers)?)
                } else {
                    None
                },
            )
            .set(
                "condition",
                if let Some(condition) = &options.condition {
                    Some(serde_json::to_value(condition)?)
                } else {
                    None
                },
            )
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut *transaction).await?;

        if let Some(name) = options.name {
            self.name = name;
        }
        if let Some(enabled) = options.enabled {
            self.enabled = enabled;
        }
        if let Some(triggers) = options.triggers {
            self.triggers = triggers;
        }
        if let Some(condition) = options.condition {
            self.condition = condition;
        }

        transaction.commit().await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl ByUuid for ServerSchedule {
    async fn by_uuid(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
    ) -> Result<Self, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM server_schedules
            WHERE server_schedules.uuid = $1
            "#,
            Self::columns_sql(None)
        ))
        .bind(uuid)
        .fetch_one(database.read())
        .await?;

        Self::map(None, &row)
    }
}

#[async_trait::async_trait]
impl DeletableModel for ServerSchedule {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteListenerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteListenerList<ServerSchedule>> =
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
            DELETE FROM server_schedules
            WHERE server_schedules.uuid = $1
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
#[init_args(ServerSchedule, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "ServerSchedule")]
pub struct ApiServerSchedule {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub enabled: bool,

    pub triggers: Vec<wings_api::ScheduleTrigger>,
    pub condition: wings_api::SchedulePreCondition,

    pub last_run: Option<chrono::DateTime<chrono::Utc>>,
    pub last_failure: Option<chrono::DateTime<chrono::Utc>>,
    pub created: chrono::DateTime<chrono::Utc>,
}
