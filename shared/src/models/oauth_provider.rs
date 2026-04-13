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
pub struct OAuthProvider {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,

    pub client_id: compact_str::CompactString,
    pub client_secret: Vec<u8>,
    pub auth_url: String,
    pub token_url: String,
    pub info_url: String,
    pub scopes: Vec<compact_str::CompactString>,

    pub identifier_path: String,
    pub email_path: Option<String>,
    pub username_path: Option<String>,
    pub name_first_path: Option<String>,
    pub name_last_path: Option<String>,

    pub enabled: bool,
    pub login_only: bool,
    pub link_viewable: bool,
    pub user_manageable: bool,
    pub basic_auth: bool,

    pub created: chrono::NaiveDateTime,
}

impl BaseModel for OAuthProvider {
    const NAME: &'static str = "oauth_provider";

    #[inline]
    fn columns(prefix: Option<&str>) -> BTreeMap<&'static str, compact_str::CompactString> {
        let prefix = prefix.unwrap_or_default();

        BTreeMap::from([
            (
                "oauth_providers.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "oauth_providers.name",
                compact_str::format_compact!("{prefix}name"),
            ),
            (
                "oauth_providers.description",
                compact_str::format_compact!("{prefix}description"),
            ),
            (
                "oauth_providers.client_id",
                compact_str::format_compact!("{prefix}client_id"),
            ),
            (
                "oauth_providers.client_secret",
                compact_str::format_compact!("{prefix}client_secret"),
            ),
            (
                "oauth_providers.auth_url",
                compact_str::format_compact!("{prefix}auth_url"),
            ),
            (
                "oauth_providers.token_url",
                compact_str::format_compact!("{prefix}token_url"),
            ),
            (
                "oauth_providers.info_url",
                compact_str::format_compact!("{prefix}info_url"),
            ),
            (
                "oauth_providers.scopes",
                compact_str::format_compact!("{prefix}scopes"),
            ),
            (
                "oauth_providers.identifier_path",
                compact_str::format_compact!("{prefix}identifier_path"),
            ),
            (
                "oauth_providers.email_path",
                compact_str::format_compact!("{prefix}email_path"),
            ),
            (
                "oauth_providers.username_path",
                compact_str::format_compact!("{prefix}username_path"),
            ),
            (
                "oauth_providers.name_first_path",
                compact_str::format_compact!("{prefix}name_first_path"),
            ),
            (
                "oauth_providers.name_last_path",
                compact_str::format_compact!("{prefix}name_last_path"),
            ),
            (
                "oauth_providers.enabled",
                compact_str::format_compact!("{prefix}enabled"),
            ),
            (
                "oauth_providers.login_only",
                compact_str::format_compact!("{prefix}login_only"),
            ),
            (
                "oauth_providers.link_viewable",
                compact_str::format_compact!("{prefix}link_viewable"),
            ),
            (
                "oauth_providers.user_manageable",
                compact_str::format_compact!("{prefix}user_manageable"),
            ),
            (
                "oauth_providers.basic_auth",
                compact_str::format_compact!("{prefix}basic_auth"),
            ),
            (
                "oauth_providers.created",
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
            description: row
                .try_get(compact_str::format_compact!("{prefix}description").as_str())?,
            client_id: row.try_get(compact_str::format_compact!("{prefix}client_id").as_str())?,
            client_secret: row
                .try_get(compact_str::format_compact!("{prefix}client_secret").as_str())?,
            auth_url: row.try_get(compact_str::format_compact!("{prefix}auth_url").as_str())?,
            token_url: row.try_get(compact_str::format_compact!("{prefix}token_url").as_str())?,
            info_url: row.try_get(compact_str::format_compact!("{prefix}info_url").as_str())?,
            scopes: row.try_get(compact_str::format_compact!("{prefix}scopes").as_str())?,
            identifier_path: row
                .try_get(compact_str::format_compact!("{prefix}identifier_path").as_str())?,
            email_path: row.try_get(compact_str::format_compact!("{prefix}email_path").as_str())?,
            username_path: row
                .try_get(compact_str::format_compact!("{prefix}username_path").as_str())?,
            name_first_path: row
                .try_get(compact_str::format_compact!("{prefix}name_first_path").as_str())?,
            name_last_path: row
                .try_get(compact_str::format_compact!("{prefix}name_last_path").as_str())?,
            enabled: row.try_get(compact_str::format_compact!("{prefix}enabled").as_str())?,
            login_only: row.try_get(compact_str::format_compact!("{prefix}login_only").as_str())?,
            link_viewable: row
                .try_get(compact_str::format_compact!("{prefix}link_viewable").as_str())?,
            user_manageable: row
                .try_get(compact_str::format_compact!("{prefix}user_manageable").as_str())?,
            basic_auth: row.try_get(compact_str::format_compact!("{prefix}basic_auth").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
        })
    }
}

impl OAuthProvider {
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
            FROM oauth_providers
            WHERE ($1 IS NULL OR oauth_providers.name ILIKE '%' || $1 || '%')
            ORDER BY oauth_providers.created
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

