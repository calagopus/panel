use crate::{
    models::{InsertQueryBuilder, UpdateQueryBuilder},
    prelude::*,
};
use garde::Validate;
use rand::distr::SampleString;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{
    collections::BTreeMap,
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, Clone)]
pub struct UserApiKey {
    pub uuid: uuid::Uuid,
    pub user_uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub key_start: compact_str::CompactString,
    pub allowed_ips: Vec<sqlx::types::ipnetwork::IpNetwork>,

    pub enabled: bool,

    pub user_permissions: Arc<Vec<compact_str::CompactString>>,
    pub admin_permissions: Arc<Vec<compact_str::CompactString>>,
    pub server_permissions: Arc<Vec<compact_str::CompactString>>,

    pub last_used: Option<chrono::NaiveDateTime>,
    pub expires: Option<chrono::NaiveDateTime>,
    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for UserApiKey {
    const NAME: &'static str = "user_api_key";

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
                "user_api_keys.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "user_api_keys.user_uuid",
                compact_str::format_compact!("{prefix}user_uuid"),
            ),
            (
                "user_api_keys.name",
                compact_str::format_compact!("{prefix}name"),
            ),
            (
                "user_api_keys.key_start",
                compact_str::format_compact!("{prefix}key_start"),
            ),
            (
                "user_api_keys.allowed_ips",
                compact_str::format_compact!("{prefix}allowed_ips"),
            ),
            (
                "user_api_keys.enabled",
                compact_str::format_compact!("{prefix}enabled"),
            ),
            (
                "user_api_keys.user_permissions",
                compact_str::format_compact!("{prefix}user_permissions"),
            ),
            (
                "user_api_keys.admin_permissions",
                compact_str::format_compact!("{prefix}admin_permissions"),
            ),
            (
                "user_api_keys.server_permissions",
                compact_str::format_compact!("{prefix}server_permissions"),
            ),
            (
                "user_api_keys.last_used",
                compact_str::format_compact!("{prefix}last_used"),
            ),
            (
                "user_api_keys.expires",
                compact_str::format_compact!("{prefix}expires"),
            ),
            (
                "user_api_keys.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ])
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            uuid: row.try_get(compact_str::format_compact!("{prefix}uuid").as_str())?,
            user_uuid: row.try_get(compact_str::format_compact!("{prefix}user_uuid").as_str())?,
            name: row.try_get(compact_str::format_compact!("{prefix}name").as_str())?,
            key_start: row.try_get(compact_str::format_compact!("{prefix}key_start").as_str())?,
            allowed_ips: row
                .try_get(compact_str::format_compact!("{prefix}allowed_ips").as_str())?,
            enabled: row.try_get(compact_str::format_compact!("{prefix}enabled").as_str())?,
            user_permissions: Arc::new(
                row.try_get(compact_str::format_compact!("{prefix}user_permissions").as_str())?,
            ),
            admin_permissions: Arc::new(
                row.try_get(compact_str::format_compact!("{prefix}admin_permissions").as_str())?,
            ),
            server_permissions: Arc::new(
                row.try_get(compact_str::format_compact!("{prefix}server_permissions").as_str())?,
            ),
            last_used: row.try_get(compact_str::format_compact!("{prefix}last_used").as_str())?,
            expires: row.try_get(compact_str::format_compact!("{prefix}expires").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }

    fn cache_invalidation_keys(&self) -> Vec<compact_str::CompactString> {
        vec![compact_str::format_compact!(
            "{}::{}",
            Self::NAME,
            self.uuid
        )]
    }
}

#[async_trait::async_trait]
impl ResolvableModel for UserApiKey {
    type Fingerprint = compact_str::CompactString;

    fn uuid(&self) -> uuid::Uuid {
        self.uuid
    }

    fn fingerprint(&self) -> Self::Fingerprint {
        self.key_start.clone()
    }

