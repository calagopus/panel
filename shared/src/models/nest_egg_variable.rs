use crate::{
    models::{InsertQueryBuilder, UpdateQueryBuilder},
    prelude::*,
};
use garde::Validate;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{
    collections::BTreeMap,
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

pub fn validate_description_translations(
    description_translations: &BTreeMap<compact_str::CompactString, compact_str::CompactString>,
    _context: &(),
) -> Result<(), garde::Error> {
    if description_translations.len() > 512 {
        return Err(garde::Error::new("cannot have more than 512 entries"));
    }

    for (lang, translation) in description_translations {
        if lang.len() < 2 || lang.len() > 15 {
            return Err(garde::Error::new(format!(
                "language code '{}' must be between 2 and 15 characters",
                lang
            )));
        }
        if translation.is_empty() || translation.len() > 1024 {
            return Err(garde::Error::new(format!(
                "translation for language '{}' must be between 1 and 1024 characters",
                lang
            )));
        }
    }

    Ok(())
}

#[derive(ToSchema, Validate, Serialize, Deserialize, Clone)]
pub struct ExportedNestEggVariable {
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: compact_str::CompactString,
    #[garde(length(max = 1024))]
    #[schema(max_length = 1024)]
    pub description: Option<compact_str::CompactString>,
    #[garde(custom(validate_description_translations))]
    #[serde(default)]
    pub description_translations: BTreeMap<compact_str::CompactString, compact_str::CompactString>,
    #[garde(skip)]
    #[serde(default, alias = "sort")]
    pub order: i16,

    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub env_variable: compact_str::CompactString,
    #[garde(length(max = 1024))]
    #[schema(max_length = 1024)]
    #[serde(
        default,
        deserialize_with = "crate::deserialize::deserialize_stringable_option"
    )]
    pub default_value: Option<String>,

    #[garde(skip)]
    pub user_viewable: bool,
    #[garde(skip)]
    pub user_editable: bool,
    #[garde(skip)]
    #[serde(default)]
    pub secret: bool,
    #[garde(skip)]
    #[serde(
        default,
        deserialize_with = "crate::deserialize::deserialize_nest_egg_variable_rules"
    )]
    pub rules: Vec<compact_str::CompactString>,
}

#[derive(Serialize, Deserialize)]
pub struct NestEggVariable {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,
    pub description_translations: BTreeMap<compact_str::CompactString, compact_str::CompactString>,
    pub order: i16,

    pub env_variable: compact_str::CompactString,
    pub default_value: Option<String>,
    pub user_viewable: bool,
    pub user_editable: bool,
    pub secret: bool,
    pub rules: Vec<compact_str::CompactString>,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for NestEggVariable {
    const NAME: &'static str = "nest_egg_variable";

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
                "nest_egg_variables.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "nest_egg_variables.name",
                compact_str::format_compact!("{prefix}name"),
            ),
            (
                "nest_egg_variables.description",
                compact_str::format_compact!("{prefix}description"),
            ),
            (
                "nest_egg_variables.description_translations",
                compact_str::format_compact!("{prefix}description_translations"),
            ),
            (
                "nest_egg_variables.order_",
                compact_str::format_compact!("{prefix}order"),
            ),
            (
                "nest_egg_variables.env_variable",
                compact_str::format_compact!("{prefix}env_variable"),
            ),
            (
                "nest_egg_variables.default_value",
                compact_str::format_compact!("{prefix}default_value"),
            ),
            (
                "nest_egg_variables.user_viewable",
                compact_str::format_compact!("{prefix}user_viewable"),
            ),
            (
                "nest_egg_variables.user_editable",
                compact_str::format_compact!("{prefix}user_editable"),
            ),
            (
                "nest_egg_variables.secret",
                compact_str::format_compact!("{prefix}secret"),
            ),
            (
                "nest_egg_variables.rules",
                compact_str::format_compact!("{prefix}rules"),
            ),
            (
                "nest_egg_variables.created",
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
            description_translations: serde_json::from_value(row.try_get(
                compact_str::format_compact!("{prefix}description_translations").as_str(),
            )?)?,
            order: row.try_get(compact_str::format_compact!("{prefix}order").as_str())?,
            env_variable: row
                .try_get(compact_str::format_compact!("{prefix}env_variable").as_str())?,
            default_value: row
                .try_get(compact_str::format_compact!("{prefix}default_value").as_str())?,
            user_viewable: row
                .try_get(compact_str::format_compact!("{prefix}user_viewable").as_str())?,
            user_editable: row
                .try_get(compact_str::format_compact!("{prefix}user_editable").as_str())?,
            secret: row.try_get(compact_str::format_compact!("{prefix}secret").as_str())?,
            rules: row.try_get(compact_str::format_compact!("{prefix}rules").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl NestEggVariable {
    pub async fn by_egg_uuid_uuid(
        database: &crate::database::Database,
        egg_uuid: uuid::Uuid,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM nest_egg_variables
            WHERE nest_egg_variables.egg_uuid = $1 AND nest_egg_variables.uuid = $2
            "#,
            Self::columns_sql(None)
        ))
        .bind(egg_uuid)
        .bind(uuid)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn all_by_egg_uuid(
        database: &crate::database::Database,
        egg_uuid: uuid::Uuid,
    ) -> Result<Vec<Self>, crate::database::DatabaseError> {
        let rows = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM nest_egg_variables
            WHERE nest_egg_variables.egg_uuid = $1
            ORDER BY nest_egg_variables.order_, nest_egg_variables.created
            "#,
            Self::columns_sql(None)
        ))
        .bind(egg_uuid)
        .fetch_all(database.read())
        .await?;

        rows.into_iter()
            .map(|row| Self::map(None, &row))
            .try_collect_vec()
    }