    pub async fn all_by_usable(
        database: &crate::database::Database,
    ) -> Result<Vec<Self>, crate::database::DatabaseError> {
        let rows = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM oauth_providers
            WHERE oauth_providers.enabled = true
            ORDER BY oauth_providers.created
            "#,
            Self::columns_sql(None)
        ))
        .fetch_all(database.read())
        .await?;

        rows.into_iter()
            .map(|row| Self::map(None, &row))
            .try_collect_vec()
    }

    pub fn extract_identifier(&self, value: &serde_json::Value) -> Result<String, anyhow::Error> {
        Ok(
            match serde_json_path::JsonPath::parse(&self.identifier_path)?
                .query(value)
                .first()
                .ok_or_else(|| {
                    crate::response::DisplayError::new(format!(
                        "unable to extract identifier from {:?}",
                        value
                    ))
                })? {
                serde_json::Value::String(string) => {
                    crate::utils::truncate_up_to(string.clone(), 255)
                }
                val => crate::utils::truncate_up_to(val.to_string(), 255),
            },
        )
    }

    pub fn extract_email(&self, value: &serde_json::Value) -> Result<String, anyhow::Error> {
        Ok(
            match serde_json_path::JsonPath::parse(match &self.email_path {
                Some(path) => path,
                None => {
                    return Ok(format!(
                        "{}@oauth.c7s.rs",
                        rand::distr::Alphanumeric.sample_string(&mut rand::rng(), 10)
                    ));
                }
            })?
            .query(value)
            .first()
            .ok_or_else(|| {
                crate::response::DisplayError::new(format!(
                    "unable to extract email from {:?}",
                    value
                ))
            })? {
                serde_json::Value::String(string) => {
                    crate::utils::truncate_up_to(string.clone(), 255)
                }
                val => crate::utils::truncate_up_to(val.to_string(), 255),
            },
        )
    }

    pub fn extract_username(&self, value: &serde_json::Value) -> Result<String, anyhow::Error> {
        Ok(
            match serde_json_path::JsonPath::parse(match &self.username_path {
                Some(path) => path,
                None => return Ok(rand::distr::Alphanumeric.sample_string(&mut rand::rng(), 10)),
            })?
            .query(value)
            .first()
            .ok_or_else(|| {
                crate::response::DisplayError::new(format!(
                    "unable to extract username from {:?}",
                    value
                ))
            })? {
                serde_json::Value::String(string) => {
                    crate::utils::truncate_up_to(string.clone(), 15)
                }
                val => crate::utils::truncate_up_to(val.to_string(), 15),
            },
        )
    }

    pub fn extract_name_first(&self, value: &serde_json::Value) -> Result<String, anyhow::Error> {
        Ok(
            match serde_json_path::JsonPath::parse(match &self.name_first_path {
                Some(path) => path,
                None => return Ok("First".to_string()),
            })?
            .query(value)
            .first()
            .ok_or_else(|| {
                crate::response::DisplayError::new(format!(
                    "unable to extract first name from {:?}",
                    value
                ))
            })? {
                serde_json::Value::String(string) => {
                    crate::utils::truncate_up_to(string.clone(), 255)
                }
                val => crate::utils::truncate_up_to(val.to_string(), 255),
            },
        )
    }

    pub fn extract_name_last(&self, value: &serde_json::Value) -> Result<String, anyhow::Error> {
        Ok(
            match serde_json_path::JsonPath::parse(match &self.name_last_path {
                Some(path) => path,
                None => return Ok("Last".to_string()),
            })?
            .query(value)
            .first()
            .ok_or_else(|| {
                crate::response::DisplayError::new(format!(
                    "unable to extract last name from {:?}",
                    value
                ))
            })? {
                serde_json::Value::String(string) => {
                    crate::utils::truncate_up_to(string.clone(), 255)
                }
                val => crate::utils::truncate_up_to(val.to_string(), 255),
            },
        )
    }

    #[inline]
    pub async fn into_admin_api_object(
        self,
        database: &crate::database::Database,
    ) -> Result<AdminApiOAuthProvider, anyhow::Error> {
        Ok(AdminApiOAuthProvider {
            uuid: self.uuid,
            name: self.name,
            description: self.description,
            client_id: self.client_id,
            client_secret: database.decrypt(self.client_secret).await?,
            auth_url: self.auth_url,
            token_url: self.token_url,
            info_url: self.info_url,
            scopes: self.scopes,
            identifier_path: self.identifier_path,
            email_path: self.email_path,
            username_path: self.username_path,
            name_first_path: self.name_first_path,
            name_last_path: self.name_last_path,
            enabled: self.enabled,
            login_only: self.login_only,
            link_viewable: self.link_viewable,
            user_manageable: self.user_manageable,
            basic_auth: self.basic_auth,
            created: self.created.and_utc(),
        })
    }

    #[inline]
    pub fn into_api_object(self) -> ApiOAuthProvider {
        ApiOAuthProvider {
            uuid: self.uuid,
            name: self.name,
            link_viewable: self.link_viewable,
            user_manageable: self.user_manageable,
        }
    }
}

