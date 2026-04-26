use crate::prelude::*;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{collections::BTreeMap, sync::LazyLock};
#[derive(Serialize, Deserialize)]
pub struct ServerVariable {
    pub variable: super::nest_egg_variable::NestEggVariable,

    pub value: String,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for ServerVariable {
    const NAME: &'static str = "server_variable";

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
                "server_variables.value",
                compact_str::format_compact!("{prefix}value"),
            ),
            (
                "server_variables.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ]);

        columns.extend(super::nest_egg_variable::NestEggVariable::base_columns(
            Some("variable_"),
        ));

        columns
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        let variable = super::nest_egg_variable::NestEggVariable::map(Some("variable_"), row)?;
        let value = row
            .try_get(compact_str::format_compact!("{prefix}value").as_str())
            .unwrap_or_else(|_| {
                variable
                    .default_value
                    .clone()
                    .unwrap_or_else(|| "".to_string())
            });

        Ok(Self {
            variable,
            value,
            created: row
                .try_get(compact_str::format_compact!("{prefix}created").as_str())
                .unwrap_or_else(|_| chrono::Utc::now().naive_utc()),
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl ServerVariable {
    pub async fn create(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
        variable_uuid: uuid::Uuid,
        value: &str,
    ) -> Result<(), crate::database::DatabaseError> {
        sqlx::query(
            r#"
            INSERT INTO server_variables (server_uuid, variable_uuid, value)
            VALUES ($1, $2, $3)
            ON CONFLICT (server_uuid, variable_uuid) DO UPDATE SET value = EXCLUDED.value
            "#,
        )
        .bind(server_uuid)
        .bind(variable_uuid)
        .bind(value)
        .execute(database.write())
        .await?;

        Ok(())
    }

    pub async fn all_by_server_uuid_egg_uuid(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
        egg_uuid: uuid::Uuid,
    ) -> Result<Vec<Self>, crate::database::DatabaseError> {
        let rows = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM nest_egg_variables
            LEFT JOIN server_variables ON server_variables.variable_uuid = nest_egg_variables.uuid AND server_variables.server_uuid = $1
            WHERE nest_egg_variables.egg_uuid = $2
            ORDER BY nest_egg_variables.order_, nest_egg_variables.created
            "#,
            Self::columns_sql(None)
        ))
        .bind(server_uuid)
        .bind(egg_uuid)
        .fetch_all(database.read())
        .await?;

        rows.into_iter()
            .map(|row| Self::map(None, &row))
            .try_collect_vec()
    }
}

#[async_trait::async_trait]
impl IntoApiObject for ServerVariable {
    type ApiObject = ApiServerVariable;
    type ExtraArgs<'a> = ();

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::ApiObject, crate::database::DatabaseError> {
        let api_object = ApiServerVariable::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            ApiServerVariable {
                name: self.variable.name,
                description: self.variable.description,
                description_translations: self.variable.description_translations,
                env_variable: self.variable.env_variable,
                default_value: self.variable.default_value,
                value: self.value,
                is_editable: self.variable.user_editable,
                is_secret: self.variable.secret,
                rules: self.variable.rules,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[schema_extension_derive::extendible]
#[init_args(ServerVariable, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "ServerVariable")]
pub struct ApiServerVariable {
    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,
    pub description_translations: BTreeMap<compact_str::CompactString, compact_str::CompactString>,

    pub env_variable: compact_str::CompactString,
    pub default_value: Option<String>,
    pub value: String,
    pub is_editable: bool,
    pub is_secret: bool,
    pub rules: Vec<compact_str::CompactString>,

    pub created: chrono::DateTime<chrono::Utc>,
}