    #[inline]
    pub fn into_exported(self) -> ExportedNestEggVariable {
        ExportedNestEggVariable {
            name: self.name,
            description: self.description,
            description_translations: self.description_translations,
            order: self.order,
            env_variable: self.env_variable,
            default_value: self.default_value,
            user_viewable: self.user_viewable,
            user_editable: self.user_editable,
            secret: self.secret,
            rules: self.rules,
        }
    }
}

#[async_trait::async_trait]
impl IntoAdminApiObject for NestEggVariable {
    type AdminApiObject = AdminApiNestEggVariable;
    type ExtraArgs<'a> = ();

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiNestEggVariable::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            AdminApiNestEggVariable {
                uuid: self.uuid,
                name: self.name,
                description: self.description,
                description_translations: self.description_translations,
                order: self.order,
                env_variable: self.env_variable,
                default_value: self.default_value,
                user_viewable: self.user_viewable,
                user_editable: self.user_editable,
                is_secret: self.secret,
                rules: self.rules,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[derive(ToSchema, Deserialize, Validate)]
pub struct CreateNestEggVariableOptions {
    #[garde(skip)]
    pub egg_uuid: uuid::Uuid,

    #[garde(length(chars, min = 3, max = 255))]
    #[schema(min_length = 3, max_length = 255)]
    pub name: compact_str::CompactString,
    #[garde(length(chars, min = 1, max = 1024))]
    #[schema(min_length = 1, max_length = 1024)]
    pub description: Option<compact_str::CompactString>,
    #[garde(custom(validate_description_translations))]
    pub description_translations: BTreeMap<compact_str::CompactString, compact_str::CompactString>,

    #[garde(skip)]
    pub order: i16,

    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub env_variable: compact_str::CompactString,

    #[garde(length(max = 1024))]
    #[schema(max_length = 1024)]
    pub default_value: Option<String>,

    #[garde(skip)]
    pub user_viewable: bool,
    #[garde(skip)]
    pub user_editable: bool,
    #[garde(skip)]
    pub secret: bool,

    #[garde(custom(rule_validator::validate_rules))]
    pub rules: Vec<compact_str::CompactString>,
}

#[async_trait::async_trait]
impl CreatableModel for NestEggVariable {
    type CreateOptions<'a> = CreateNestEggVariableOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<NestEggVariable>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
    ) -> Result<Self::CreateResult, crate::database::DatabaseError> {
        options.validate()?;

        let mut transaction = state.database.write().begin().await?;

        let mut query_builder = InsertQueryBuilder::new("nest_egg_variables");

        Self::run_create_handlers(&mut options, &mut query_builder, state, &mut transaction)
            .await?;

        query_builder
            .set("egg_uuid", options.egg_uuid)
            .set("name", &options.name)
            .set("description", &options.description)
            .set(
                "description_translations",
                serde_json::to_value(&options.description_translations)?,
            )
            .set("order_", options.order)
            .set("env_variable", &options.env_variable)
            .set("default_value", &options.default_value)
            .set("user_viewable", options.user_viewable)
            .set("user_editable", options.user_editable)
            .set("secret", options.secret)
            .set("rules", &options.rules);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut *transaction)
            .await?;
        let nest_egg_variable = Self::map(None, &row)?;

        transaction.commit().await?;

        Ok(nest_egg_variable)
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Default)]
pub struct UpdateNestEggVariableOptions {
    #[garde(length(chars, min = 3, max = 255))]
    #[schema(min_length = 3, max_length = 255)]
    pub name: Option<compact_str::CompactString>,
    #[garde(length(chars, min = 1, max = 1024))]
    #[schema(min_length = 1, max_length = 1024)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub description: Option<Option<compact_str::CompactString>>,
    #[garde(inner(custom(validate_description_translations)))]
    pub description_translations:
        Option<BTreeMap<compact_str::CompactString, compact_str::CompactString>>,

