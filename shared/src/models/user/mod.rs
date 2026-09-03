use crate::{
    crypt::BcryptString,
    models::{InsertQueryBuilder, UpdateQueryBuilder},
    prelude::*,
    storage::StorageUrlRetriever,
};
use garde::Validate;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{
    collections::BTreeMap,
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;
use webauthn_rs::prelude::CredentialID;

mod auth;
pub use auth::*;

pub mod settings;

#[derive(Serialize, Deserialize, Clone)]
pub struct User {
    pub uuid: uuid::Uuid,
    pub role: Option<super::role::Role>,
    pub external_id: Option<compact_str::CompactString>,

    pub avatar: Option<String>,
    pub username: compact_str::CompactString,
    pub email: compact_str::CompactString,

    pub name_first: Option<compact_str::CompactString>,
    pub name_last: Option<compact_str::CompactString>,

    pub admin: bool,
    pub frozen: bool,
    pub suspended: bool,

    pub totp_enabled: bool,
    pub totp_last_used: Option<chrono::NaiveDateTime>,
    pub totp_secret: Option<String>,
    pub email_two_factor_enabled: bool,
    pub has_security_key: bool,

    pub email_verified: bool,
    pub password_login_disabled: bool,

    pub language: compact_str::CompactString,

    pub has_password: bool,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for User {
    const NAME: &'static str = "user";

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
            ("users.uuid", compact_str::format_compact!("{prefix}uuid")),
            (
                "users.external_id",
                compact_str::format_compact!("{prefix}external_id"),
            ),
            (
                "users.avatar",
                compact_str::format_compact!("{prefix}avatar"),
            ),
            (
                "users.username",
                compact_str::format_compact!("{prefix}username"),
            ),
            ("users.email", compact_str::format_compact!("{prefix}email")),
            (
                "users.name_first",
                compact_str::format_compact!("{prefix}name_first"),
            ),
            (
                "users.name_last",
                compact_str::format_compact!("{prefix}name_last"),
            ),
            ("users.admin", compact_str::format_compact!("{prefix}admin")),
            (
                "users.frozen",
                compact_str::format_compact!("{prefix}frozen"),
            ),
            (
                "users.suspended",
                compact_str::format_compact!("{prefix}suspended"),
            ),
            (
                "users.totp_enabled",
                compact_str::format_compact!("{prefix}totp_enabled"),
            ),
            (
                "users.totp_last_used",
                compact_str::format_compact!("{prefix}totp_last_used"),
            ),
            (
                "users.totp_secret",
                compact_str::format_compact!("{prefix}totp_secret"),
            ),
            (
                "users.email_two_factor_enabled",
                compact_str::format_compact!("{prefix}email_two_factor_enabled"),
            ),
            (
                "EXISTS (SELECT 1 FROM user_security_keys WHERE user_security_keys.user_uuid = users.uuid AND user_security_keys.passkey IS NOT NULL)",
                compact_str::format_compact!("{prefix}has_security_key"),
            ),
            (
                "users.email_verified",
                compact_str::format_compact!("{prefix}email_verified"),
            ),
            (
                "users.password_login_disabled",
                compact_str::format_compact!("{prefix}password_login_disabled"),
            ),
            (
                "users.language",
                compact_str::format_compact!("{prefix}language"),
            ),
            (
                "(users.password IS NOT NULL)",
                compact_str::format_compact!("{prefix}has_password"),
            ),
            (
                "users.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ]);

        columns.extend(super::role::Role::base_columns(Some("role_")));

        columns
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            uuid: row.try_get(compact_str::format_compact!("{prefix}uuid").as_str())?,
            role: if row
                .try_get::<uuid::Uuid, _>(
                    compact_str::format_compact!("{prefix}role_uuid").as_str(),
                )
                .is_ok()
            {
                Some(super::role::Role::map(Some("role_"), row)?)
            } else {
                None
            },
            external_id: row
                .try_get(compact_str::format_compact!("{prefix}external_id").as_str())?,
            avatar: row.try_get(compact_str::format_compact!("{prefix}avatar").as_str())?,
            username: row.try_get(compact_str::format_compact!("{prefix}username").as_str())?,
            email: row.try_get(compact_str::format_compact!("{prefix}email").as_str())?,
            name_first: row.try_get(compact_str::format_compact!("{prefix}name_first").as_str())?,
            name_last: row.try_get(compact_str::format_compact!("{prefix}name_last").as_str())?,
            admin: row.try_get(compact_str::format_compact!("{prefix}admin").as_str())?,
            frozen: row.try_get(compact_str::format_compact!("{prefix}frozen").as_str())?,
            suspended: row.try_get(compact_str::format_compact!("{prefix}suspended").as_str())?,
            totp_enabled: row
                .try_get(compact_str::format_compact!("{prefix}totp_enabled").as_str())?,
            totp_last_used: row
                .try_get(compact_str::format_compact!("{prefix}totp_last_used").as_str())?,
            totp_secret: row
                .try_get(compact_str::format_compact!("{prefix}totp_secret").as_str())?,
            email_two_factor_enabled: row.try_get(
                compact_str::format_compact!("{prefix}email_two_factor_enabled").as_str(),
            )?,
            has_security_key: row
                .try_get(compact_str::format_compact!("{prefix}has_security_key").as_str())?,
            email_verified: row
                .try_get(compact_str::format_compact!("{prefix}email_verified").as_str())?,
            password_login_disabled: row.try_get(
                compact_str::format_compact!("{prefix}password_login_disabled").as_str(),
            )?,
            language: row.try_get(compact_str::format_compact!("{prefix}language").as_str())?,
            has_password: row
                .try_get(compact_str::format_compact!("{prefix}has_password").as_str())?,
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

impl User {
    pub async fn create_automatic_admin(
        database: &crate::database::Database,
        username: &str,
        email: &str,
        name_first: Option<&str>,
        name_last: Option<&str>,
        password: &str,
    ) -> Result<uuid::Uuid, crate::database::DatabaseError> {
        let password = BcryptString::hash(password).await?;

        let row = sqlx::query(
            r#"
            INSERT INTO users (username, email, name_first, name_last, password, admin)
            VALUES ($1, $2, $3, $4, $5, (SELECT COUNT(*) = 0 FROM users))
            RETURNING users.uuid
            "#,
        )
        .bind(username)
        .bind(email)
        .bind(name_first)
        .bind(name_last)
        .bind(password)
        .fetch_one(database.write())
        .await?;

        Ok(row.try_get("uuid")?)
    }

    pub async fn by_external_id(
        database: &crate::database::Database,
        external_id: &str,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM users
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            WHERE users.external_id = $1
            "#,
            Self::columns_sql(None)
        )))
        .bind(external_id)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    /// Returns the user and session associated with the given session string, if valid.
    ///
    /// Both rows are cached until they are written to.
    pub async fn by_session_cached(
        database: &crate::database::Database,
        session: &str,
    ) -> Result<Option<(Self, super::user_session::UserSession)>, anyhow::Error> {
        let Some(session) =
            super::user_session::UserSession::resolve_cached(database, session).await?
        else {
            return Ok(None);
        };

        Ok(Self::by_uuid_optional_cached(database, session.user_uuid)
            .await?
            .map(|user| (user, session)))
    }

    /// Returns the user and API key associated with the given API key string, if valid.
    ///
    /// Both rows are cached until they are written to.
    pub async fn by_api_key_cached(
        database: &crate::database::Database,
        key: &str,
    ) -> Result<Option<(Self, super::user_api_key::UserApiKey)>, anyhow::Error> {
        let Some(api_key) = super::user_api_key::UserApiKey::resolve_cached(database, key).await?
        else {
            return Ok(None);
        };

        if api_key
            .expires
            .is_some_and(|expires| expires <= chrono::Utc::now().naive_utc())
        {
            return Ok(None);
        }

        Ok(Self::by_uuid_optional_cached(database, api_key.user_uuid)
            .await?
            .map(|user| (user, api_key)))
    }

    pub async fn by_credential_id(
        database: &crate::database::Database,
        credential_id: &CredentialID,
    ) -> Result<
        Option<(Self, super::user_security_key::UserSecurityKey)>,
        crate::database::DatabaseError,
    > {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}, {}
            FROM users
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            JOIN user_security_keys ON user_security_keys.user_uuid = users.uuid
            WHERE user_security_keys.credential_id = $1
            "#,
            Self::columns_sql(None),
            super::user_security_key::UserSecurityKey::columns_sql(Some("security_key_"))
        )))
        .bind(credential_id.to_vec())
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| {
            Ok((
                Self::map(None, &row)?,
                super::user_security_key::UserSecurityKey::map(Some("security_key_"), &row)?,
            ))
        })
    }

    pub async fn by_email(
        database: &crate::database::Database,
        email: &str,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM users
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            WHERE lower(users.email) = lower($1)
            "#,
            Self::columns_sql(None)
        )))
        .bind(email)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn by_email_password(
        database: &crate::database::Database,
        email: &str,
        password: &str,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}, users.password AS password_hash
            FROM users
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            WHERE lower(users.email) = lower($1)
            "#,
            Self::columns_sql(None)
        )))
        .bind(email)
        .fetch_optional(database.read())
        .await?;

        Self::verify_password_row(database, row, password).await
    }

    pub async fn by_username(
        database: &crate::database::Database,
        username: &str,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM users
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            WHERE lower(users.username) = lower($1)
            "#,
            Self::columns_sql(None)
        )))
        .bind(username)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn by_username_password(
        database: &crate::database::Database,
        username: &str,
        password: &str,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}, users.password AS password_hash
            FROM users
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            WHERE lower(users.username) = lower($1)
            "#,
            Self::columns_sql(None)
        )))
        .bind(username)
        .fetch_optional(database.read())
        .await?;

        Self::verify_password_row(database, row, password).await
    }

    async fn verify_password_row(
        database: &crate::database::Database,
        row: Option<PgRow>,
        password: &str,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let Some(row) = row else {
            BcryptString::verify_dummy(password).await?;

            return Ok(None);
        };

        let Some(hash) = row.try_get::<Option<BcryptString>, _>("password_hash")? else {
            BcryptString::verify_dummy(password).await?;

            return Ok(None);
        };

        if !hash.verify(password).await? {
            return Ok(None);
        }

        let user = Self::map(None, &row)?;
        user.rehash_password(database, password, &hash).await?;

        Ok(Some(user))
    }

    /// Rewrites a matching hash that was produced at a different cost or format (imports, older
    /// versions) so every active account converges on the current parameters.
    async fn rehash_password(
        &self,
        database: &crate::database::Database,
        password: &str,
        current_hash: &BcryptString,
    ) -> Result<(), crate::database::DatabaseError> {
        if !current_hash.needs_rehash() {
            return Ok(());
        }

        let new_hash = BcryptString::hash(password).await?;

        sqlx::query(
            r#"
            UPDATE users
            SET password = $2
            WHERE users.uuid = $1 AND users.password = $3
            "#,
        )
        .bind(self.uuid)
        .bind(new_hash)
        .bind(current_hash)
        .execute(database.write())
        .await?;

        Ok(())
    }

    pub async fn by_username_public_key(
        database: &crate::database::Database,
        username: &str,
        public_key: russh::keys::PublicKey,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM users
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            JOIN user_ssh_keys ON user_ssh_keys.user_uuid = users.uuid
            WHERE lower(users.username) = lower($1) AND user_ssh_keys.fingerprint = $2
            "#,
            Self::columns_sql(None)
        )))
        .bind(username)
        .bind(
            public_key
                .fingerprint(russh::keys::HashAlg::Sha256)
                .to_string(),
        )
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn by_role_uuid_with_pagination(
        database: &crate::database::Database,
        role_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM users
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            WHERE users.role_uuid = $1 AND ($2 IS NULL OR users.username ILIKE '%' || $2 || '%' OR users.email ILIKE '%' || $2 || '%')
            ORDER BY users.created
            LIMIT $3 OFFSET $4
            "#,
            Self::columns_sql(None)
        )))
        .bind(role_uuid)
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

    pub async fn all_with_pagination(
        database: &crate::database::Database,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM users
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            WHERE $1 IS NULL OR users.username ILIKE '%' || $1 || '%' OR users.email ILIKE '%' || $1 || '%'
            ORDER BY users.created
            LIMIT $2 OFFSET $3
            "#,
            Self::columns_sql(None)
        )))
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

    pub async fn count(database: &crate::database::Database) -> i64 {
        sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM users
            "#,
        )
        .fetch_one(database.read())
        .await
        .unwrap_or(0)
    }

    pub async fn validate_password(
        &self,
        database: &crate::database::Database,
        password: &str,
    ) -> Result<bool, crate::database::DatabaseError> {
        if !self.has_password {
            return Ok(true);
        }

        let row = sqlx::query(
            r#"
            SELECT users.password
            FROM users
            WHERE users.uuid = $1
            "#,
        )
        .bind(self.uuid)
        .fetch_optional(database.read())
        .await?;

        let hash = match row {
            Some(row) => row.try_get::<Option<BcryptString>, _>("password")?,
            None => None,
        };

        let Some(hash) = hash else {
            BcryptString::verify_dummy(password).await?;

            return Ok(false);
        };

        if !hash.verify(password).await? {
            return Ok(false);
        }

        self.rehash_password(database, password, &hash).await?;

        Ok(true)
    }

    /// Update the User password, `None` will disallow password login and not require one when changing
    pub async fn update_password(
        &mut self,
        database: &crate::database::Database,
        password: Option<&str>,
    ) -> Result<(), crate::database::DatabaseError> {
        if let Some(password) = password {
            let password = BcryptString::hash(password).await?;

            sqlx::query(
                r#"
		            UPDATE users
		            SET password = $2
		            WHERE users.uuid = $1
		            "#,
            )
            .bind(self.uuid)
            .bind(password)
            .execute(database.write())
            .await?;

            self.has_password = true;
        } else {
            sqlx::query(
                r#"
		            UPDATE users
		            SET password = NULL
		            WHERE users.uuid = $1
		            "#,
            )
            .bind(self.uuid)
            .bind(password)
            .execute(database.write())
            .await?;

            self.has_password = false;
        }

        Self::invalidate_cached(database, self.uuid).await;

        Ok(())
    }

    /// Update the User password, `None` will disallow password login and not require one when changing
    pub async fn update_password_with_transaction(
        &mut self,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        password: Option<&str>,
    ) -> Result<(), crate::database::DatabaseError> {
        if let Some(password) = password {
            let password = BcryptString::hash(password).await?;

            sqlx::query(
                r#"
		            UPDATE users
		            SET password = $2
		            WHERE users.uuid = $1
		            "#,
            )
            .bind(self.uuid)
            .bind(password)
            .execute(&mut **transaction)
            .await?;

            self.has_password = true;
        } else {
            sqlx::query(
                r#"
		            UPDATE users
		            SET password = NULL
		            WHERE users.uuid = $1
		            "#,
            )
            .bind(self.uuid)
            .bind(password)
            .execute(&mut **transaction)
            .await?;

            self.has_password = false;
        }

        Ok(())
    }

    pub fn require_two_factor(&self, settings: &crate::settings::AppSettings) -> bool {
        if let Some(role) = &self.role {
            role.require_two_factor
        } else {
            match settings.app.two_factor_requirement {
                crate::settings::app::TwoFactorRequirement::Admins => self.admin,
                crate::settings::app::TwoFactorRequirement::AllUsers => true,
                crate::settings::app::TwoFactorRequirement::None => false,
            }
        }
    }

    /// A stale `email_two_factor_enabled` is ignored once an admin turns the feature off, degrading to
    /// password only rather than locking the user out of a mailbox nobody can deliver to.
    fn email_two_factor_available(&self, settings: &crate::settings::AppSettings) -> bool {
        self.email_two_factor_enabled
            && settings.app.email_two_factor_enabled
            && !matches!(settings.mail_mode, crate::settings::MailMode::None)
    }

    pub fn has_two_factor_method(
        &self,
        method: crate::settings::app::TwoFactorMethod,
        settings: &crate::settings::AppSettings,
    ) -> bool {
        match method {
            crate::settings::app::TwoFactorMethod::Totp => self.totp_enabled,
            crate::settings::app::TwoFactorMethod::SecurityKey => {
                self.has_security_key && settings.webauthn.enabled
            }
            crate::settings::app::TwoFactorMethod::Email => {
                self.email_two_factor_available(settings)
            }
        }
    }

    /// Every factor the user has, regardless of whether an admin counts it towards the requirement.
    pub fn two_factor_methods(
        &self,
        settings: &crate::settings::AppSettings,
    ) -> Vec<crate::settings::app::TwoFactorMethod> {
        crate::settings::app::TwoFactorMethod::ALL
            .iter()
            .copied()
            .filter(|method| self.has_two_factor_method(*method, settings))
            .collect()
    }

    pub fn satisfies_two_factor(&self, settings: &crate::settings::AppSettings) -> bool {
        settings
            .app
            .two_factor_accepted_methods
            .iter()
            .any(|method| self.has_two_factor_method(*method, settings))
    }

    pub fn require_email_verification(&self, settings: &crate::settings::AppSettings) -> bool {
        settings.app.email_verification_required
            && !matches!(settings.mail_mode, crate::settings::MailMode::None)
    }

    pub async fn into_api_full_object(
        self,
        state: &crate::State,
        storage_url_retriever: &StorageUrlRetriever<'_>,
    ) -> Result<ApiFullUser, crate::database::DatabaseError> {
        let api_object = ApiFullUser::init_hooks(&self, state).await?;

        let settings = storage_url_retriever.get_settings();
        let require_two_factor = self.require_two_factor(settings);
        let two_factor_satisfied = self.satisfies_two_factor(settings);
        let two_factor_methods = self.two_factor_methods(settings);
        let require_email_verification = self.require_email_verification(settings);

        let role = if let Some(r) = self.role {
            Some(r.into_admin_api_object(state, ()).await?)
        } else {
            None
        };

        let api_object = finish_extendible!(
            ApiFullUser {
                uuid: self.uuid,
                username: self.username,
                role,
                avatar: self
                    .avatar
                    .as_ref()
                    .map(|a| storage_url_retriever.get_url(a)),
                email: self.email,
                name_first: self.name_first,
                name_last: self.name_last,
                admin: self.admin,
                frozen: self.frozen,
                suspended: self.suspended,
                totp_enabled: self.totp_enabled,
                totp_last_used: self.totp_last_used.map(|dt| dt.and_utc()),
                email_two_factor_enabled: self.email_two_factor_enabled,
                two_factor_methods,
                require_two_factor,
                two_factor_satisfied,
                email_verified: self.email_verified,
                require_email_verification,
                password_login_disabled: self.password_login_disabled,
                language: self.language,
                has_password: self.has_password,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[async_trait::async_trait]
impl IntoApiObject for User {
    type ApiObject = ApiUser;
    type ExtraArgs<'a> = &'a crate::storage::StorageUrlRetriever<'a>;

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        storage_url_retriever: Self::ExtraArgs<'a>,
    ) -> Result<Self::ApiObject, crate::database::DatabaseError> {
        let api_object = ApiUser::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            ApiUser {
                uuid: self.uuid,
                username: self.username,
                avatar: self
                    .avatar
                    .as_ref()
                    .map(|a| storage_url_retriever.get_url(a)),
                totp_enabled: self.totp_enabled,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[async_trait::async_trait]
impl IntoAdminApiObject for User {
    type AdminApiObject = AdminApiUser;
    type ExtraArgs<'a> = &'a crate::storage::StorageUrlRetriever<'a>;

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        storage_url_retriever: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiUser::init_hooks(&self, state).await?;

        let settings = storage_url_retriever.get_settings();
        let require_two_factor = self.require_two_factor(settings);
        let two_factor_satisfied = self.satisfies_two_factor(settings);
        let two_factor_methods = self.two_factor_methods(settings);
        let require_email_verification = self.require_email_verification(settings);

        let role = if let Some(r) = self.role {
            Some(r.into_admin_api_object(state, ()).await?)
        } else {
            None
        };

        let api_object = finish_extendible!(
            AdminApiUser {
                uuid: self.uuid,
                external_id: self.external_id,
                username: self.username,
                role,
                avatar: self
                    .avatar
                    .as_ref()
                    .map(|a| storage_url_retriever.get_url(a)),
                email: self.email,
                name_first: self.name_first,
                name_last: self.name_last,
                admin: self.admin,
                frozen: self.frozen,
                suspended: self.suspended,
                totp_enabled: self.totp_enabled,
                totp_last_used: self.totp_last_used.map(|dt| dt.and_utc()),
                email_two_factor_enabled: self.email_two_factor_enabled,
                two_factor_methods,
                require_two_factor,
                two_factor_satisfied,
                email_verified: self.email_verified,
                require_email_verification,
                password_login_disabled: self.password_login_disabled,
                language: self.language,
                has_password: self.has_password,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[inline]
fn default_true() -> bool {
    true
}

#[derive(ToSchema, Deserialize, Validate)]
pub struct CreateUserOptions {
    #[garde(skip)]
    pub role_uuid: Option<uuid::Uuid>,

    #[garde(length(max = 255))]
    #[schema(max_length = 255)]
    pub external_id: Option<compact_str::CompactString>,

    #[garde(length(chars, min = 3, max = 15), pattern("^[a-zA-Z0-9_]+$"))]
    #[schema(min_length = 3, max_length = 15)]
    #[schema(pattern = "^[a-zA-Z0-9_]+$")]
    pub username: compact_str::CompactString,
    #[garde(email, length(max = 255))]
    #[schema(format = "email", max_length = 255)]
    pub email: compact_str::CompactString,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name_first: Option<compact_str::CompactString>,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name_last: Option<compact_str::CompactString>,
    #[garde(length(chars, min = 1, max = 512))]
    #[schema(min_length = 1, max_length = 512)]
    pub password: Option<String>,

    #[garde(skip)]
    pub admin: bool,
    #[garde(skip)]
    #[serde(default)]
    pub frozen: bool,
    #[garde(skip)]
    #[serde(default)]
    pub suspended: bool,
    #[garde(skip)]
    #[serde(default = "default_true")]
    pub verify_email: bool,
    #[garde(skip)]
    #[serde(default)]
    pub send_email: bool,

    #[garde(
        length(chars, min = 2, max = 15),
        custom(crate::utils::validate_language)
    )]
    #[schema(min_length = 2, max_length = 15)]
    pub language: compact_str::CompactString,
}

#[async_trait::async_trait]
impl CreatableModel for User {
    type CreateOptions<'a> = CreateUserOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<User>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create_with_transaction(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        if let Some(role_uuid) = options.role_uuid {
            super::role::Role::by_uuid_optional_cached(&state.database, role_uuid)
                .await?
                .ok_or(crate::database::InvalidRelationError("role"))?;
        }

        let mut query_builder = InsertQueryBuilder::new("users");

        Self::run_create_handlers(&mut options, &mut query_builder, state, transaction).await?;

        query_builder
            .set("role_uuid", options.role_uuid)
            .set("external_id", options.external_id.as_deref())
            .set("username", &options.username)
            .set("email", &options.email)
            .set("name_first", options.name_first.as_deref())
            .set("name_last", options.name_last.as_deref());

        if let Some(password) = &options.password {
            query_builder.set("password", BcryptString::hash(password).await?);
        }

        query_builder
            .set("admin", options.admin)
            .set("frozen", options.frozen)
            .set("suspended", options.suspended)
            .set("email_verified", options.verify_email)
            .set("language", &options.language);

        let row = query_builder
            .returning("uuid")
            .fetch_one(&mut **transaction)
            .await?;
        let uuid: uuid::Uuid = row.get("uuid");

        let mut result = Self::by_uuid_with_transaction(transaction, uuid).await?;

        Self::run_after_create_handlers(&mut result, &options, state, transaction).await?;

        if options.send_email {
            match super::user_password_reset::UserPasswordReset::create_with_transaction(
                transaction,
                result.uuid,
            )
            .await
            {
                Ok(token) => {
                    let settings = state.settings.get().await?;

                    super::user_activity::UserActivity::create_with_transaction(
                        state,
                        super::user_activity::CreateUserActivityOptions {
                            user_uuid: result.uuid,
                            impersonator_uuid: None,
                            api_key_uuid: None,
                            event: "email:account-created".into(),
                            ip: None,
                            data: serde_json::json!({}),
                            created: None,
                        },
                        transaction,
                    )
                    .await?;

                    state
                        .mail
                        .send_template(
                            state,
                            "account_created",
                            result.email.clone(),
                            minijinja::context! {
                                user => result,
                                reset_link => format!(
                                    "{}/auth/reset-password?token={}",
                                    settings.app.url,
                                    urlencoding::encode(&token),
                                )
                            },
                        )
                        .await;
                }
                Err(err) => {
                    tracing::warn!(
                        user = %result.uuid,
                        "failed to create user password reset token: {:#?}",
                        err
                    );
                }
            };
        }

        Ok(result)
    }
}

#[derive(Default, ToSchema, Serialize, Deserialize, Validate)]
pub struct UpdateUserOptions {
    #[garde(skip)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub role_uuid: Option<Option<uuid::Uuid>>,

    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub external_id: Option<Option<compact_str::CompactString>>,

    #[garde(length(chars, min = 3, max = 15), pattern("^[a-zA-Z0-9_]+$"))]
    #[schema(min_length = 3, max_length = 15)]
    #[schema(pattern = "^[a-zA-Z0-9_]+$")]
    pub username: Option<compact_str::CompactString>,
    #[garde(email, length(max = 255))]
    #[schema(format = "email", max_length = 255)]
    pub email: Option<compact_str::CompactString>,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub name_first: Option<Option<compact_str::CompactString>>,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub name_last: Option<Option<compact_str::CompactString>>,
    #[garde(length(chars, min = 8, max = 512))]
    #[schema(min_length = 8, max_length = 512)]
    pub password: Option<Option<compact_str::CompactString>>,

    #[garde(skip)]
    pub admin: Option<bool>,
    #[garde(skip)]
    pub frozen: Option<bool>,
    #[garde(skip)]
    pub suspended: Option<bool>,

    #[garde(
        length(chars, min = 2, max = 15),
        inner(custom(crate::utils::validate_language))
    )]
    #[schema(min_length = 2, max_length = 15)]
    pub language: Option<compact_str::CompactString>,
}

#[async_trait::async_trait]
impl UpdatableModel for User {
    type UpdateOptions = UpdateUserOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateHandlerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateHandlerList<User>> =
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

        let role = if let Some(role_uuid) = options.role_uuid {
            if let Some(role_uuid) = role_uuid {
                Some(Some(
                    super::role::Role::by_uuid_optional_cached(&state.database, role_uuid)
                        .await?
                        .ok_or(crate::database::InvalidRelationError("role"))?,
                ))
            } else {
                Some(None)
            }
        } else {
            None
        };

        let mut query_builder = UpdateQueryBuilder::new("users");

        self.run_update_handlers(&mut options, &mut query_builder, state, transaction)
            .await?;

        query_builder
            .set("role_uuid", options.role_uuid.as_ref())
            .set("external_id", options.external_id.as_ref())
            .set("username", options.username.as_ref())
            .set("email", options.email.as_ref())
            .set("name_first", options.name_first.as_ref())
            .set("name_last", options.name_last.as_ref())
            .set("admin", options.admin)
            .set("frozen", options.frozen)
            .set("suspended", options.suspended)
            .set("language", options.language.as_ref())
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut **transaction).await?;

        if let Some(role) = role {
            self.role = role;
        }
        if let Some(external_id) = options.external_id {
            self.external_id = external_id;
        }
        if let Some(username) = options.username {
            self.username = username;
        }
        if let Some(email) = options.email {
            self.email = email;
        }
        if let Some(name_first) = options.name_first {
            self.name_first = name_first;
        }
        if let Some(name_last) = options.name_last {
            self.name_last = name_last;
        }
        if let Some(admin) = options.admin {
            self.admin = admin;
        }
        if let Some(frozen) = options.frozen {
            self.frozen = frozen;
        }
        if let Some(suspended) = options.suspended {
            self.suspended = suspended;
        }
        if let Some(language) = options.language {
            self.language = language;
        }

        if let Some(password) = options.password {
            self.update_password_with_transaction(transaction, password.as_deref())
                .await?;
        }

        self.run_after_update_handlers(state, transaction).await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl DeletableModel for User {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteHandlerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteHandlerList<User>> =
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
            DELETE FROM users
            WHERE users.uuid = $1
            "#,
        )
        .bind(self.uuid)
        .execute(&mut **transaction)
        .await?;

        self.run_after_delete_handlers(&options, state, transaction)
            .await?;

        Ok(())
    }

    async fn delete(
        &self,
        state: &crate::State,
        options: Self::DeleteOptions,
    ) -> Result<(), anyhow::Error> {
        let mut transaction = state.database.write().begin().await?;
        self.delete_with_transaction(state, options, &mut transaction)
            .await?;
        transaction.commit().await?;

        Self::invalidate_cached(&state.database, self.uuid).await;

        state.storage.remove(self.avatar.as_deref()).await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl ByUuid for User {
    async fn by_uuid(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
    ) -> Result<Self, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM users
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            WHERE users.uuid = $1
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
            FROM users
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            WHERE users.uuid = $1
            "#,
            Self::columns_sql(None)
        )))
        .bind(uuid)
        .fetch_one(&mut **transaction)
        .await?;

        Self::map(None, &row)
    }
}

