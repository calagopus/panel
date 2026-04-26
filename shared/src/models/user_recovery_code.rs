use crate::prelude::*;
use rand::distr::SampleString;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{collections::BTreeMap, sync::LazyLock};

#[derive(Serialize, Deserialize)]
pub struct UserRecoveryCode {
    pub code: compact_str::CompactString,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for UserRecoveryCode {
    const NAME: &'static str = "user_recovery_code";

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
                "user_recovery_codes.code",
                compact_str::format_compact!("{prefix}code"),
            ),
            (
                "user_recovery_codes.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ])
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            code: row.try_get(compact_str::format_compact!("{prefix}code").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl UserRecoveryCode {
    pub async fn create_all(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
    ) -> Result<Vec<String>, crate::database::DatabaseError> {
        let mut codes = Vec::new();
        codes.reserve_exact(10);

        let mut transaction = database.write().begin().await?;

        for _ in 0..10 {
            let code = rand::distr::Alphanumeric.sample_string(&mut rand::rng(), 10);

            sqlx::query(
                r#"
                INSERT INTO user_recovery_codes (user_uuid, code, created)
                VALUES ($1, $2, NOW())
                "#,
            )
            .bind(user_uuid)
            .bind(&code)
            .execute(&mut *transaction)
            .await?;

            codes.push(code);
        }

        transaction.commit().await?;

        Ok(codes)
    }

    pub async fn delete_by_user_uuid_code(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
        code: &str,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            DELETE FROM user_recovery_codes
            WHERE user_recovery_codes.user_uuid = $1 AND user_recovery_codes.code = $2
            RETURNING {}
            "#,
            Self::columns_sql(None)
        ))
        .bind(user_uuid)
        .bind(code)
        .fetch_optional(database.write())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn delete_by_user_uuid(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
    ) -> Result<(), crate::database::DatabaseError> {
        sqlx::query(
            r#"
            DELETE FROM user_recovery_codes
            WHERE user_recovery_codes.user_uuid = $1
            "#,
        )
        .bind(user_uuid)
        .execute(database.write())
        .await?;

        Ok(())
    }
}