    async fn resolve(
        database: &crate::database::Database,
        identifier: &str,
    ) -> Result<Option<Self>, anyhow::Error> {
        let digest = crate::crypt::token_digest(identifier);

        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM user_api_keys
            WHERE user_api_keys.key = $1
            AND (user_api_keys.expires IS NULL OR user_api_keys.expires > NOW())
            "#,
            Self::columns_sql(None)
        )))
        .bind(&digest)
        .fetch_optional(database.read())
        .await?;

        if let Some(row) = row {
            return Ok(Some(Self::map(None, &row)?));
        }

        let Some(key_start) = identifier.get(0..16) else {
            return Ok(None);
        };

        let Some(row) = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            WITH user_api_keys AS MATERIALIZED (
                SELECT * FROM user_api_keys
                WHERE user_api_keys.key_start = $1
                AND (user_api_keys.expires IS NULL OR user_api_keys.expires > NOW())
            )
            SELECT {}, user_api_keys.key AS key_hash
            FROM user_api_keys
            WHERE user_api_keys.key = crypt($2, user_api_keys.key)
            "#,
            Self::columns_sql(None)
        )))
        .bind(key_start)
        .bind(identifier)
        .fetch_optional(database.read())
        .await?
        else {
            return Ok(None);
        };

        sqlx::query(
            r#"
            UPDATE user_api_keys
            SET key = $2
            WHERE user_api_keys.uuid = $1 AND user_api_keys.key = $3
            "#,
        )
        .bind(row.try_get::<uuid::Uuid, _>("uuid")?)
        .bind(&digest)
        .bind(row.try_get::<String, _>("key_hash")?)
        .execute(database.write())
        .await?;

        Ok(Some(Self::map(None, &row)?))
    }
}

impl UserApiKey {
    pub async fn by_user_uuid_uuid(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM user_api_keys
            WHERE user_api_keys.user_uuid = $1 AND user_api_keys.uuid = $2 AND (user_api_keys.expires IS NULL OR user_api_keys.expires > NOW())
            "#,
            Self::columns_sql(None)
        )))
        .bind(user_uuid)
        .bind(uuid)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn by_user_uuid_key_start(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
        key_start: &str,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM user_api_keys
            WHERE user_api_keys.user_uuid = $1 AND user_api_keys.key_start = $2 AND (user_api_keys.expires IS NULL OR user_api_keys.expires > NOW())
            "#,
            Self::columns_sql(None)
        )))
        .bind(user_uuid)
        .bind(key_start)
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

        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM user_api_keys
            WHERE user_api_keys.user_uuid = $1 AND ($2 IS NULL OR user_api_keys.name ILIKE '%' || $2 || '%')
                AND (user_api_keys.expires IS NULL OR user_api_keys.expires > NOW())
            ORDER BY user_api_keys.created
            LIMIT $3 OFFSET $4
            "#,
            Self::columns_sql(None)
        )))
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

    pub async fn delete_expired(database: &crate::database::Database) -> Result<u64, sqlx::Error> {
        Ok(sqlx::query(
            r#"
            DELETE FROM user_api_keys
            WHERE user_api_keys.expires IS NOT NULL AND user_api_keys.expires < NOW()
            "#,
        )
        .execute(database.write())
        .await?
        .rows_affected())
    }

    pub async fn update_last_used(&self, database: &Arc<crate::database::Database>) {
        let uuid = self.uuid;
        let now = chrono::Utc::now().naive_utc();

        database
            .batch_action("update_user_api_key", uuid, {
                let database = database.clone();

                async move {
                    sqlx::query!(
                        "UPDATE user_api_keys
                        SET last_used = $2
                        WHERE user_api_keys.uuid = $1",
                        uuid,
                        now
                    )
                    .execute(database.write())
                    .await?;

                    Ok(())
                }
            })
            .await;
    }

    pub async fn recreate(
        &mut self,
        database: &crate::database::Database,
    ) -> Result<String, crate::database::DatabaseError> {
        let new_key = format!(
            "c7sp_{}",
            rand::distr::Alphanumeric.sample_string(&mut rand::rng(), 43)
        );

        sqlx::query(
            r#"
            UPDATE user_api_keys
            SET key_start = $1, key = $2
            WHERE user_api_keys.uuid = $3
            "#,
        )
        .bind(&new_key[0..16])
        .bind(crate::crypt::token_digest(&new_key))
        .bind(self.uuid)
        .execute(database.write())
        .await?;

        self.key_start = new_key[0..16].into();

        Self::invalidate_cached(database, self.uuid).await;

        Ok(new_key)
    }

    pub async fn count_by_user_uuid(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
    ) -> Result<i64, sqlx::Error> {
        sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM user_api_keys
            WHERE user_api_keys.user_uuid = $1
            "#,
        )
        .bind(user_uuid)
        .fetch_one(database.read())
        .await
    }
}

