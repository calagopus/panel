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
            LazyLock::new(|| parking_lot::RwLock::new(Vec::new()));

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
    /// Inserts every row in one statement when no create handlers are registered and every row
    /// validates. Returns `false` without writing anything when that is not possible, so the
    /// caller can fall back to per-row [`CreatableModel::create`].
    pub async fn try_create_many(
        database: &crate::database::Database,
        options: &[CreateServerActivityOptions],
    ) -> Result<bool, crate::database::DatabaseError> {
        if !Self::get_create_handlers().is_empty()
            || options.iter().any(|options| options.validate().is_err())
        {
            return Ok(false);
        }

        if options.is_empty() {
            return Ok(true);
        }

        let mut server_uuids = Vec::with_capacity(options.len());
        let mut user_uuids = Vec::with_capacity(options.len());
        let mut impersonator_uuids = Vec::with_capacity(options.len());
        let mut api_key_uuids = Vec::with_capacity(options.len());
        let mut schedule_uuids = Vec::with_capacity(options.len());
        let mut events = Vec::with_capacity(options.len());
        let mut ips = Vec::with_capacity(options.len());
        let mut data = Vec::with_capacity(options.len());
        let mut created = Vec::with_capacity(options.len());

        for options in options {
            server_uuids.push(options.server_uuid);
            user_uuids.push(options.user_uuid);
            impersonator_uuids.push(options.impersonator_uuid);
            api_key_uuids.push(options.api_key_uuid);
            schedule_uuids.push(options.schedule_uuid);
            events.push(options.event.as_str());
            ips.push(options.ip);
            data.push(&options.data);
            created.push(options.created);
        }

        sqlx::query!(
            r#"INSERT INTO server_activities (server_uuid, user_uuid, impersonator_uuid, api_key_uuid, schedule_uuid, event, ip, data, created)
            SELECT rows.server_uuid, rows.user_uuid, rows.impersonator_uuid, rows.api_key_uuid, rows.schedule_uuid, rows.event, rows.ip, rows.data, COALESCE(rows.created, NOW())
            FROM UNNEST($1::uuid[], $2::uuid[], $3::uuid[], $4::uuid[], $5::uuid[], $6::varchar[], $7::inet[], $8::jsonb[], $9::timestamp[])
                AS rows(server_uuid, user_uuid, impersonator_uuid, api_key_uuid, schedule_uuid, event, ip, data, created)"#,
            &server_uuids,
            &user_uuids as &[Option<uuid::Uuid>],
            &impersonator_uuids as &[Option<uuid::Uuid>],
            &api_key_uuids as &[Option<uuid::Uuid>],
            &schedule_uuids as &[Option<uuid::Uuid>],
            &events as &[&str],
            &ips as &[Option<sqlx::types::ipnetwork::IpNetwork>],
            &data as &[&serde_json::Value],
            &created as &[Option<chrono::NaiveDateTime>],
        )
        .execute(database.write())
        .await?;

        Ok(true)
    }

    pub async fn by_server_uuid_with_pagination(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        super::PaginatedQueryBuilder::new(
            Self::columns_sql(None),
            r#"
            FROM server_activities
            LEFT JOIN users ON users.uuid = server_activities.user_uuid
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            WHERE server_activities.server_uuid = $1 AND ($2 IS NULL OR server_activities.event ILIKE '%' || $2 || '%' OR users.username ILIKE '%' || $2 || '%')
            "#,
            "server_activities.created DESC",
        )
        .bind(server_uuid)
        .bind(search)
        .fetch(database, page, per_page)
        .await
    }

    pub async fn by_server_uuid_user_uuid_with_pagination(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
        user_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        super::PaginatedQueryBuilder::new(
            Self::columns_sql(None),
            r#"
            FROM server_activities
            LEFT JOIN users ON users.uuid = server_activities.user_uuid
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            WHERE server_activities.server_uuid = $1 AND server_activities.user_uuid = $2
                AND ($3 IS NULL OR server_activities.event ILIKE '%' || $3 || '%')
            "#,
            "server_activities.created DESC",
        )
        .bind(server_uuid)
        .bind(user_uuid)
        .bind(search)
        .fetch(database, page, per_page)
        .await
    }

    pub async fn delete_older_than(
        database: &crate::database::Database,
        cutoff: chrono::DateTime<chrono::Utc>,
    ) -> Result<u64, crate::database::DatabaseError> {
        let result = sqlx::query(
            r#"
            DELETE FROM server_activities
            WHERE server_activities.created < $1
            "#,
        )
        .bind(cutoff.naive_utc())
        .execute(database.write())
        .await?;

        Ok(result.rows_affected())
    }

    pub async fn retain_latest_logs_per_server(
        database: &crate::database::Database,
        keep_count: i64,
    ) -> Result<u64, crate::database::DatabaseError> {
        let result = sqlx::query(
            r#"
            DELETE FROM server_activities
            WHERE ctid IN (
                SELECT ctid 
                FROM (
                    SELECT
                        ctid, 
                        ROW_NUMBER() OVER (PARTITION BY server_activities.server_uuid ORDER BY server_activities.created DESC) rn
                    FROM server_activities
                ) sub
                WHERE sub.rn > $1
            )
            "#,
        )
        .bind(keep_count)
        .execute(database.write())
        .await?;

        Ok(result.rows_affected())
    }
}

#[async_trait::async_trait]
impl IntoApiObject for ServerActivity {
    type ApiObject = ApiServerActivity;
    type ExtraArgs<'a> = (&'a crate::storage::StorageUrlRetriever<'a>, bool);

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        (storage_url_retriever, show_ip): Self::ExtraArgs<'a>,
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
                ip: if show_ip {
                    self.ip.map(|ip| ip.ip().to_compact_string())
                } else {
                    None
                },
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

    async fn create_with_transaction(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self::CreateResult, crate::database::DatabaseError> {
        options.validate()?;

        let mut query_builder = InsertQueryBuilder::new("server_activities");

        Self::run_create_handlers(&mut options, &mut query_builder, state, transaction).await?;

        query_builder
            .set("server_uuid", options.server_uuid)
            .set("user_uuid", options.user_uuid)
            .set("impersonator_uuid", options.impersonator_uuid)
            .set("api_key_uuid", options.api_key_uuid)
            .set("schedule_uuid", options.schedule_uuid)
            .set("event", &options.event)
            .set("ip", options.ip)
            .set("data", &options.data);

        if let Some(created) = options.created {
            query_builder.set("created", created);
        }

        query_builder.execute(&mut **transaction).await?;

        let mut result = ();

        Self::run_after_create_handlers(&mut result, &options, state, transaction).await?;

        Ok(result)
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
