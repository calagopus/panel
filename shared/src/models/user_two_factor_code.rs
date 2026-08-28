use crate::prelude::*;
use rand::RngExt;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{collections::BTreeMap, sync::LazyLock};

pub const CODE_VALIDITY_MINUTES: i32 = 10;
pub const RESEND_COOLDOWN_SECONDS: f64 = 60.0;
pub const MAX_ATTEMPTS: i32 = 5;

#[derive(Serialize, Deserialize)]
pub struct UserTwoFactorCode {
    pub uuid: uuid::Uuid,

    pub attempts: i32,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for UserTwoFactorCode {
    const NAME: &'static str = "user_two_factor_code";

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
                "user_two_factor_codes.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "user_two_factor_codes.attempts",
                compact_str::format_compact!("{prefix}attempts"),
            ),
            (
                "user_two_factor_codes.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ])
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            uuid: row.try_get(compact_str::format_compact!("{prefix}uuid").as_str())?,
            attempts: row.try_get(compact_str::format_compact!("{prefix}attempts").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl UserTwoFactorCode {
    /// Returns the plaintext code; the database only ever holds a bcrypt hash of it.
    pub async fn create(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
    ) -> Result<compact_str::CompactString, anyhow::Error> {
        let mut transaction = database.write().begin().await?;

        let existing = sqlx::query(
            r#"
            SELECT COUNT(*)
            FROM user_two_factor_codes
            WHERE user_two_factor_codes.user_uuid = $1
            AND user_two_factor_codes.created > NOW() - make_interval(secs => $2)
            "#,
        )
        .bind(user_uuid)
        .bind(RESEND_COOLDOWN_SECONDS)
        .fetch_optional(&mut *transaction)
        .await?;

        if let Some(row) = existing
            && row.get::<i64, _>(0) > 0
        {
            return Err(anyhow::anyhow!("a code was already requested recently"));
        }

        sqlx::query(
            r#"
            DELETE FROM user_two_factor_codes
            WHERE user_two_factor_codes.user_uuid = $1
            "#,
        )
        .bind(user_uuid)
        .execute(&mut *transaction)
        .await?;

        let code = compact_str::format_compact!("{:06}", rand::rng().random_range(0..1_000_000));

        sqlx::query(
            r#"
            INSERT INTO user_two_factor_codes (user_uuid, code, created)
            VALUES ($1, crypt($2, gen_salt('bf', 12)), NOW())
            "#,
        )
        .bind(user_uuid)
        .bind(code.as_str())
        .execute(&mut *transaction)
        .await?;

        transaction.commit().await?;

        Ok(code)
    }

    /// A wrong guess burns an attempt and the code dies at [`MAX_ATTEMPTS`], so the six digit space
    /// cannot be walked inside the validity window. The row is locked so concurrent guesses cannot
    /// share an attempt.
    pub async fn consume(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
        code: &str,
    ) -> Result<bool, crate::database::DatabaseError> {
        let mut transaction = database.write().begin().await?;

        let row = sqlx::query(
            r#"
            SELECT
                user_two_factor_codes.uuid,
                user_two_factor_codes.attempts,
                user_two_factor_codes.code = crypt($2, user_two_factor_codes.code) AS matched
            FROM user_two_factor_codes
            WHERE user_two_factor_codes.user_uuid = $1
            AND user_two_factor_codes.created > NOW() - make_interval(mins => $3)
            ORDER BY user_two_factor_codes.created DESC
            LIMIT 1
            FOR UPDATE
            "#,
        )
        .bind(user_uuid)
        .bind(code)
        .bind(CODE_VALIDITY_MINUTES)
        .fetch_optional(&mut *transaction)
        .await?;

        let Some(row) = row else {
            transaction.commit().await?;

            return Ok(false);
        };

        let uuid: uuid::Uuid = row.try_get("uuid")?;
        let attempts: i32 = row.try_get("attempts")?;
        let matched: bool = row.try_get::<Option<bool>, _>("matched")?.unwrap_or(false);

        if matched || attempts + 1 >= MAX_ATTEMPTS {
            sqlx::query(
                r#"
                DELETE FROM user_two_factor_codes
                WHERE user_two_factor_codes.uuid = $1
                "#,
            )
            .bind(uuid)
            .execute(&mut *transaction)
            .await?;
        } else {
            sqlx::query(
                r#"
                UPDATE user_two_factor_codes
                SET attempts = attempts + 1
                WHERE user_two_factor_codes.uuid = $1
                "#,
            )
            .bind(uuid)
            .execute(&mut *transaction)
            .await?;
        }

        transaction.commit().await?;

        Ok(matched)
    }

    pub async fn delete_by_user_uuid(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
    ) -> Result<(), crate::database::DatabaseError> {
        sqlx::query(
            r#"
            DELETE FROM user_two_factor_codes
            WHERE user_two_factor_codes.user_uuid = $1
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
            DELETE FROM user_two_factor_codes
            WHERE user_two_factor_codes.created < NOW() - make_interval(mins => $1)
            "#,
        )
        .bind(CODE_VALIDITY_MINUTES)
        .execute(database.write())
        .await?
        .rows_affected())
    }
}