    #[garde(skip)]
    pub order: Option<i16>,

    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub env_variable: Option<compact_str::CompactString>,

    #[garde(length(max = 1024))]
    #[schema(max_length = 1024)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub default_value: Option<Option<String>>,

    #[garde(skip)]
    pub user_viewable: Option<bool>,
    #[garde(skip)]
    pub user_editable: Option<bool>,
    #[garde(skip)]
    pub secret: Option<bool>,

    #[garde(inner(custom(rule_validator::validate_rules)))]
    pub rules: Option<Vec<compact_str::CompactString>>,
}

#[async_trait::async_trait]
impl UpdatableModel for NestEggVariable {
    type UpdateOptions = UpdateNestEggVariableOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateListenerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateListenerList<NestEggVariable>> =
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

        let mut query_builder = UpdateQueryBuilder::new("nest_egg_variables");

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
            .set(
                "description",
                options.description.as_ref().map(|d| d.as_ref()),
            )
            .set(
                "description_translations",
                options
                    .description_translations
                    .as_ref()
                    .map(serde_json::to_value)
                    .transpose()?,
            )
            .set("order_", options.order)
            .set("env_variable", options.env_variable.as_ref())
            .set(
                "default_value",
                options.default_value.as_ref().map(|d| d.as_ref()),
            )
            .set("user_viewable", options.user_viewable)
            .set("user_editable", options.user_editable)
            .set("secret", options.secret)
            .set("rules", options.rules.as_ref())
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut *transaction).await?;

        if let Some(name) = options.name {
            self.name = name;
        }
        if let Some(description) = options.description {
            self.description = description;
        }
        if let Some(description_translations) = options.description_translations {
            self.description_translations = description_translations;
        }
        if let Some(order) = options.order {
            self.order = order;
        }
        if let Some(env_variable) = options.env_variable {
            self.env_variable = env_variable;
        }
        if let Some(default_value) = options.default_value {
            self.default_value = default_value;
        }
        if let Some(user_viewable) = options.user_viewable {
            self.user_viewable = user_viewable;
        }
        if let Some(user_editable) = options.user_editable {
            self.user_editable = user_editable;
        }
        if let Some(secret) = options.secret {
            self.secret = secret;
        }
        if let Some(rules) = options.rules {
            self.rules = rules;
        }

        transaction.commit().await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl DeletableModel for NestEggVariable {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteListenerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteListenerList<NestEggVariable>> =
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
            DELETE FROM nest_egg_variables
            WHERE nest_egg_variables.uuid = $1
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
#[init_args(NestEggVariable, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "NestEggVariable")]
pub struct AdminApiNestEggVariable {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,
    pub description_translations: BTreeMap<compact_str::CompactString, compact_str::CompactString>,
    pub order: i16,

    pub env_variable: compact_str::CompactString,
    pub default_value: Option<String>,
    pub user_viewable: bool,
    pub user_editable: bool,
    pub is_secret: bool,
    pub rules: Vec<compact_str::CompactString>,

    pub created: chrono::DateTime<chrono::Utc>,
}
