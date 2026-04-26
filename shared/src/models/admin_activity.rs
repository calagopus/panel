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

pub type GetAdminActivityLogger = crate::extract::ConsumingExtension<AdminActivityLogger>;

#[derive(Clone)]
pub struct AdminActivityLogger {
    pub state: State,
    pub user_uuid: uuid::Uuid,
    pub impersonator_uuid: Option<uuid::Uuid>,
    pub api_key_uuid: Option<uuid::Uuid>,
    pub ip: std::net::IpAddr,
}

impl AdminActivityLogger {
    pub async fn log(&self, event: impl Into<compact_str::CompactString>, data: serde_json::Value) {
        let options = CreateAdminActivityOptions {
            user_uuid: Some(self.user_uuid),
            impersonator_uuid: self.impersonator_uuid,
            api_key_uuid: self.api_key_uuid,
            event: event.into(),
            ip: Some(self.ip.into()),
            data,
            created: None,
        };
        if let Err(err) = AdminActivity::create(&self.state, options).await {
            tracing::warn!(
                user = %self.user_uuid,
                "failed to log admin activity: {:#?}",
                err
            );
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct AdminActivity {
    pub user: Option<super::user::User>,
    pub impersonator: Option<Fetchable<super::user::User>>,
    pub api_key: Option<Fetchable<super::user_api_key::UserApiKey>>,

    pub event: compact_str::CompactString,
    pub ip: Option<sqlx::types::ipnetwork::IpNetwork>,
    pub data: serde_json::Value,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for AdminActivity {
    const NAME: &'static str = "admin_activity";

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
                "admin_activities.impersonator_uuid",
                compact_str::format_compact!("{prefix}impersonator_uuid"),
            ),
            (
                "admin_activities.api_key_uuid",
                compact_str::format_compact!("{prefix}api_key_uuid"),
            ),
            (
                "admin_activities.event",
                compact_str::format_compact!("{prefix}event"),
            ),
            (
                "admin_activities.ip",
                compact_str::format_compact!("{prefix}ip"),
            ),
            (
                "admin_activities.data",
                compact_str::format_compact!("{prefix}data"),
            ),
            (
                "admin_activities.created",
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
                compact_str::format_compact!("{prefix}api_key_uuid").as_str(),
            ),
            event: row.try_get(compact_str::format_compact!("{prefix}event").as_str())?,
            ip: row.try_get(compact_str::format_compact!("{prefix}ip").as_str())?,
            data: row.try_get(compact_str::format_compact!("{prefix}data").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl AdminActivity {
    pub async fn all_with_pagination(
        database: &crate::database::Database,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(&format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM admin_activities
            LEFT JOIN users ON users.uuid = admin_activities.user_uuid
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            WHERE ($1 IS NULL OR admin_activities.event ILIKE '%' || $1 || '%' OR users.username ILIKE '%' || $1 || '%')
            ORDER BY admin_activities.created DESC
            LIMIT $2 OFFSET $3
            "#,
            Self::columns_sql(None)
        ))
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
        let result = sqlx::query!(
            r#"
            DELETE FROM admin_activities
            WHERE created < $1
            "#,
            cutoff.naive_utc()
        )
        .execute(database.write())
        .await?;

        Ok(result.rows_affected())
    }
}

#[async_trait::async_trait]
impl IntoAdminApiObject for AdminActivity {
    type AdminApiObject = AdminApiAdminActivity;
    type ExtraArgs<'a> = &'a crate::storage::StorageUrlRetriever<'a>;

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        storage_url_retriever: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiAdminActivity::init_hooks(&self, state).await?;

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
            AdminApiAdminActivity {
                user,
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
pub struct CreateAdminActivityOptions {
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
impl CreatableModel for AdminActivity {
    type CreateOptions<'a> = CreateAdminActivityOptions;
    type CreateResult = ();

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<AdminActivity>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
    ) -> Result<Self::CreateResult, crate::database::DatabaseError> {
        options.validate()?;

        let mut transaction = state.database.write().begin().await?;

        let mut query_builder = InsertQueryBuilder::new("admin_activities");

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
#[init_args(AdminActivity, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "AdminAdminActivity")]
pub struct AdminApiAdminActivity {
    pub user: Option<super::user::ApiUser>,
    pub impersonator: Option<super::user::ApiUser>,

    pub event: compact_str::CompactString,
    pub ip: Option<compact_str::CompactString>,
    pub data: serde_json::Value,

    pub is_api: bool,

    pub created: chrono::DateTime<chrono::Utc>,
}
