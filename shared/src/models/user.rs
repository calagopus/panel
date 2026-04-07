use crate::{
    models::{InsertQueryBuilder, UpdateQueryBuilder},
    prelude::*,
    response::ApiResponse,
    storage::StorageUrlRetriever,
};
use axum::http::StatusCode;
use garde::Validate;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow, prelude::Type};
use std::{
    collections::BTreeMap,
    ops::{Deref, DerefMut},
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;
use webauthn_rs::prelude::CredentialID;

#[derive(Clone)]
pub enum AuthMethod {
    Session(super::user_session::UserSession),
    ApiKey(super::user_api_key::UserApiKey),
}

#[derive(Clone)]
pub struct UserImpersonator(pub User);

impl Deref for UserImpersonator {
    type Target = User;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for UserImpersonator {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

pub type GetUser = crate::extract::ConsumingExtension<User>;
pub type GetUserImpersonator = crate::extract::ConsumingExtension<Option<UserImpersonator>>;
pub type GetAuthMethod = crate::extract::ConsumingExtension<AuthMethod>;
pub type GetPermissionManager = axum::extract::Extension<PermissionManager>;

#[derive(Clone)]
pub struct PermissionManager {
    user_admin: bool,
    user_server_owner: bool,
    role_admin_permissions: Option<Arc<Vec<compact_str::CompactString>>>,
    role_server_permissions: Option<Arc<Vec<compact_str::CompactString>>>,
    api_key_user_permissions: Option<Arc<Vec<compact_str::CompactString>>>,
    api_key_admin_permissions: Option<Arc<Vec<compact_str::CompactString>>>,
    api_key_server_permissions: Option<Arc<Vec<compact_str::CompactString>>>,
    server_subuser_permissions: Option<Arc<Vec<compact_str::CompactString>>>,
}

impl PermissionManager {
    pub fn new(user: &User) -> Self {
        Self {
            user_admin: user.admin,
            user_server_owner: false,
            role_admin_permissions: user.role.as_ref().map(|r| r.admin_permissions.clone()),
            role_server_permissions: user.role.as_ref().map(|r| r.server_permissions.clone()),
            api_key_user_permissions: None,
            api_key_admin_permissions: None,
            api_key_server_permissions: None,
            server_subuser_permissions: None,
        }
    }

    pub fn add_api_key(mut self, api_key: &super::user_api_key::UserApiKey) -> Self {
        self.api_key_user_permissions = Some(api_key.user_permissions.clone());
        self.api_key_admin_permissions = Some(api_key.admin_permissions.clone());
        self.api_key_server_permissions = Some(api_key.server_permissions.clone());
        self
    }

    pub fn set_user_server_owner(mut self, is_owner: bool) -> Self {
        self.user_server_owner = is_owner;
        self
    }

    pub fn add_subuser_permissions(
        mut self,
        permissions: Option<Arc<Vec<compact_str::CompactString>>>,
    ) -> Self {
        self.server_subuser_permissions = permissions;
        self
    }

    pub fn has_user_permission(&self, permission: &str) -> Result<(), ApiResponse> {
        if let Some(api_key_permissions) = &self.api_key_user_permissions
            && !api_key_permissions.iter().any(|p| p == permission)
        {
            return Err(ApiResponse::error(format!(
                "you do not have permission to perform this action: {permission}"
            ))
            .with_status(StatusCode::FORBIDDEN));
        }

        Ok(())
    }

    pub fn has_admin_permission(&self, permission: &str) -> Result<(), ApiResponse> {
        let is_admin = self.user_admin;
        let has_role_perm = self
            .role_admin_permissions
            .as_ref()
            .is_some_and(|perms| perms.iter().any(|p| p == permission));

        let has_base_permission = is_admin || has_role_perm;

        if !has_base_permission {
            return Err(ApiResponse::error(format!(
                "you do not have permission to perform this action: {permission}"
            ))
            .with_status(StatusCode::FORBIDDEN));
        }

        if let Some(api_key_permissions) = &self.api_key_admin_permissions
            && !api_key_permissions.iter().any(|p| p == permission)
        {
            return Err(ApiResponse::error(format!(
                "you do not have permission to perform this action: {permission}"
            ))
            .with_status(StatusCode::FORBIDDEN));
        }

        Ok(())
    }

    pub fn has_server_permission(&self, permission: &str) -> Result<(), ApiResponse> {
        let is_admin = self.user_admin;

        let has_role_perm = self
            .role_server_permissions
            .as_ref()
            .is_some_and(|perms| perms.iter().any(|p| p == permission));

        let is_owner = self.user_server_owner;

        let has_subuser_perm = self
            .server_subuser_permissions
            .as_ref()
            .is_some_and(|perms| perms.iter().any(|p| p == permission));

        let has_base_permission = is_admin || has_role_perm || is_owner || has_subuser_perm;

        if !has_base_permission {
            return Err(ApiResponse::error(format!(
                "you do not have permission to perform this action: {permission}"
            ))
            .with_status(StatusCode::FORBIDDEN));
        }

        if let Some(api_key_permissions) = &self.api_key_server_permissions
            && !api_key_permissions.iter().any(|p| p == permission)
        {
            return Err(ApiResponse::error(format!(
                "you do not have permission to perform this action: {permission}"
            ))
            .with_status(StatusCode::FORBIDDEN));
        }

        Ok(())
    }
}

#[derive(ToSchema, Serialize, Deserialize, Type, PartialEq, Eq, Hash, Clone, Copy)]
#[serde(rename_all = "snake_case")]
#[schema(rename_all = "snake_case")]
#[sqlx(type_name = "user_toast_position", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum UserToastPosition {
    TopLeft,
    TopCenter,
    TopRight,
    BottomLeft,
    BottomCenter,
    BottomRight,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct User {
    pub uuid: uuid::Uuid,
    pub role: Option<super::role::Role>,
    pub external_id: Option<compact_str::CompactString>,

    pub avatar: Option<String>,
    pub username: compact_str::CompactString,
    pub email: compact_str::CompactString,

    pub name_first: compact_str::CompactString,
    pub name_last: compact_str::CompactString,

    pub admin: bool,
    pub totp_enabled: bool,
    pub totp_last_used: Option<chrono::NaiveDateTime>,
    pub totp_secret: Option<String>,

    pub language: compact_str::CompactString,
    pub toast_position: UserToastPosition,
    pub start_on_grouped_servers: bool,

    pub has_password: bool,

    pub created: chrono::NaiveDateTime,
}

impl BaseModel for User {
    const NAME: &'static str = "user";

    #[inline]
    fn columns(prefix: Option<&str>) -> BTreeMap<&'static str, compact_str::CompactString> {
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
                "users.language",
                compact_str::format_compact!("{prefix}language"),
            ),
            (
                "users.toast_position",
                compact_str::format_compact!("{prefix}toast_position"),
            ),
            (
                "users.start_on_grouped_servers",
                compact_str::format_compact!("{prefix}start_on_grouped_servers"),
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

        columns.extend(super::role::Role::columns(Some("role_")));

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
            totp_enabled: row
                .try_get(compact_str::format_compact!("{prefix}totp_enabled").as_str())?,
            totp_last_used: row
                .try_get(compact_str::format_compact!("{prefix}totp_last_used").as_str())?,
            totp_secret: row
                .try_get(compact_str::format_compact!("{prefix}totp_secret").as_str())?,
            language: row.try_get(compact_str::format_compact!("{prefix}language").as_str())?,
            toast_position: row
                .try_get(compact_str::format_compact!("{prefix}toast_position").as_str())?,
            start_on_grouped_servers: row.try_get(
                compact_str::format_compact!("{prefix}start_on_grouped_servers").as_str(),
            )?,
            has_password: row
                .try_get(compact_str::format_compact!("{prefix}has_password").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
        })
    }
}

impl User {
    pub async fn create_automatic_admin(
        database: &crate::database::Database,
        username: &str,
        email: &str,
        name_first: &str,
        name_last: &str,
        password: &str,
    ) -> Result<uuid::Uuid, crate::database::DatabaseError> {
        let row = sqlx::query(
            r#"
            INSERT INTO users (username, email, name_first, name_last, password, admin)
            VALUES ($1, $2, $3, $4, crypt($5, gen_salt('bf', 8)), (SELECT COUNT(*) = 0 FROM users))
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
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM users
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            JOIN user_security_keys ON user_security_keys.user_uuid = users.uuid
            WHERE users.external_id = $1
            "#,
            Self::columns_sql(None)
        ))
        .bind(external_id)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    /// Returns the user and session associated with the given session string, if valid.
    ///
    /// Cached for 5 seconds.
    pub async fn by_session_cached(
        database: &crate::database::Database,
        session: &str,
    ) -> Result<Option<(Self, super::user_session::UserSession)>, anyhow::Error> {
        let (key_id, key) = match session.split_once(':') {
            Some((key_id, key)) => (key_id, key),
            None => return Ok(None),
        };

        database
            .cache
            .cached(&format!("user::session::{session}"), 5, || async {
                let row = sqlx::query(&format!(
                    r#"
                    SELECT {}, {}
                    FROM users
                    LEFT JOIN roles ON roles.uuid = users.role_uuid
                    JOIN user_sessions ON user_sessions.user_uuid = users.uuid
                    WHERE user_sessions.key_id = $1 AND user_sessions.key = crypt($2, user_sessions.key)
                    "#,
                    Self::columns_sql(None),
                    super::user_session::UserSession::columns_sql(Some("session_"))
                ))
                .bind(key_id)
                .bind(key)
                .fetch_optional(database.read())
                .await?;

                row.try_map(|row| {
                    Ok::<_, anyhow::Error>((
                        Self::map(None, &row)?,
                        super::user_session::UserSession::map(Some("session_"), &row)?,
                    ))
                })
            })
            .await
    }

    /// Returns the user and API key associated with the given API key string, if valid.
    ///
    /// Cached for 5 seconds.
    pub async fn by_api_key_cached(
        database: &crate::database::Database,
        key: &str,
    ) -> Result<Option<(Self, super::user_api_key::UserApiKey)>, anyhow::Error> {
        database
            .cache
            .cached(&format!("user::api_key::{key}"), 5, || async {
                let row = sqlx::query(&format!(
                    r#"
                    SELECT {}, {}
                    FROM users
                    LEFT JOIN roles ON roles.uuid = users.role_uuid
                    JOIN user_api_keys ON user_api_keys.user_uuid = users.uuid
                    WHERE user_api_keys.key_start = $1 AND user_api_keys.key = crypt($2, user_api_keys.key)
                    "#,
                    Self::columns_sql(None),
                    super::user_api_key::UserApiKey::columns_sql(Some("api_key_"))
                ))
                .bind(&key[0..16])
                .bind(key)
                .fetch_optional(database.read())
                .await?;

                row.try_map(|row| {
                    Ok::<_, anyhow::Error>((
                        Self::map(None, &row)?,
                        super::user_api_key::UserApiKey::map(Some("api_key_"), &row)?,
                    ))
                })
            })
            .await
    }

    pub async fn by_credential_id(
        database: &crate::database::Database,
        credential_id: &CredentialID,
    ) -> Result<
        Option<(Self, super::user_security_key::UserSecurityKey)>,
        crate::database::DatabaseError,
    > {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}, {}
            FROM users
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            JOIN user_security_keys ON user_security_keys.user_uuid = users.uuid
            WHERE user_security_keys.credential_id = $1
            "#,
            Self::columns_sql(None),
            super::user_security_key::UserSecurityKey::columns_sql(Some("security_key_"))
        ))
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
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM users
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            WHERE lower(users.email) = lower($1)
            "#,
            Self::columns_sql(None)
        ))
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
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM users
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            WHERE lower(users.email) = lower($1) AND users.password IS NOT NULL AND users.password = crypt($2, users.password)
            "#,
            Self::columns_sql(None)
        ))
        .bind(email)
        .bind(password)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn by_username(
        database: &crate::database::Database,
        username: &str,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM users
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            WHERE lower(users.username) = lower($1)
            "#,
            Self::columns_sql(None)
        ))
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
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM users
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            WHERE lower(users.username) = lower($1) AND users.password IS NOT NULL AND users.password = crypt($2, users.password)
            "#,
            Self::columns_sql(None)
        ))
        .bind(username)
        .bind(password)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn by_username_public_key(
        database: &crate::database::Database,
        username: &str,
        public_key: russh::keys::PublicKey,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM users
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            JOIN user_ssh_keys ON user_ssh_keys.user_uuid = users.uuid
            WHERE lower(users.username) = lower($1) AND user_ssh_keys.fingerprint = $2
            "#,
            Self::columns_sql(None)
        ))
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

        let rows = sqlx::query(&format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM users
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            WHERE users.role_uuid = $1 AND ($2 IS NULL OR users.username ILIKE '%' || $2 || '%' OR users.email ILIKE '%' || $2 || '%')
            ORDER BY users.created
            LIMIT $3 OFFSET $4
            "#,
            Self::columns_sql(None)
        ))
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

        let rows = sqlx::query(&format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM users
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            WHERE $1 IS NULL OR users.username ILIKE '%' || $1 || '%' OR users.email ILIKE '%' || $1 || '%'
            ORDER BY users.created
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
            SELECT 1
            FROM users
            WHERE users.uuid = $1 AND users.password = crypt($2, users.password)
            "#,
        )
        .bind(self.uuid)
        .bind(password)
        .fetch_optional(database.read())
        .await?;

        Ok(row.is_some())
    }

    /// Update the User password, `None` will disallow password login and not require one when changing
    pub async fn update_password(
        &mut self,
        database: &crate::database::Database,
        password: Option<&str>,
    ) -> Result<(), crate::database::DatabaseError> {
        if let Some(password) = password {
            sqlx::query(
                r#"
		            UPDATE users
		            SET password = crypt($2, gen_salt('bf'))
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

    #[inline]
    pub fn into_api_object(self, storage_url_retriever: &StorageUrlRetriever<'_>) -> ApiUser {
        ApiUser {
            uuid: self.uuid,
            username: self.username,
            avatar: self
                .avatar
                .as_ref()
                .map(|a| storage_url_retriever.get_url(a)),
            totp_enabled: self.totp_enabled,
            created: self.created.and_utc(),
        }
    }

    #[inline]
    pub fn into_api_full_object(
        self,
        storage_url_retriever: &StorageUrlRetriever<'_>,
    ) -> ApiFullUser {
        let require_two_factor = self.require_two_factor(storage_url_retriever.get_settings());

        ApiFullUser {
            uuid: self.uuid,
            username: self.username,
            role: self.role.map(|r| r.into_admin_api_object()),
            avatar: self
                .avatar
                .as_ref()
                .map(|a| storage_url_retriever.get_url(a)),
            email: self.email,
            name_first: self.name_first,
            name_last: self.name_last,
            admin: self.admin,
            totp_enabled: self.totp_enabled,
            totp_last_used: self.totp_last_used.map(|dt| dt.and_utc()),
            require_two_factor,
            language: self.language,
            toast_position: self.toast_position,
            start_on_grouped_servers: self.start_on_grouped_servers,
            has_password: self.has_password,
            created: self.created.and_utc(),
        }
    }

    #[inline]
    pub fn into_admin_api_object(
        self,
        storage_url_retriever: &StorageUrlRetriever<'_>,
    ) -> AdminApiUser {
        let require_two_factor = self.require_two_factor(storage_url_retriever.get_settings());

        AdminApiUser {
            uuid: self.uuid,
            external_id: self.external_id,
            username: self.username,
            role: self.role.map(|r| r.into_admin_api_object()),
            avatar: self
                .avatar
                .as_ref()
                .map(|a| storage_url_retriever.get_url(a)),
            email: self.email,
            name_first: self.name_first,
            name_last: self.name_last,
            admin: self.admin,
            totp_enabled: self.totp_enabled,
            totp_last_used: self.totp_last_used.map(|dt| dt.and_utc()),
            require_two_factor,
            language: self.language,
            toast_position: self.toast_position,
            start_on_grouped_servers: self.start_on_grouped_servers,
            has_password: self.has_password,
            created: self.created.and_utc(),
        }
    }
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
    #[garde(length(chars, min = 2, max = 255))]
    #[schema(min_length = 2, max_length = 255)]
    pub name_first: compact_str::CompactString,
    #[garde(length(chars, min = 2, max = 255))]
    #[schema(min_length = 2, max_length = 255)]
    pub name_last: compact_str::CompactString,
    #[garde(length(chars, min = 1, max = 512))]
    #[schema(min_length = 1, max_length = 512)]
    pub password: Option<String>,

    #[garde(skip)]
    pub admin: bool,

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

    async fn create(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        if let Some(role_uuid) = options.role_uuid {
            super::role::Role::by_uuid_optional_cached(&state.database, role_uuid)
                .await?
                .ok_or(crate::database::InvalidRelationError("role"))?;
        }

        let mut transaction = state.database.write().begin().await?;

        let mut query_builder = InsertQueryBuilder::new("users");

        Self::run_create_handlers(&mut options, &mut query_builder, state, &mut transaction)
            .await?;

        query_builder
            .set("role_uuid", options.role_uuid)
            .set("external_id", options.external_id.as_deref())
            .set("username", &options.username)
            .set("email", &options.email)
            .set("name_first", &options.name_first)
            .set("name_last", &options.name_last);

        if let Some(password) = &options.password {
            query_builder.set_expr("password", "crypt($1, gen_salt('bf', 8))", vec![password]);
        }

        query_builder
            .set("admin", options.admin)
            .set("language", &options.language);

        let row = query_builder
            .returning("uuid")
            .fetch_one(&mut *transaction)
            .await?;
        let uuid: uuid::Uuid = row.get("uuid");

        transaction.commit().await?;

        Self::by_uuid(&state.database, uuid).await
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
    #[garde(length(chars, min = 2, max = 255))]
    #[schema(min_length = 2, max_length = 255)]
    pub name_first: Option<compact_str::CompactString>,
    #[garde(length(chars, min = 2, max = 255))]
    #[schema(min_length = 2, max_length = 255)]
    pub name_last: Option<compact_str::CompactString>,
    #[garde(length(chars, min = 8, max = 512))]
    #[schema(min_length = 8, max_length = 512)]
    pub password: Option<Option<compact_str::CompactString>>,

    #[garde(skip)]
    pub toast_position: Option<UserToastPosition>,
    #[garde(skip)]
    pub start_on_grouped_servers: Option<bool>,

    #[garde(skip)]
    pub admin: Option<bool>,

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

    fn get_update_handlers() -> &'static LazyLock<UpdateListenerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateListenerList<User>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &UPDATE_LISTENERS
    }

    async fn update(
        &mut self,
        state: &crate::State,
        mut options: Self::UpdateOptions,
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

        let mut transaction = state.database.write().begin().await?;

        let mut query_builder = UpdateQueryBuilder::new("users");

        Self::run_update_handlers(
            self,
            &mut options,
            &mut query_builder,
            state,
            &mut transaction,
        )
        .await?;

        query_builder
            .set("role_uuid", options.role_uuid.as_ref())
            .set("external_id", options.external_id.as_ref())
            .set("username", options.username.as_ref())
            .set("email", options.email.as_ref())
            .set("name_first", options.name_first.as_ref())
            .set("name_last", options.name_last.as_ref())
            .set("admin", options.admin)
            .set("language", options.language.as_ref())
            .set("toast_position", options.toast_position.as_ref())
            .set("start_on_grouped_servers", options.start_on_grouped_servers)
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut *transaction).await?;

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
        if let Some(toast_position) = options.toast_position {
            self.toast_position = toast_position;
        }
        if let Some(start_on_grouped_servers) = options.start_on_grouped_servers {
            self.start_on_grouped_servers = start_on_grouped_servers;
        }
        if let Some(admin) = options.admin {
            self.admin = admin;
        }
        if let Some(language) = options.language {
            self.language = language;
        }

        transaction.commit().await?;

        if let Some(password) = options.password {
            self.update_password(&state.database, password.as_deref())
                .await?;
        }

        Ok(())
    }
}

#[async_trait::async_trait]
impl DeletableModel for User {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteListenerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteListenerList<User>> =
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
            DELETE FROM users
            WHERE users.uuid = $1
            "#,
        )
        .bind(self.uuid)
        .execute(&mut *transaction)
        .await?;

        state.storage.remove(self.avatar.as_deref()).await?;

        transaction.commit().await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl ByUuid for User {
    async fn by_uuid(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
    ) -> Result<Self, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM users
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            WHERE users.uuid = $1
            "#,
            Self::columns_sql(None)
        ))
        .bind(uuid)
        .fetch_one(database.read())
        .await?;

        Self::map(None, &row)
    }
}