#[async_trait::async_trait]
impl IntoApiObject for UserApiKey {
    type ApiObject = ApiUserApiKey;
    type ExtraArgs<'a> = ();

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::ApiObject, crate::database::DatabaseError> {
        let api_object = ApiUserApiKey::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            ApiUserApiKey {
                uuid: self.uuid,
                name: self.name,
                key_start: self.key_start,
                allowed_ips: self.allowed_ips,
                enabled: self.enabled,
                user_permissions: self.user_permissions,
                admin_permissions: self.admin_permissions,
                server_permissions: self.server_permissions,
                last_used: self.last_used.map(|dt| dt.and_utc()),
                expires: self.expires.map(|dt| dt.and_utc()),
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[derive(ToSchema, Deserialize, Validate)]
pub struct CreateUserApiKeyOptions {
    #[garde(skip)]
    pub user_uuid: uuid::Uuid,

    #[garde(length(chars, min = 3, max = 31))]
    #[schema(min_length = 3, max_length = 31)]
    pub name: compact_str::CompactString,
    #[garde(skip)]
    #[schema(value_type = Vec<String>)]
    pub allowed_ips: Vec<sqlx::types::ipnetwork::IpNetwork>,

    #[garde(skip)]
    pub enabled: bool,

    #[garde(custom(crate::permissions::validate_user_permissions))]
    pub user_permissions: Vec<compact_str::CompactString>,
    #[garde(custom(crate::permissions::validate_admin_permissions))]
    pub admin_permissions: Vec<compact_str::CompactString>,
    #[garde(custom(crate::permissions::validate_server_permissions))]
    pub server_permissions: Vec<compact_str::CompactString>,

    #[garde(inner(custom(crate::utils::validate_time_in_future)))]
    pub expires: Option<chrono::DateTime<chrono::Utc>>,
}

#[async_trait::async_trait]
impl CreatableModel for UserApiKey {
    type CreateOptions<'a> = CreateUserApiKeyOptions;
    type CreateResult = (String, Self);

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<UserApiKey>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create_with_transaction(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self::CreateResult, crate::database::DatabaseError> {
        options.validate()?;

        let key = format!(
            "c7sp_{}",
            rand::distr::Alphanumeric.sample_string(&mut rand::rng(), 43)
        );

        let mut query_builder = InsertQueryBuilder::new("user_api_keys");

        Self::run_create_handlers(&mut options, &mut query_builder, state, transaction).await?;

        query_builder
            .set("user_uuid", options.user_uuid)
            .set("name", &options.name)
            .set("key_start", &key[0..16])
            .set("key", crate::crypt::token_digest(&key))
            .set("allowed_ips", &options.allowed_ips)
            .set("enabled", options.enabled)
            .set("user_permissions", &options.user_permissions)
            .set("admin_permissions", &options.admin_permissions)
            .set("server_permissions", &options.server_permissions)
            .set("expires", options.expires.map(|d| d.naive_utc()));

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut **transaction)
            .await?;
        let user_api_key = Self::map(None, &row)?;

        let mut result = (key, user_api_key);

        Self::run_after_create_handlers(&mut result, &options, state, transaction).await?;

        Ok(result)
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Default)]
pub struct UpdateUserApiKeyOptions {
    #[garde(length(chars, min = 3, max = 31))]
    #[schema(min_length = 3, max_length = 31)]
    pub name: Option<compact_str::CompactString>,
    #[garde(skip)]
    #[schema(value_type = Vec<String>)]
    pub allowed_ips: Option<Vec<sqlx::types::ipnetwork::IpNetwork>>,

    #[garde(skip)]
    pub enabled: Option<bool>,

    #[garde(inner(custom(crate::permissions::validate_user_permissions)))]
    pub user_permissions: Option<Vec<compact_str::CompactString>>,
    #[garde(inner(custom(crate::permissions::validate_admin_permissions)))]
    pub admin_permissions: Option<Vec<compact_str::CompactString>>,
    #[garde(inner(custom(crate::permissions::validate_server_permissions)))]
    pub server_permissions: Option<Vec<compact_str::CompactString>>,

    #[garde(inner(inner(custom(crate::utils::validate_time_in_future))))]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub expires: Option<Option<chrono::DateTime<chrono::Utc>>>,
}

#[async_trait::async_trait]
impl UpdatableModel for UserApiKey {
    type UpdateOptions = UpdateUserApiKeyOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateHandlerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateHandlerList<UserApiKey>> =
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

        let mut query_builder = UpdateQueryBuilder::new("user_api_keys");

        self.run_update_handlers(&mut options, &mut query_builder, state, transaction)
            .await?;

        query_builder
            .set("name", options.name.as_ref())
            .set("allowed_ips", options.allowed_ips.as_ref())
            .set("enabled", options.enabled)
            .set("user_permissions", options.user_permissions.as_ref())
            .set("admin_permissions", options.admin_permissions.as_ref())
            .set("server_permissions", options.server_permissions.as_ref())
            .set(
                "expires",
                options
                    .expires
                    .as_ref()
                    .map(|e| e.as_ref().map(|d| d.naive_utc())),
            )
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut **transaction).await?;

        if let Some(name) = options.name {
            self.name = name;
        }
        if let Some(allowed_ips) = options.allowed_ips {
            self.allowed_ips = allowed_ips;
        }
        if let Some(enabled) = options.enabled {
            self.enabled = enabled;
        }
        if let Some(user_permissions) = options.user_permissions {
            self.user_permissions = Arc::new(user_permissions);
        }
        if let Some(admin_permissions) = options.admin_permissions {
            self.admin_permissions = Arc::new(admin_permissions);
        }
        if let Some(server_permissions) = options.server_permissions {
            self.server_permissions = Arc::new(server_permissions);
        }
        if let Some(expires) = options.expires {
            self.expires = expires.map(|d| d.naive_utc());
        }

        self.run_after_update_handlers(state, transaction).await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl ByUuid for UserApiKey {
    async fn by_uuid(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
    ) -> Result<Self, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM user_api_keys
            WHERE user_api_keys.uuid = $1 AND (user_api_keys.expires IS NULL OR user_api_keys.expires > NOW())
            "#,
            Self::columns_sql(None)
        )))
        .bind(uuid)
        .fetch_one(database.read())
        .await?;

