use crate::{State, models::InsertQueryBuilder, prelude::*};
use compact_str::ToCompactString;
use garde::Validate;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{
    collections::BTreeMap,
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

pub type GetUserActivityLogger = crate::extract::ConsumingExtension<UserActivityLogger>;

#[derive(Clone)]
pub struct UserActivityLogger {
    pub state: State,
    pub user_uuid: uuid::Uuid,
    pub impersonator_uuid: Option<uuid::Uuid>,
    pub api_key_uuid: Option<uuid::Uuid>,
    pub ip: std::net::IpAddr,
}

impl UserActivityLogger {
    pub async fn log(&self, event: impl Into<compact_str::CompactString>, data: serde_json::Value) {
        let options = CreateUserActivityOptions {
            user_uuid: self.user_uuid,
            impersonator_uuid: self.impersonator_uuid,
            api_key_uuid: self.api_key_uuid,
            event: event.into(),
            ip: Some(self.ip.into()),
            data,
            created: None,
        };
        if let Err(err) = UserActivity::create(&self.state, options).await {
            tracing::warn!(
                user = %self.user_uuid,
                "failed to log user activity: {:#?}",
                err
            );
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct UserActivity {
    pub impersonator: Option<Fetchable<super::user::User>>,
    pub api_key: Option<Fetchable<super::user_api_key::UserApiKey>>,

    pub event: compact_str::CompactString,
    pub ip: Option<sqlx::types::ipnetwork::IpNetwork>,
    pub data: serde_json::Value,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for UserActivity {
    const NAME: &'static str = "user_activity";

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
                "user_activities.impersonator_uuid",
                compact_str::format_compact!("{prefix}impersonator_uuid"),
            ),
            (
                "user_activities.api_key_uuid",
                compact_str::format_compact!("{prefix}api_key_uuid"),
            ),
            (
                "user_activities.event",
                compact_str::format_compact!("{prefix}event"),
            ),
            (
                "user_activities.ip",
                compact_str::format_compact!("{prefix}ip"),
            ),
            (
                "user_activities.data",
                compact_str::format_compact!("{prefix}data"),
            ),
            (
                "user_activities.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ])
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            impersonator: super::user::User::get_fetchable_from_row(
                row,
                compact_str::format_compact!("{prefix}impersonator_uuid"),
            ),
            api_key: super::user_api_key::UserApiKey::get_fetchable_from_row(
                row,
                compact_str::format_compact!("{prefix}api_key_uuid"),
            ),
            event: row.try_get(compact_str::format_compact!("{prefix}event").as_str())?,
            ip: row.try_get(compact_str::format_compact!("{prefix}ip").as_str())?,
            data: row.try_get(compact_str::format_compact!("{prefix}data").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl UserActivity {
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
            FROM user_activities
            WHERE user_activities.user_uuid = $1 AND ($2 IS NULL OR user_activities.event ILIKE '%' || $2 || '%')
            ORDER BY user_activities.created DESC
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

    pub async fn delete_older_than(
        database: &crate::database::Database,
        cutoff: chrono::DateTime<chrono::Utc>,
    ) -> Result<u64, crate::database::DatabaseError> {
        let result = sqlx::query(
            r#"
            DELETE FROM user_activities
            WHERE created < $1
            "#,
        )
        .bind(cutoff.naive_utc())
        .execute(database.write())
        .await?;

        Ok(result.rows_affected())
    }
}

#[async_trait::async_trait]
impl IntoApiObject for UserActivity {
    type ApiObject = ApiUserActivity;
    type ExtraArgs<'a> = &'a crate::storage::StorageUrlRetriever<'a>;

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        storage_url_retriever: Self::ExtraArgs<'a>,
    ) -> Result<Self::ApiObject, crate::database::DatabaseError> {
        let api_object = ApiUserActivity::init_hooks(&self, state).await?;

        let impersonator = if let Some(impersonator) = self.impersonator {
            Some(
                impersonator
                    .fetch_cached(&state.database)
                    .await?
                    .into_api_object(state, storage_url_retriever)
                    .await?,
            )
        } else {
            None
        };

        let api_object = finish_extendible!(
            ApiUserActivity {
                impersonator,
                event: self.event,
                ip: self.ip.map(|ip| ip.ip().to_compact_string()),
                data: self.data,
                is_api: self.api_key.is_some(),
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[derive(ToSchema, Deserialize, Validate)]
pub struct CreateUserActivityOptions {
    #[garde(skip)]
    pub user_uuid: uuid::Uuid,
    #[garde(skip)]
    pub impersonator_uuid: Option<uuid::Uuid>,
    #[garde(skip)]
    pub api_key_uuid: Option<uuid::Uuid>,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub event: compact_str::CompactString,
    #[garde(skip)]
    #[schema(value_type = Option<String>)]
    pub ip: Option<sqlx::types::ipnetwork::IpNetwork>,
    #[garde(skip)]
    pub data: serde_json::Value,
    #[garde(skip)]
    pub created: Option<chrono::NaiveDateTime>,
}

#[async_trait::async_trait]
impl CreatableModel for UserActivity {
    type CreateOptions<'a> = CreateUserActivityOptions;
    type CreateResult = ();

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<UserActivity>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
    ) -> Result<Self::CreateResult, crate::database::DatabaseError> {
        options.validate()?;

        let mut transaction = state.database.write().begin().await?;

        let mut query_builder = InsertQueryBuilder::new("user_activities");

        Self::run_create_handlers(&mut options, &mut query_builder, state, &mut transaction)
            .await?;

        query_builder
            .set("user_uuid", options.user_uuid)
            .set("impersonator_uuid", options.impersonator_uuid)
            .set("api_key_uuid", options.api_key_uuid)
            .set("event", &options.event)
            .set("ip", options.ip)
            .set("data", options.data);

        if let Some(created) = options.created {
            query_builder.set("created", created);
        }

        query_builder.execute(&mut *transaction).await?;

        transaction.commit().await?;

        Ok(())
    }
}

#[schema_extension_derive::extendible]
#[init_args(UserActivity, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "UserActivity")]
pub struct ApiUserActivity {
    pub impersonator: Option<super::user::ApiUser>,

    pub event: compact_str::CompactString,
    pub ip: Option<compact_str::CompactString>,
    pub data: serde_json::Value,

    pub is_api: bool,

    pub created: chrono::DateTime<chrono::Utc>,
}