#[async_trait::async_trait]
impl ByUuid for OAuthProvider {
    async fn by_uuid(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
    ) -> Result<Self, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM oauth_providers
            WHERE oauth_providers.uuid = $1
            "#,
            Self::columns_sql(None)
        ))
        .bind(uuid)
        .fetch_one(database.read())
        .await?;

        Self::map(None, &row)
    }
}

#[derive(ToSchema, Deserialize, Validate)]
pub struct CreateOAuthProviderOptions {
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: compact_str::CompactString,
    #[garde(length(chars, min = 1, max = 1024))]
    #[schema(min_length = 1, max_length = 1024)]
    pub description: Option<compact_str::CompactString>,
    #[garde(skip)]
    pub enabled: bool,
    #[garde(skip)]
    pub login_only: bool,
    #[garde(skip)]
    pub link_viewable: bool,
    #[garde(skip)]
    pub user_manageable: bool,
    #[garde(skip)]
    pub basic_auth: bool,

    #[garde(length(chars, min = 3, max = 255))]
    #[schema(min_length = 3, max_length = 255)]
    pub client_id: compact_str::CompactString,
    #[garde(length(chars, min = 3, max = 255))]
    #[schema(min_length = 3, max_length = 255)]
    pub client_secret: compact_str::CompactString,

    #[garde(length(chars, min = 3, max = 255))]
    #[schema(min_length = 3, max_length = 255)]
    pub auth_url: String,
    #[garde(length(chars, min = 3, max = 255))]
    #[schema(min_length = 3, max_length = 255)]
    pub token_url: String,
    #[garde(length(chars, min = 3, max = 255))]
    #[schema(min_length = 3, max_length = 255)]
    pub info_url: String,
    #[garde(length(max = 255))]
    #[schema(max_length = 255)]
    pub scopes: Vec<compact_str::CompactString>,

    #[garde(length(chars, min = 3, max = 255))]
    #[schema(min_length = 3, max_length = 255)]
    pub identifier_path: String,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub email_path: Option<String>,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub username_path: Option<String>,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name_first_path: Option<String>,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name_last_path: Option<String>,
}