        Self::map(None, &row)
    }

    async fn by_uuid_with_transaction(
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        uuid: uuid::Uuid,
    ) -> Result<Self, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM user_api_keys
            WHERE user_api_keys.uuid = $1 AND (user_api_keys.expires IS NULL OR user_api_keys.expires > NOW())
            "#,
            Self::columns_sql(None)
        )))
        .bind(uuid)
        .fetch_one(&mut **transaction)
        .await?;

        Self::map(None, &row)
    }
}

#[async_trait::async_trait]
impl DeletableModel for UserApiKey {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteHandlerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteHandlerList<UserApiKey>> =
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
            DELETE FROM user_api_keys
            WHERE user_api_keys.uuid = $1
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
#[init_args(UserApiKey, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "UserApiKey")]
pub struct ApiUserApiKey {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub key_start: compact_str::CompactString,
    #[schema(value_type = Vec<String>)]
    pub allowed_ips: Vec<sqlx::types::ipnetwork::IpNetwork>,

    pub enabled: bool,

    pub user_permissions: Arc<Vec<compact_str::CompactString>>,
    pub admin_permissions: Arc<Vec<compact_str::CompactString>>,
    pub server_permissions: Arc<Vec<compact_str::CompactString>>,

    pub last_used: Option<chrono::DateTime<chrono::Utc>>,
    pub expires: Option<chrono::DateTime<chrono::Utc>>,
    pub created: chrono::DateTime<chrono::Utc>,
}
