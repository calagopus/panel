use crate::prelude::*;
use rand::distr::SampleString;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{collections::BTreeMap, sync::LazyLock};

#[derive(Serialize, Deserialize)]
pub struct UserPasswordReset {
    pub uuid: uuid::Uuid,
    pub user: super::user::User,

    pub token: String,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for UserPasswordReset {
    const NAME: &'static str = "user_password_reset";

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
                "user_password_resets.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "user_password_resets.token",
                compact_str::format_compact!("{prefix}token"),
            ),
            (
                "user_password_resets.created",
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
            token: row.try_get(compact_str::format_compact!("{prefix}token").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl UserPasswordReset {
    pub async fn create(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
    ) -> Result<String, anyhow::Error> {
        let existing = sqlx::query(
            r#"
            SELECT COUNT(*)
            FROM user_password_resets
            WHERE user_password_resets.user_uuid = $1 AND user_password_resets.created > NOW() - INTERVAL '20 minutes'
            "#,
        )
        .bind(user_uuid)
        .fetch_optional(database.read())
        .await?;

        if let Some(row) = existing
            && row.get::<i64, _>(0) > 0
        {
            return Err(anyhow::anyhow!(
                "a password reset was already requested recently"
            ));
        }

        let token = rand::distr::Alphanumeric.sample_string(&mut rand::rng(), 96);

        sqlx::query(
            r#"
            INSERT INTO user_password_resets (user_uuid, token, created)
            VALUES ($1, crypt($2, gen_salt('bf')), NOW())
            "#,
        )
        .bind(user_uuid)
        .bind(&token)
        .execute(database.write())
        .await?;

        Ok(token)
    }

    pub async fn delete_by_token(
        database: &crate::database::Database,
        token: &str,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}, {} FROM user_password_resets
            JOIN users ON users.uuid = user_password_resets.user_uuid
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            WHERE
                user_password_resets.token = crypt($1, user_password_resets.token)
                AND user_password_resets.created > NOW() - INTERVAL '20 minutes'
            "#,
            Self::columns_sql(None),
            super::user::User::columns_sql(Some("user_"))
        ))
        .bind(token)
        .fetch_optional(database.read())
        .await?;

        let row = match row {
            Some(row) => row,
            None => return Ok(None),
        };

        sqlx::query(
            r#"
            DELETE FROM user_password_resets
            WHERE user_password_resets.uuid = $1
            "#,
        )
        .bind(row.get::<uuid::Uuid, _>("uuid"))
        .execute(database.write())
        .await?;

        Ok(Some(Self::map(None, &row)?))
    }
}
