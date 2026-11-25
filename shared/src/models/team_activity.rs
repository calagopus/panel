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

pub type GetTeamActivityLogger = crate::extract::ConsumingExtension<TeamActivityLogger>;

#[derive(Clone)]
pub struct TeamActivityLogger {
    pub state: State,
    pub team_uuid: uuid::Uuid,
    pub user_uuid: uuid::Uuid,
    pub impersonator_uuid: Option<uuid::Uuid>,
    pub api_key_uuid: Option<uuid::Uuid>,
    pub ip: std::net::IpAddr,
}

impl TeamActivityLogger {
    pub async fn log(&self, event: impl Into<compact_str::CompactString>, data: serde_json::Value) {
        let options = CreateTeamActivityOptions {
            team_uuid: self.team_uuid,
            user_uuid: Some(self.user_uuid),
            impersonator_uuid: self.impersonator_uuid,
            api_key_uuid: self.api_key_uuid,
            event: event.into(),
            ip: Some(self.ip.into()),
            data,
            created: None,
        };
        if let Err(err) = TeamActivity::create(&self.state, options).await {
            tracing::warn!(
                user = %self.user_uuid,
                "failed to log team activity: {:#?}",
                err
            );
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct TeamActivity {
    pub user: Option<super::user::User>,
    pub impersonator: Option<Fetchable<super::user::User>>,
    pub api_key: Option<Fetchable<super::user_api_key::UserApiKey>>,

    pub event: compact_str::CompactString,
    pub ip: Option<sqlx::types::ipnetwork::IpNetwork>,
    pub data: serde_json::Value,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for TeamActivity {
    const NAME: &'static str = "team_activity";

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
                "team_activities.impersonator_uuid",
                compact_str::format_compact!("{prefix}impersonator_uuid"),
            ),
            (
                "team_activities.api_key_uuid",
                compact_str::format_compact!("{prefix}api_key_uuid"),
            ),
            (
                "team_activities.event",
                compact_str::format_compact!("{prefix}event"),
            ),
            (
                "team_activities.ip",
                compact_str::format_compact!("{prefix}ip"),
            ),
            (
                "team_activities.data",
                compact_str::format_compact!("{prefix}data"),
            ),
            (
                "team_activities.created",
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
            user: if row.try_get::<uuid::Uuid, _>("user_uuid").is_ok() {
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
            event: row.try_get(compact_str::format_compact!("{prefix}event").as_str())?,
            ip: row.try_get(compact_str::format_compact!("{prefix}ip").as_str())?,
            data: row.try_get(compact_str::format_compact!("{prefix}data").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl TeamActivity {
    pub async fn by_team_uuid_with_pagination(
        database: &crate::database::Database,
        team_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        super::PaginatedQueryBuilder::new(
            Self::columns_sql(None),
            r#"
            FROM team_activities
            LEFT JOIN users ON users.uuid = team_activities.user_uuid
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            WHERE team_activities.team_uuid = $1 AND ($2 IS NULL OR team_activities.event ILIKE '%' || $2 || '%' OR users.username ILIKE '%' || $2 || '%')
            "#,
            "team_activities.created DESC, team_activities.ctid DESC",
        )
        .bind(team_uuid)
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
            DELETE FROM team_activities
            WHERE team_activities.created < $1
            "#,
        )
        .bind(cutoff.naive_utc())
        .execute(database.write())
        .await?;

        Ok(result.rows_affected())
    }

    pub async fn retain_latest_logs_per_team(
        database: &crate::database::Database,
        keep_count: i64,
    ) -> Result<u64, crate::database::DatabaseError> {
        let result = sqlx::query(
            r#"
            DELETE FROM team_activities
            WHERE ctid IN (
                SELECT ctid
                FROM (
                    SELECT
                        ctid,
                        ROW_NUMBER() OVER (PARTITION BY team_activities.team_uuid ORDER BY team_activities.created DESC, team_activities.ctid DESC) rn
                    FROM team_activities
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
impl IntoApiObject for TeamActivity {
    type ApiObject = ApiTeamActivity;
    type ExtraArgs<'a> = (&'a crate::storage::StorageUrlRetriever<'a>, bool);

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        (storage_url_retriever, show_ip): Self::ExtraArgs<'a>,
    ) -> Result<Self::ApiObject, crate::database::DatabaseError> {
        let api_object = ApiTeamActivity::init_hooks(&self, state).await?;

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
            ApiTeamActivity {
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
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[derive(ToSchema, Deserialize, Validate)]
pub struct CreateTeamActivityOptions {
    #[garde(skip)]
    pub team_uuid: uuid::Uuid,
    #[garde(skip)]
    pub user_uuid: Option<uuid::Uuid>,
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
impl CreatableModel for TeamActivity {
    type CreateOptions<'a> = CreateTeamActivityOptions;
    type CreateResult = ();

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<TeamActivity>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create_with_transaction(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self::CreateResult, crate::database::DatabaseError> {
        options.validate()?;

        let mut query_builder = InsertQueryBuilder::new("team_activities");

        Self::run_create_handlers(&mut options, &mut query_builder, state, transaction).await?;

        query_builder
            .set("team_uuid", options.team_uuid)
            .set("user_uuid", options.user_uuid)
            .set("impersonator_uuid", options.impersonator_uuid)
            .set("api_key_uuid", options.api_key_uuid)
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
#[init_args(TeamActivity, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "TeamActivity")]
pub struct ApiTeamActivity {
    pub user: Option<super::user::ApiUser>,
    pub impersonator: Option<super::user::ApiUser>,

    pub event: compact_str::CompactString,
    pub ip: Option<compact_str::CompactString>,
    pub data: serde_json::Value,

    pub is_api: bool,

    pub created: chrono::DateTime<chrono::Utc>,
}
