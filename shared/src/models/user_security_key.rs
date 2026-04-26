use crate::{
    models::{InsertQueryBuilder, UpdateQueryBuilder},
    prelude::*,
};
use base64::Engine;
use garde::Validate;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{
    collections::BTreeMap,
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

#[derive(Serialize, Deserialize)]
pub struct UserSecurityKey {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,

    pub passkey: Option<webauthn_rs::prelude::Passkey>,
    pub registration: Option<webauthn_rs::prelude::PasskeyRegistration>,

    pub last_used: Option<chrono::NaiveDateTime>,
    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for UserSecurityKey {
    const NAME: &'static str = "user_security_key";

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
                "user_security_keys.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "user_security_keys.name",
                compact_str::format_compact!("{prefix}name"),
            ),
            (
                "user_security_keys.passkey",
                compact_str::format_compact!("{prefix}passkey"),
            ),
            (
                "user_security_keys.registration",
                compact_str::format_compact!("{prefix}registration"),
            ),
            (
                "user_security_keys.last_used",
                compact_str::format_compact!("{prefix}last_used"),
            ),
            (
                "user_security_keys.created",
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
            passkey: if row
                .try_get::<serde_json::Value, _>(
                    compact_str::format_compact!("{prefix}passkey").as_str(),
                )
                .is_ok()
            {
                serde_json::from_value(
                    row.try_get(compact_str::format_compact!("{prefix}passkey").as_str())?,
                )
                .ok()
            } else {
                None
            },
            registration: if row
                .try_get::<serde_json::Value, _>(
                    compact_str::format_compact!("{prefix}registration").as_str(),
                )
                .is_ok()
            {
                serde_json::from_value(
                    row.try_get(compact_str::format_compact!("{prefix}registration").as_str())?,
                )
                .ok()
            } else {
                None
            },
            last_used: row.try_get(compact_str::format_compact!("{prefix}last_used").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl UserSecurityKey {
    pub async fn by_user_uuid_uuid(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM user_security_keys
            WHERE user_security_keys.user_uuid = $1 AND user_security_keys.uuid = $2
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
            FROM user_security_keys
            WHERE user_security_keys.user_uuid = $1 AND user_security_keys.passkey IS NOT NULL AND ($2 IS NULL OR user_security_keys.name ILIKE '%' || $2 || '%')
            ORDER BY user_security_keys.created
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

    pub async fn delete_unconfigured_by_user_uuid_name(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
        name: &str,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            DELETE FROM user_security_keys
            WHERE user_security_keys.user_uuid = $1 AND user_security_keys.name = $2 AND user_security_keys.passkey IS NULL
            "#,
        )
        .bind(user_uuid)
        .bind(name)
        .execute(database.write())
        .await?;

        Ok(())
    }

    pub async fn delete_unconfigured(
        database: &crate::database::Database,
    ) -> Result<u64, sqlx::Error> {
        Ok(sqlx::query(
            r#"
            DELETE FROM user_security_keys
            WHERE user_security_keys.created < NOW() - INTERVAL '1 day' AND user_security_keys.passkey IS NULL
            "#,
        )
        .execute(database.write())
        .await?
        .rows_affected())
    }
}

#[async_trait::async_trait]
impl IntoApiObject for UserSecurityKey {
    type ApiObject = ApiUserSecurityKey;
    type ExtraArgs<'a> = ();

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::ApiObject, crate::database::DatabaseError> {
        let api_object = ApiUserSecurityKey::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            ApiUserSecurityKey {
                uuid: self.uuid,
                name: self.name,
                credential_id: self.passkey.as_ref().map_or_else(
                    || "".to_string(),
                    |pk| base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(pk.cred_id()),
                ),
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
pub struct CreateUserSecurityKeyOptions {
    #[garde(skip)]
    pub user_uuid: uuid::Uuid,

    #[garde(length(chars, min = 3, max = 31))]
    #[schema(min_length = 3, max_length = 31)]
    pub name: compact_str::CompactString,

    #[garde(skip)]
    #[schema(value_type = serde_json::Value)]
    pub registration: webauthn_rs::prelude::PasskeyRegistration,
}

#[async_trait::async_trait]
impl CreatableModel for UserSecurityKey {
    type CreateOptions<'a> = CreateUserSecurityKeyOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<UserSecurityKey>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
    ) -> Result<Self, crate::database::DatabaseError> {
        let mut transaction = state.database.write().begin().await?;

        let mut query_builder = InsertQueryBuilder::new("user_security_keys");

        Self::run_create_handlers(&mut options, &mut query_builder, state, &mut transaction)
            .await?;

        query_builder
            .set("user_uuid", options.user_uuid)
            .set("name", &options.name)
            .set(
                "credential_id",
                rand::random_iter().take(16).collect::<Vec<u8>>(),
            )
            .set("registration", serde_json::to_value(options.registration)?);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut *transaction)
            .await?;
        let security_key = Self::map(None, &row)?;

        transaction.commit().await?;

        Ok(security_key)
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Default)]
pub struct UpdateUserSecurityKeyOptions {
    #[garde(length(chars, min = 3, max = 31))]
    #[schema(min_length = 3, max_length = 31)]
    pub name: Option<compact_str::CompactString>,
}

#[async_trait::async_trait]
impl UpdatableModel for UserSecurityKey {
    type UpdateOptions = UpdateUserSecurityKeyOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateListenerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateListenerList<UserSecurityKey>> =
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

        let mut query_builder = UpdateQueryBuilder::new("user_security_keys");

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
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut *transaction).await?;

        if let Some(name) = options.name {
            self.name = name;
        }

        transaction.commit().await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl DeletableModel for UserSecurityKey {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteListenerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteListenerList<UserSecurityKey>> =
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
            DELETE FROM user_security_keys
            WHERE user_security_keys.uuid = $1
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
#[init_args(UserSecurityKey, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "UserSecurityKey")]
pub struct ApiUserSecurityKey {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,

    pub credential_id: String,

    pub last_used: Option<chrono::DateTime<chrono::Utc>>,
    pub created: chrono::DateTime<chrono::Utc>,
}
