use crate::{models::InsertQueryBuilder, prelude::*};
use compact_str::ToCompactString;
use garde::Validate;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{
    collections::BTreeMap,
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

#[derive(Serialize, Deserialize)]
pub struct ServerActivity {
    pub user: Option<super::user::User>,
    pub impersonator: Option<Fetchable<super::user::User>>,
    pub api_key: Option<Fetchable<super::user_api_key::UserApiKey>>,
    pub schedule: Option<Fetchable<super::server_schedule::ServerSchedule>>,

    pub event: compact_str::CompactString,
    pub ip: Option<sqlx::types::ipnetwork::IpNetwork>,
    pub data: serde_json::Value,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for ServerActivity {
    const NAME: &'static str = "server_activity";

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

        let mut columns = BTreeMap::from([
            (
                "server_activities.impersonator_uuid",
                compact_str::format_compact!("{prefix}impersonator_uuid"),
            ),
            (
                "server_activities.api_key_uuid",
                compact_str::format_compact!("{prefix}api_key_uuid"),
            ),
            (
                "server_activities.schedule_uuid",
                compact_str::format_compact!("{prefix}schedule_uuid"),
            ),
            (
                "server_activities.event",
                compact_str::format_compact!("{prefix}event"),
            ),
            (
                "server_activities.ip",
                compact_str::format_compact!("{prefix}ip"),
            ),
            (
                "server_activities.data",
                compact_str::format_compact!("{prefix}data"),
            ),
            (
                "server_activities.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ]);

        columns.extend(super::user::User::base_columns(Some("user_")));

        columns
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            user: if row
                .try_get::<uuid::Uuid, _>("user_uuid".to_string().as_str())
                .is_ok()
            {
                Some(super::user::User::map(Some("user_"), row)?)
            } else {
                None
            },
            impersonator: super::user::User::get_fetchable_from_row(
                row,
                compact_str::format_compact!("{prefix}impersonator_uuid"),
            ),
            api_key: super::user_api_key::UserApiKey::get_fetchable_from_row(
                row,
                compact_str::format_compact!("{prefix}api_key_uuid"),
            ),
            schedule: super::server_schedule::ServerSchedule::get_fetchable_from_row(
                row,
                compact_str::format_compact!("{prefix}schedule_uuid"),
            ),
            event: row.try_get(compact_str::format_compact!("{prefix}event").as_str())?,
            ip: row.try_get(compact_str::format_compact!("{prefix}ip").as_str())?,
            data: row.try_get(compact_str::format_compact!("{prefix}data").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl ServerActivity {
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
            FROM server_activities
            LEFT JOIN users ON users.uuid = server_activities.user_uuid
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            WHERE server_activities.server_uuid = $1 AND ($2 IS NULL OR server_activities.event ILIKE '%' || $2 || '%' OR users.username ILIKE '%' || $2 || '%')
            ORDER BY server_activities.created DESC
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

    pub async fn delete_older_than(
        database: &crate::database::Database,
        cutoff: chrono::DateTime<chrono::Utc>,
    ) -> Result<u64, crate::database::DatabaseError> {
        let result = sqlx::query(
            r#"
            DELETE FROM server_activities
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
impl IntoApiObject for ServerActivity {
    type ApiObject = ApiServerActivity;
    type ExtraArgs<'a> = &'a crate::storage::StorageUrlRetriever<'a>;

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        storage_url_retriever: Self::ExtraArgs<'a>,
    ) -> Result<Self::ApiObject, crate::database::DatabaseError> {
        let api_object = ApiServerActivity::init_hooks(&self, state).await?;

        let user = if let Some(user) = self.user {
            Some(user.into_api_object(state, storage_url_retriever).await?)
        } else {
            None
        };

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
            ApiServerActivity {
                user,
                impersonator,
                event: self.event,
                ip: self.ip.map(|ip| ip.ip().to_compact_string()),
                data: self.data,
                is_api: self.api_key.is_some(),
                is_schedule: self.schedule.is_some(),
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[derive(ToSchema, Deserialize, Validate)]
pub struct CreateServerActivityOptions {
    #[garde(skip)]
    pub server_uuid: uuid::Uuid,
    #[garde(skip)]
    pub user_uuid: Option<uuid::Uuid>,
    #[garde(skip)]
    pub impersonator_uuid: Option<uuid::Uuid>,
    #[garde(skip)]
    pub api_key_uuid: Option<uuid::Uuid>,
    #[garde(skip)]
    pub schedule_uuid: Option<uuid::Uuid>,
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
impl CreatableModel for ServerActivity {
    type CreateOptions<'a> = CreateServerActivityOptions;
    type CreateResult = ();

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<ServerActivity>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
    ) -> Result<Self::CreateResult, crate::database::DatabaseError> {
        options.validate()?;

        let mut transaction = state.database.write().begin().await?;

        let mut query_builder = InsertQueryBuilder::new("server_activities");

        Self::run_create_handlers(&mut options, &mut query_builder, state, &mut transaction)
            .await?;

        query_builder
            .set("server_uuid", options.server_uuid)
            .set("user_uuid", options.user_uuid)
            .set("impersonator_uuid", options.impersonator_uuid)
            .set("api_key_uuid", options.api_key_uuid)
            .set("schedule_uuid", options.schedule_uuid)
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
#[init_args(ServerActivity, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "ServerActivity")]
pub struct ApiServerActivity {
    pub user: Option<super::user::ApiUser>,
    pub impersonator: Option<super::user::ApiUser>,

    pub event: compact_str::CompactString,
    pub ip: Option<compact_str::CompactString>,
    pub data: serde_json::Value,

    pub is_api: bool,
    pub is_schedule: bool,

    pub created: chrono::DateTime<chrono::Utc>,
}
