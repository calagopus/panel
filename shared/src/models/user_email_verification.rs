use crate::prelude::*;
use rand::distr::SampleString;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{collections::BTreeMap, sync::LazyLock};

pub const TOKEN_VALIDITY_HOURS: i32 = 24;
pub const RESEND_COOLDOWN_SECONDS: f64 = 60.0;

#[derive(Serialize, Deserialize)]
pub struct UserEmailVerification {
    pub uuid: uuid::Uuid,
    pub user: super::user::User,

    /// For an email change this is the pending address, not yet written to the user.
    pub email: compact_str::CompactString,
    pub token: String,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for UserEmailVerification {
    const NAME: &'static str = "user_email_verification";

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
                "user_email_verifications.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "user_email_verifications.email",
                compact_str::format_compact!("{prefix}email"),
            ),
            (
                "user_email_verifications.token",
                compact_str::format_compact!("{prefix}token"),
            ),
            (
                "user_email_verifications.created",
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
            uuid: row.try_get(compact_str::format_compact!("{prefix}uuid").as_str())?,
            user: super::user::User::map(Some("user_"), row)?,
            email: row.try_get(compact_str::format_compact!("{prefix}email").as_str())?,
            token: row.try_get(compact_str::format_compact!("{prefix}token").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl UserEmailVerification {
    pub async fn create(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
        email: &str,
    ) -> Result<String, anyhow::Error> {
        let mut transaction = database.write().begin().await?;
        let token = Self::create_with_transaction(&mut transaction, user_uuid, email).await?;
        transaction.commit().await?;

        Ok(token)
    }

    /// Replaces any outstanding verification, so an older link cannot resurrect an abandoned
    /// address.
    pub async fn create_with_transaction(
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        user_uuid: uuid::Uuid,
        email: &str,
    ) -> Result<String, anyhow::Error> {
        let existing = sqlx::query(
            r#"
            SELECT COUNT(*)
            FROM user_email_verifications
            WHERE user_email_verifications.user_uuid = $1
            AND user_email_verifications.created > NOW() - make_interval(secs => $2)
            "#,
        )
        .bind(user_uuid)
        .bind(RESEND_COOLDOWN_SECONDS)
        .fetch_optional(&mut **transaction)
        .await?;

        if let Some(row) = existing
            && row.get::<i64, _>(0) > 0
        {
            return Err(anyhow::anyhow!(
                "a verification email was already requested recently"
            ));
        }

        sqlx::query(
            r#"
            DELETE FROM user_email_verifications
            WHERE user_email_verifications.user_uuid = $1
            "#,
        )
        .bind(user_uuid)
        .execute(&mut **transaction)
        .await?;

        let token = rand::distr::Alphanumeric.sample_string(&mut rand::rng(), 96);

        sqlx::query(
            r#"
            INSERT INTO user_email_verifications (user_uuid, email, token_start, token, created)
            VALUES ($1, $2, $3, crypt($4, gen_salt('bf', 12)), NOW())
            "#,
        )
        .bind(user_uuid)
        .bind(email)
        .bind(&token[0..16])
        .bind(&token)
        .execute(&mut **transaction)
        .await?;

        Ok(token)
    }

    pub async fn pending_email_by_user_uuid(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
    ) -> Result<Option<compact_str::CompactString>, crate::database::DatabaseError> {
        let row = sqlx::query(
            r#"
            SELECT user_email_verifications.email
            FROM user_email_verifications
            WHERE user_email_verifications.user_uuid = $1
            AND user_email_verifications.created > NOW() - make_interval(hours => $2)
            ORDER BY user_email_verifications.created DESC
            LIMIT 1
            "#,
        )
        .bind(user_uuid)
        .bind(TOKEN_VALIDITY_HOURS)
        .fetch_optional(database.read())
        .await?;

        let row = match row {
            Some(row) => row,
            None => return Ok(None),
        };

        Ok(Some(row.try_get("email")?))
    }

    pub async fn send(
        state: &crate::State,
        user: &super::user::User,
        email: &str,
        token: &str,
    ) -> Result<(), anyhow::Error> {
        let verification_link = {
            let settings = state.settings.get().await?;

            format!(
                "{}/auth/verify-email?token={}",
                settings.app.url.trim_end_matches('/'),
                urlencoding::encode(token),
            )
        };

        state
            .mail
            .send_template_foreground(
                state,
                "email_verification",
                email.into(),
                minijinja::context! {
                    user => user,
                    email => email,
                    verification_link => verification_link,
                },
            )
            .await
    }

    pub async fn delete_by_token(
        database: &crate::database::Database,
        token: &str,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let Some(token_start) = token.get(0..16) else {
            return Ok(None);
        };

        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            WITH user_email_verifications AS MATERIALIZED (
                SELECT * FROM user_email_verifications
                WHERE user_email_verifications.token_start = $1
                AND user_email_verifications.created > NOW() - make_interval(hours => $3)
            )
            SELECT {}, {} FROM user_email_verifications
            JOIN users ON users.uuid = user_email_verifications.user_uuid
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            WHERE user_email_verifications.token = crypt($2, user_email_verifications.token)
            "#,
            Self::columns_sql(None),
            super::user::User::columns_sql(Some("user_"))
        )))
        .bind(token_start)
        .bind(token)
        .bind(TOKEN_VALIDITY_HOURS)
        .fetch_optional(database.read())
        .await?;

        let row = match row {
            Some(row) => row,
            None => return Ok(None),
        };

        sqlx::query(
            r#"
            DELETE FROM user_email_verifications
            WHERE user_email_verifications.uuid = $1
            "#,
        )
        .bind(row.get::<uuid::Uuid, _>("uuid"))
        .execute(database.write())
        .await?;

        Ok(Some(Self::map(None, &row)?))
    }

    pub async fn delete_by_user_uuid(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
    ) -> Result<(), crate::database::DatabaseError> {
        sqlx::query(
            r#"
            DELETE FROM user_email_verifications
            WHERE user_email_verifications.user_uuid = $1
            "#,
        )
        .bind(user_uuid)
        .execute(database.write())
        .await?;

        Ok(())
    }

    pub async fn delete_expired(database: &crate::database::Database) -> Result<u64, sqlx::Error> {
        Ok(sqlx::query(
            r#"
            DELETE FROM user_email_verifications
            WHERE user_email_verifications.created < NOW() - make_interval(hours => $1)
            "#,
        )
        .bind(TOKEN_VALIDITY_HOURS)
        .execute(database.write())
        .await?
        .rows_affected())
    }
}