#[async_trait::async_trait]
impl CreatableModel for OAuthProvider {
    type CreateOptions<'a> = CreateOAuthProviderOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<OAuthProvider>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        let mut transaction = state.database.write().begin().await?;

        let mut query_builder = InsertQueryBuilder::new("oauth_providers");

        Self::run_create_handlers(&mut options, &mut query_builder, state, &mut transaction)
            .await?;

        let encrypted_client_secret = state
            .database
            .encrypt(options.client_secret.to_string())
            .await
            .map_err(|err| sqlx::Error::Encode(err.into()))?;

        query_builder
            .set("name", &options.name)
            .set("description", &options.description)
            .set("client_id", &options.client_id)
            .set("client_secret", encrypted_client_secret)
            .set("auth_url", &options.auth_url)
            .set("token_url", &options.token_url)
            .set("info_url", &options.info_url)
            .set("scopes", &options.scopes)
            .set("identifier_path", &options.identifier_path)
            .set("email_path", &options.email_path)
            .set("username_path", &options.username_path)
            .set("name_first_path", &options.name_first_path)
            .set("name_last_path", &options.name_last_path)
            .set("enabled", options.enabled)
            .set("login_only", options.login_only)
            .set("link_viewable", options.link_viewable)
            .set("user_manageable", options.user_manageable)
            .set("basic_auth", options.basic_auth);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut *transaction)
            .await?;
        let oauth_provider = Self::map(None, &row)?;

        transaction.commit().await?;

        Ok(oauth_provider)
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Clone, Default)]
pub struct UpdateOAuthProviderOptions {
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: Option<compact_str::CompactString>,
    #[garde(length(chars, min = 1, max = 1024))]
    #[schema(min_length = 1, max_length = 1024)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub description: Option<Option<compact_str::CompactString>>,
    #[garde(skip)]
    pub enabled: Option<bool>,
    #[garde(skip)]
    pub login_only: Option<bool>,
    #[garde(skip)]
    pub link_viewable: Option<bool>,
    #[garde(skip)]
    pub user_manageable: Option<bool>,
    #[garde(skip)]
    pub basic_auth: Option<bool>,

    #[garde(length(chars, min = 3, max = 255))]
    #[schema(min_length = 3, max_length = 255)]
    pub client_id: Option<compact_str::CompactString>,
    #[garde(length(chars, min = 3, max = 255))]
    #[schema(min_length = 3, max_length = 255)]
    pub client_secret: Option<compact_str::CompactString>,

    #[garde(length(chars, min = 3, max = 255))]
    #[schema(min_length = 3, max_length = 255)]
    pub auth_url: Option<String>,
    #[garde(length(chars, min = 3, max = 255))]
    #[schema(min_length = 3, max_length = 255)]
    pub token_url: Option<String>,
    #[garde(length(chars, min = 3, max = 255))]
    #[schema(min_length = 3, max_length = 255)]
    pub info_url: Option<String>,
    #[garde(length(max = 255))]
    #[schema(max_length = 255)]
    pub scopes: Option<Vec<compact_str::CompactString>>,

    #[garde(length(chars, min = 3, max = 255))]
    #[schema(min_length = 3, max_length = 255)]
    pub identifier_path: Option<String>,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub email_path: Option<Option<String>>,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub username_path: Option<Option<String>>,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub name_first_path: Option<Option<String>>,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub name_last_path: Option<Option<String>>,
}

#[async_trait::async_trait]
impl UpdatableModel for OAuthProvider {
    type UpdateOptions = UpdateOAuthProviderOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateListenerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateListenerList<OAuthProvider>> =
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

        let mut query_builder = UpdateQueryBuilder::new("oauth_providers");

        Self::run_update_handlers(
            self,
            &mut options,
            &mut query_builder,
            state,
            &mut transaction,
        )
        .await?;

        let encrypted_client_secret = if let Some(ref client_secret) = options.client_secret {
            Some(
                state
                    .database
                    .encrypt(client_secret.to_string())
                    .await
                    .map_err(|err| sqlx::Error::Encode(err.into()))?,
            )
        } else {
            None
        };

