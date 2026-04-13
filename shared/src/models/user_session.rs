use crate::{
    models::{
        InsertQueryBuilder,
        user::{AuthMethod, GetAuthMethod},
    },
    prelude::*,
};
use garde::Validate;
use rand::distr::SampleString;
use serde::{Deserialize, Serialize};
use sha2::Digest;
use sqlx::{Row, postgres::PgRow};
use std::{
    collections::BTreeMap,
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, Clone)]
pub struct UserSession {
    pub uuid: uuid::Uuid,

    pub ip: sqlx::types::ipnetwork::IpNetwork,
    pub user_agent: String,

    pub last_used: chrono::NaiveDateTime,
    pub created: chrono::NaiveDateTime,
}

impl BaseModel for UserSession {
    const NAME: &'static str = "user_session";

    #[inline]
    fn columns(prefix: Option<&str>) -> BTreeMap<&'static str, compact_str::CompactString> {
        let prefix = prefix.unwrap_or_default();

        BTreeMap::from([
            (
                "user_sessions.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "user_sessions.ip",
                compact_str::format_compact!("{prefix}ip"),
            ),
            (
                "user_sessions.user_agent",
                compact_str::format_compact!("{prefix}user_agent"),
            ),
            (
                "user_sessions.last_used",
                compact_str::format_compact!("{prefix}last_used"),
            ),
            (
                "user_sessions.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ])
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            uuid: row.try_get(compact_str::format_compact!("{prefix}uuid").as_str())?,
            ip: row.try_get(compact_str::format_compact!("{prefix}ip").as_str())?,
            user_agent: row.try_get(compact_str::format_compact!("{prefix}user_agent").as_str())?,
            last_used: row.try_get(compact_str::format_compact!("{prefix}last_used").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
        })
    }
}

impl UserSession {
    pub async fn by_user_uuid_uuid(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM user_sessions
            WHERE user_sessions.user_uuid = $1 AND user_sessions.uuid = $2
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
            FROM user_sessions
            WHERE user_sessions.user_uuid = $1 AND ($2 IS NULL OR user_sessions.user_agent ILIKE '%' || $2 || '%')
            ORDER BY user_sessions.created DESC
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

    pub async fn delete_unused(database: &crate::database::Database) -> Result<u64, sqlx::Error> {
        Ok(sqlx::query(
            r#"
            DELETE FROM user_sessions
            WHERE user_sessions.last_used < NOW() - INTERVAL '30 days'
            "#,
        )
        .execute(database.write())
        .await?
        .rows_affected())
    }

    pub async fn update_last_used(
        &self,
        database: &Arc<crate::database::Database>,
        ip: impl Into<sqlx::types::ipnetwork::IpNetwork>,
        user_agent: &str,
    ) {
        let uuid = self.uuid;
        let now = chrono::Utc::now().naive_utc();
        let user_agent = crate::utils::slice_up_to(user_agent, 255).to_string();
        let ip = ip.into();

        database
            .batch_action("update_user_session", uuid, {
                let database = database.clone();

                async move {
                    sqlx::query!(
                        "UPDATE user_sessions
		                    SET ip = $2, user_agent = $3, last_used = $4
		                    WHERE user_sessions.uuid = $1",
                        uuid,
                        ip,
                        user_agent,
                        now
                    )
                    .execute(database.write())
                    .await?;

                    Ok(())
                }
            })
            .await;
    }

    #[inline]
    pub fn into_api_object(self, auth: &GetAuthMethod) -> ApiUserSession {
        ApiUserSession {
            uuid: self.uuid,
            ip: self.ip.ip().to_string(),
            user_agent: self.user_agent,
            is_using: match &**auth {
                AuthMethod::Session(session) => session.uuid == self.uuid,
                _ => false,
            },
            last_used: self.last_used.and_utc(),
            created: self.created.and_utc(),
        }
    }
}

#[derive(ToSchema, Deserialize, Validate)]
pub struct CreateUserSessionOptions {
    #[garde(skip)]
    pub user_uuid: uuid::Uuid,
    #[garde(skip)]
    #[schema(value_type = String)]
    pub ip: sqlx::types::ipnetwork::IpNetwork,
    #[garde(length(chars, min = 1, max = 1024))]
    #[schema(min_length = 1, max_length = 1024)]
    pub user_agent: compact_str::CompactString,
}

#[async_trait::async_trait]
impl CreatableModel for UserSession {
    type CreateOptions<'a> = CreateUserSessionOptions;
    type CreateResult = String;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<UserSession>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
    ) -> Result<Self::CreateResult, crate::database::DatabaseError> {
        options.validate()?;

        let mut transaction = state.database.write().begin().await?;

        let mut query_builder = InsertQueryBuilder::new("user_sessions");

        Self::run_create_handlers(&mut options, &mut query_builder, state, &mut transaction)
            .await?;

        let key_id = rand::distr::Alphanumeric.sample_string(&mut rand::rng(), 16);

        let mut hash = sha2::Sha256::new();
        hash.update(chrono::Utc::now().timestamp().to_le_bytes());
        hash.update(options.user_uuid.to_bytes_le());
        let hash = hex::encode(hash.finalize());

        query_builder
            .set("user_uuid", options.user_uuid)
            .set("key_id", key_id.clone())
            .set_expr("key", "crypt($1, gen_salt('xdes', 321))", vec![&hash])
            .set("ip", options.ip)
            .set("user_agent", &options.user_agent);

        query_builder.execute(&mut *transaction).await?;

        transaction.commit().await?;

        Ok(format!("{key_id}:{hash}"))
    }
}

#[async_trait::async_trait]
impl DeletableModel for UserSession {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteListenerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteListenerList<UserSession>> =
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
            DELETE FROM user_sessions
            WHERE user_sessions.uuid = $1
            "#,
        )
        .bind(self.uuid)
        .execute(&mut *transaction)
        .await?;

        transaction.commit().await?;

        Ok(())
    }
}

#[derive(ToSchema, Serialize, Deserialize)]
#[schema(title = "UserSession")]
pub struct ApiUserSession {
    pub uuid: uuid::Uuid,

    pub ip: String,
    pub user_agent: String,

    pub is_using: bool,

    pub last_used: chrono::DateTime<chrono::Utc>,
    pub created: chrono::DateTime<chrono::Utc>,
}