#[schema_extension_derive::extendible]
#[init_args(User, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "User")]
pub struct ApiUser {
    pub uuid: uuid::Uuid,

    pub username: compact_str::CompactString,
    pub avatar: Option<String>,

    pub totp_enabled: bool,

    pub created: chrono::DateTime<chrono::Utc>,
}

#[schema_extension_derive::extendible]
#[init_args(User, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "FullUser")]
pub struct ApiFullUser {
    pub uuid: uuid::Uuid,

    pub username: compact_str::CompactString,
    pub role: Option<super::role::AdminApiRole>,
    pub avatar: Option<String>,
    pub email: compact_str::CompactString,

    pub name_first: Option<compact_str::CompactString>,
    pub name_last: Option<compact_str::CompactString>,

    pub admin: bool,
    pub frozen: bool,
    pub suspended: bool,

    pub totp_enabled: bool,
    pub totp_last_used: Option<chrono::DateTime<chrono::Utc>>,
    pub email_two_factor_enabled: bool,
    pub two_factor_methods: Vec<crate::settings::app::TwoFactorMethod>,
    pub require_two_factor: bool,
    pub two_factor_satisfied: bool,

    pub email_verified: bool,
    pub require_email_verification: bool,
    pub password_login_disabled: bool,

    pub language: compact_str::CompactString,

    pub has_password: bool,

    pub created: chrono::DateTime<chrono::Utc>,
}

#[schema_extension_derive::extendible]
#[init_args(User, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "AdminUser")]
pub struct AdminApiUser {
    pub uuid: uuid::Uuid,
    pub external_id: Option<compact_str::CompactString>,

    pub username: compact_str::CompactString,
    pub role: Option<super::role::AdminApiRole>,
    pub avatar: Option<String>,
    pub email: compact_str::CompactString,

    pub name_first: Option<compact_str::CompactString>,
    pub name_last: Option<compact_str::CompactString>,

    pub admin: bool,
    pub frozen: bool,
    pub suspended: bool,

    pub totp_enabled: bool,
    pub totp_last_used: Option<chrono::DateTime<chrono::Utc>>,
    pub email_two_factor_enabled: bool,
    pub two_factor_methods: Vec<crate::settings::app::TwoFactorMethod>,
    pub require_two_factor: bool,
    pub two_factor_satisfied: bool,

    pub email_verified: bool,
    pub require_email_verification: bool,
    pub password_login_disabled: bool,

    pub language: compact_str::CompactString,

    pub has_password: bool,

    pub created: chrono::DateTime<chrono::Utc>,
}