#[derive(ToSchema, Serialize)]
#[schema(title = "User")]
pub struct ApiUser {
    pub uuid: uuid::Uuid,

    pub username: compact_str::CompactString,
    pub avatar: Option<String>,

    pub totp_enabled: bool,

    pub created: chrono::DateTime<chrono::Utc>,
}

#[derive(ToSchema, Serialize)]
#[schema(title = "FullUser")]
pub struct ApiFullUser {
    pub uuid: uuid::Uuid,

    pub username: compact_str::CompactString,
    pub role: Option<super::role::AdminApiRole>,
    pub avatar: Option<String>,
    pub email: compact_str::CompactString,

    pub name_first: compact_str::CompactString,
    pub name_last: compact_str::CompactString,

    pub admin: bool,
    pub totp_enabled: bool,
    pub totp_last_used: Option<chrono::DateTime<chrono::Utc>>,
    pub require_two_factor: bool,

    pub language: compact_str::CompactString,
    pub toast_position: UserToastPosition,
    pub start_on_grouped_servers: bool,

    pub has_password: bool,

    pub created: chrono::DateTime<chrono::Utc>,
}

#[derive(ToSchema, Serialize)]
#[schema(title = "AdminUser")]
pub struct AdminApiUser {
    pub uuid: uuid::Uuid,
    pub external_id: Option<compact_str::CompactString>,

    pub username: compact_str::CompactString,
    pub role: Option<super::role::AdminApiRole>,
    pub avatar: Option<String>,
    pub email: compact_str::CompactString,

    pub name_first: compact_str::CompactString,
    pub name_last: compact_str::CompactString,

    pub admin: bool,
    pub totp_enabled: bool,
    pub totp_last_used: Option<chrono::DateTime<chrono::Utc>>,
    pub require_two_factor: bool,

    pub language: compact_str::CompactString,
    pub toast_position: UserToastPosition,
    pub start_on_grouped_servers: bool,

    pub has_password: bool,

    pub created: chrono::DateTime<chrono::Utc>,
}
