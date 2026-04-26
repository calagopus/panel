use crate::{models::InsertQueryBuilder, prelude::*};
use garde::Validate;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{
    collections::BTreeMap,
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

#[derive(Serialize, Deserialize)]
pub struct UserOAuthLink {
    pub uuid: uuid::Uuid,
    pub user: Fetchable<super::user::User>,
    pub oauth_provider: Fetchable<super::oauth_provider::OAuthProvider>,

    pub identifier: compact_str::CompactString,

    pub last_used: Option<chrono::NaiveDateTime>,
    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for UserOAuthLink {
    const NAME: &'static str = "user_oauth_link";

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
                "user_oauth_links.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "user_oauth_links.user_uuid",
                compact_str::format_compact!("{prefix}user_uuid"),
            ),
            (
                "user_oauth_links.oauth_provider_uuid",
                compact_str::format_compact!("{prefix}oauth_provider_uuid"),
            ),
            (
                "user_oauth_links.identifier",
                compact_str::format_compact!("{prefix}identifier"),
            ),
            (
                "user_oauth_links.last_used",
                compact_str::format_compact!("{prefix}last_used"),
            ),
            (
                "user_oauth_links.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ])
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            uuid: row.try_get(compact_str::format_compact!("{prefix}uuid").as_str())?,
            user: super::user::User::get_fetchable(
                row.try_get(compact_str::format_compact!("{prefix}user_uuid").as_str())?,
            ),
            oauth_provider: super::oauth_provider::OAuthProvider::get_fetchable(
                row.try_get(compact_str::format_compact!("{prefix}oauth_provider_uuid").as_str())?,
            ),
            identifier: row.try_get(compact_str::format_compact!("{prefix}identifier").as_str())?,
            last_used: row.try_get(compact_str::format_compact!("{prefix}last_used").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl UserOAuthLink {
    pub async fn by_oauth_provider_uuid_identifier(
        database: &crate::database::Database,
        oauth_provider_uuid: uuid::Uuid,
        identifier: &str,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM user_oauth_links
            WHERE user_oauth_links.oauth_provider_uuid = $1 AND user_oauth_links.identifier = $2
            "#,
            Self::columns_sql(None)
        ))
        .bind(oauth_provider_uuid)
        .bind(identifier)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn by_oauth_provider_uuid_uuid(
        database: &crate::database::Database,
        oauth_provider_uuid: uuid::Uuid,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM user_oauth_links
            WHERE user_oauth_links.oauth_provider_uuid = $1 AND user_oauth_links.uuid = $2
            "#,
            Self::columns_sql(None)
        ))
        .bind(oauth_provider_uuid)
        .bind(uuid)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn by_user_uuid_uuid(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM user_oauth_links
            WHERE user_oauth_links.user_uuid = $1 AND user_oauth_links.uuid = $2
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
            FROM user_oauth_links
            WHERE user_oauth_links.user_uuid = $1 AND ($2 IS NULL OR user_oauth_links.identifier ILIKE '%' || $2 || '%')
            ORDER BY user_oauth_links.created
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

    pub async fn filtered_by_user_uuid_with_pagination(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(&format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM user_oauth_links
            INNER JOIN oauth_providers ON user_oauth_links.oauth_provider_uuid = oauth_providers.uuid
            WHERE user_oauth_links.user_uuid = $1 AND oauth_providers.link_viewable = true
            ORDER BY user_oauth_links.created
            LIMIT $2 OFFSET $3
            "#,
            Self::columns_sql(None)
        ))
        .bind(user_uuid)
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

    pub async fn by_oauth_provider_uuid_with_pagination(
        database: &crate::database::Database,
        oauth_provider_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(&format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM user_oauth_links
            WHERE user_oauth_links.oauth_provider_uuid = $1 AND ($2 IS NULL OR user_oauth_links.identifier ILIKE '%' || $2 || '%')
            ORDER BY user_oauth_links.created
            LIMIT $3 OFFSET $4
            "#,
            Self::columns_sql(None)
        ))
        .bind(oauth_provider_uuid)
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
}

#[async_trait::async_trait]
impl IntoAdminApiObject for UserOAuthLink {
    type AdminApiObject = AdminApiUserOAuthLink;
    type ExtraArgs<'a> = &'a crate::storage::StorageUrlRetriever<'a>;

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        storage_url_retriever: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiUserOAuthLink::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            AdminApiUserOAuthLink {
                uuid: self.uuid,
                user: self
                    .user
                    .fetch_cached(&state.database)
                    .await?
                    .into_admin_api_object(state, storage_url_retriever)
                    .await?,
                identifier: self.identifier,
                last_used: self.last_used.map(|dt| dt.and_utc()),
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[async_trait::async_trait]
impl IntoApiObject for UserOAuthLink {
    type ApiObject = ApiUserOAuthLink;
    type ExtraArgs<'a> = ();

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::ApiObject, crate::database::DatabaseError> {
        let api_object = ApiUserOAuthLink::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            ApiUserOAuthLink {
                uuid: self.uuid,
                oauth_provider: self
                    .oauth_provider
                    .fetch_cached(&state.database)
                    .await?
                    .into_api_object(state, ())
                    .await?,
                identifier: self.identifier,
                last_used: self.last_used.map(|dt| dt.and_utc()),
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[derive(ToSchema, Deserialize, Validate)]
pub struct CreateUserOAuthLinkOptions {
    #[garde(skip)]
    pub user_uuid: uuid::Uuid,
    #[garde(skip)]
    pub oauth_provider_uuid: uuid::Uuid,

    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub identifier: compact_str::CompactString,
}

#[async_trait::async_trait]
impl CreatableModel for UserOAuthLink {
    type CreateOptions<'a> = CreateUserOAuthLinkOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<UserOAuthLink>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));
        &CREATE_LISTENERS
    }

    async fn create(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        super::oauth_provider::OAuthProvider::by_uuid_optional_cached(
            &state.database,
            options.oauth_provider_uuid,
        )
        .await?
        .ok_or(crate::database::InvalidRelationError("oauth_provider"))?;

        let mut transaction = state.database.write().begin().await?;

        let mut query_builder = InsertQueryBuilder::new("user_oauth_links");

        Self::run_create_handlers(&mut options, &mut query_builder, state, &mut transaction)
            .await?;

        query_builder
            .set("user_uuid", options.user_uuid)
            .set("oauth_provider_uuid", options.oauth_provider_uuid)
            .set("identifier", &options.identifier);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut *transaction)
            .await?;

        let oauth_link = Self::map(None, &row)?;

        transaction.commit().await?;

        Ok(oauth_link)
    }
}

#[async_trait::async_trait]
impl DeletableModel for UserOAuthLink {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteListenerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteListenerList<UserOAuthLink>> =
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
            DELETE FROM user_oauth_links
            WHERE user_oauth_links.uuid = $1
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
#[init_args(UserOAuthLink, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "AdminUserOAuthLink")]
pub struct AdminApiUserOAuthLink {
    pub uuid: uuid::Uuid,
    pub user: super::user::AdminApiUser,

    pub identifier: compact_str::CompactString,

    pub last_used: Option<chrono::DateTime<chrono::Utc>>,
    pub created: chrono::DateTime<chrono::Utc>,
}

#[schema_extension_derive::extendible]
#[init_args(UserOAuthLink, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "UserOAuthLink")]
pub struct ApiUserOAuthLink {
    pub uuid: uuid::Uuid,
    pub oauth_provider: super::oauth_provider::ApiOAuthProvider,

    pub identifier: compact_str::CompactString,

    pub last_used: Option<chrono::DateTime<chrono::Utc>>,
    pub created: chrono::DateTime<chrono::Utc>,
}