        query_builder
            .set("name", options.name.as_ref())
            .set(
                "description",
                options.description.as_ref().map(|d| d.as_ref()),
            )
            .set("client_id", options.client_id.as_ref())
            .set("client_secret", encrypted_client_secret)
            .set("auth_url", options.auth_url.as_ref())
            .set("token_url", options.token_url.as_ref())
            .set("info_url", options.info_url.as_ref())
            .set("scopes", options.scopes.as_ref())
            .set("identifier_path", options.identifier_path.as_ref())
            .set(
                "email_path",
                options.email_path.as_ref().map(|e| e.as_ref()),
            )
            .set(
                "username_path",
                options.username_path.as_ref().map(|u| u.as_ref()),
            )
            .set(
                "name_first_path",
                options.name_first_path.as_ref().map(|n| n.as_ref()),
            )
            .set(
                "name_last_path",
                options.name_last_path.as_ref().map(|n| n.as_ref()),
            )
            .set("enabled", options.enabled)
            .set("login_only", options.login_only)
            .set("link_viewable", options.link_viewable)
            .set("user_manageable", options.user_manageable)
            .set("basic_auth", options.basic_auth)
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut *transaction).await?;

        if let Some(name) = options.name {
            self.name = name;
        }
        if let Some(description) = options.description {
            self.description = description;
        }
        if let Some(enabled) = options.enabled {
            self.enabled = enabled;
        }
        if let Some(login_only) = options.login_only {
            self.login_only = login_only;
        }
        if let Some(link_viewable) = options.link_viewable {
            self.link_viewable = link_viewable;
        }
        if let Some(user_manageable) = options.user_manageable {
            self.user_manageable = user_manageable;
        }
        if let Some(basic_auth) = options.basic_auth {
            self.basic_auth = basic_auth;
        }
        if let Some(client_id) = options.client_id {
            self.client_id = client_id;
        }
        if let Some(client_secret) = options.client_secret {
            self.client_secret = state
                .database
                .encrypt(client_secret)
                .await
                .map_err(|err| sqlx::Error::Encode(err.into()))?;
        }
        if let Some(auth_url) = options.auth_url {
            self.auth_url = auth_url;
        }
        if let Some(token_url) = options.token_url {
            self.token_url = token_url;
        }
        if let Some(info_url) = options.info_url {
            self.info_url = info_url;
        }
        if let Some(scopes) = options.scopes {
            self.scopes = scopes;
        }
        if let Some(identifier_path) = options.identifier_path {
            self.identifier_path = identifier_path;
        }
        if let Some(email_path) = options.email_path {
            self.email_path = email_path;
        }
        if let Some(username_path) = options.username_path {
            self.username_path = username_path;
        }
        if let Some(name_first_path) = options.name_first_path {
            self.name_first_path = name_first_path;
        }
        if let Some(name_last_path) = options.name_last_path {
            self.name_last_path = name_last_path;
        }

        transaction.commit().await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl DeletableModel for OAuthProvider {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteListenerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteListenerList<OAuthProvider>> =
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
            DELETE FROM oauth_providers
            WHERE oauth_providers.uuid = $1
            "#,
        )
        .bind(self.uuid)
        .execute(&mut *transaction)
        .await?;

        transaction.commit().await?;

        Ok(())
    }
}

#[derive(ToSchema, Serialize)]
#[schema(title = "AdminOAuthProvider")]
pub struct AdminApiOAuthProvider {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,

    pub client_id: compact_str::CompactString,
    pub client_secret: compact_str::CompactString,
    pub auth_url: String,
    pub token_url: String,
    pub info_url: String,
    pub scopes: Vec<compact_str::CompactString>,

    pub identifier_path: String,
    pub email_path: Option<String>,
    pub username_path: Option<String>,
    pub name_first_path: Option<String>,
    pub name_last_path: Option<String>,

    pub enabled: bool,
    pub login_only: bool,
    pub link_viewable: bool,
    pub user_manageable: bool,
    pub basic_auth: bool,

    pub created: chrono::DateTime<chrono::Utc>,
}

#[derive(ToSchema, Serialize)]
#[schema(title = "OAuthProvider")]
pub struct ApiOAuthProvider {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,

    pub link_viewable: bool,
    pub user_manageable: bool,
}
