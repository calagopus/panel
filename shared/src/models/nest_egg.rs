use crate::{
    models::{
        InsertQueryBuilder, UpdateQueryBuilder, nest_egg_variable::CreateNestEggVariableOptions,
    },
    prelude::*,
};
use garde::Validate;
use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{
    collections::{BTreeMap, HashSet},
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

pub fn validate_docker_images(
    docker_images: &IndexMap<compact_str::CompactString, compact_str::CompactString>,
    _context: &(),
) -> Result<(), garde::Error> {
    let mut seen_images = HashSet::new();
    for image in docker_images.values() {
        if !seen_images.insert(image) {
            return Err(garde::Error::new(compact_str::format_compact!(
                "duplicate docker image: {}",
                image
            )));
        }
    }

    Ok(())
}

fn true_fn() -> bool {
    true
}

#[derive(ToSchema, Serialize, Deserialize, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum ServerConfigurationFileParser {
    File,
    Yaml,
    Properties,
    Ini,
    Json,
    Xml,
    Toml,
}

#[derive(ToSchema, Serialize, Deserialize, Clone)]
pub struct ProcessConfigurationFileReplacement {
    pub r#match: compact_str::CompactString,
    #[serde(default)]
    pub insert_new: bool,
    #[serde(default = "true_fn")]
    pub update_existing: bool,
    pub if_value: Option<compact_str::CompactString>,
    pub replace_with: serde_json::Value,
}

#[derive(ToSchema, Serialize, Deserialize, Clone)]
pub struct ProcessConfigurationFile {
    pub file: compact_str::CompactString,
    #[serde(default = "true_fn")]
    pub create_new: bool,
    #[schema(inline)]
    pub parser: ServerConfigurationFileParser,
    #[schema(inline)]
    pub replace: Vec<ProcessConfigurationFileReplacement>,
}

#[derive(ToSchema, Serialize, Clone)]
pub struct ProcessConfiguration {
    #[schema(inline)]
    pub startup: crate::models::nest_egg::NestEggConfigStartup,
    #[schema(inline)]
    pub stop: crate::models::nest_egg::NestEggConfigStop,
    #[schema(inline)]
    pub configs: Vec<ProcessConfigurationFile>,
}

#[derive(ToSchema, Serialize, Deserialize, Clone, Default)]
pub struct NestEggConfigStartup {
    #[serde(
        default,
        deserialize_with = "crate::deserialize::deserialize_array_or_not"
    )]
    pub done: Vec<compact_str::CompactString>,
    #[serde(default)]
    pub strip_ansi: bool,
}

#[derive(ToSchema, Serialize, Deserialize, Clone, Default)]
pub struct NestEggConfigStop {
    pub r#type: compact_str::CompactString,
    pub value: Option<compact_str::CompactString>,
}

#[derive(ToSchema, Serialize, Deserialize, Clone)]
pub struct NestEggConfigScript {
    pub container: compact_str::CompactString,
    pub entrypoint: compact_str::CompactString,
    #[serde(alias = "script")]
    pub content: String,
}

#[derive(ToSchema, Serialize, Deserialize, Clone)]
pub struct ExportedNestEggConfigsFilesFile {
    #[serde(default = "true_fn")]
    pub create_new: bool,
    #[schema(inline)]
    pub parser: ServerConfigurationFileParser,
    #[schema(inline)]
    pub replace: Vec<ProcessConfigurationFileReplacement>,
}

#[derive(ToSchema, Validate, Serialize, Deserialize, Clone)]
pub struct ExportedNestEggConfigs {
    #[garde(skip)]
    #[schema(inline)]
    #[serde(
        default,
        deserialize_with = "crate::deserialize::deserialize_nest_egg_config_files"
    )]
    pub files: IndexMap<compact_str::CompactString, ExportedNestEggConfigsFilesFile>,
    #[garde(skip)]
    #[schema(inline)]
    #[serde(
        default,
        deserialize_with = "crate::deserialize::deserialize_pre_stringified"
    )]
    pub startup: NestEggConfigStartup,
    #[garde(skip)]
    #[schema(inline)]
    #[serde(
        default,
        deserialize_with = "crate::deserialize::deserialize_nest_egg_config_stop"
    )]
    pub stop: NestEggConfigStop,
}

#[derive(ToSchema, Validate, Serialize, Deserialize, Clone)]
pub struct ExportedNestEggScripts {
    #[garde(skip)]
    #[schema(inline)]
    pub installation: NestEggConfigScript,
}

#[derive(ToSchema, Validate, Serialize, Deserialize, Clone)]
pub struct ExportedNestEgg {
    #[garde(skip)]
    #[serde(default = "uuid::Uuid::new_v4")]
    pub uuid: uuid::Uuid,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: compact_str::CompactString,
    #[garde(length(max = 1024))]
    #[schema(max_length = 1024)]
    #[serde(deserialize_with = "crate::deserialize::deserialize_string_option")]
    pub description: Option<compact_str::CompactString>,
    #[garde(length(chars, min = 2, max = 255))]
    #[schema(min_length = 2, max_length = 255)]
    pub author: compact_str::CompactString,

    #[garde(skip)]
    #[schema(inline)]
    pub config: ExportedNestEggConfigs,
    #[garde(skip)]
    #[schema(inline)]
    pub scripts: ExportedNestEggScripts,

    #[garde(length(chars, min = 1, max = 8192))]
    #[schema(min_length = 1, max_length = 8192)]
    pub startup: compact_str::CompactString,
    #[garde(skip)]
    #[serde(default)]
    pub force_outgoing_ip: bool,
    #[garde(skip)]
    #[serde(default)]
    pub separate_port: bool,

    #[garde(skip)]
    #[serde(
        default,
        deserialize_with = "crate::deserialize::deserialize_defaultable"
    )]
    pub features: Vec<compact_str::CompactString>,
    #[garde(custom(validate_docker_images))]
    pub docker_images: IndexMap<compact_str::CompactString, compact_str::CompactString>,
    #[garde(skip)]
    #[serde(
        default,
        deserialize_with = "crate::deserialize::deserialize_defaultable"
    )]
    pub file_denylist: Vec<compact_str::CompactString>,

    #[garde(skip)]
    #[schema(inline)]
    pub variables: Vec<super::nest_egg_variable::ExportedNestEggVariable>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct NestEgg {
    pub uuid: uuid::Uuid,
    pub nest: Fetchable<super::nest::Nest>,
    pub egg_repository_egg: Option<Fetchable<super::egg_repository_egg::EggRepositoryEgg>>,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,
    pub author: compact_str::CompactString,

    pub config_files: Vec<ProcessConfigurationFile>,
    pub config_startup: NestEggConfigStartup,
    pub config_stop: NestEggConfigStop,
    pub config_script: NestEggConfigScript,

    pub startup: compact_str::CompactString,
    pub force_outgoing_ip: bool,
    pub separate_port: bool,

    pub features: Vec<compact_str::CompactString>,
    pub docker_images: IndexMap<compact_str::CompactString, compact_str::CompactString>,
    pub file_denylist: Vec<compact_str::CompactString>,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for NestEgg {
    const NAME: &'static str = "nest_egg";

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
                "nest_eggs.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "nest_eggs.nest_uuid",
                compact_str::format_compact!("{prefix}nest_uuid"),
            ),
            (
                "nest_eggs.egg_repository_egg_uuid",
                compact_str::format_compact!("{prefix}egg_repository_egg_uuid"),
            ),
            (
                "nest_eggs.name",
                compact_str::format_compact!("{prefix}name"),
            ),
            (
                "nest_eggs.description",
                compact_str::format_compact!("{prefix}description"),
            ),
            (
                "nest_eggs.author",
                compact_str::format_compact!("{prefix}author"),
            ),
            (
                "nest_eggs.config_files",
                compact_str::format_compact!("{prefix}config_files"),
            ),
            (
                "nest_eggs.config_startup",
                compact_str::format_compact!("{prefix}config_startup"),
            ),
            (
                "nest_eggs.config_stop",
                compact_str::format_compact!("{prefix}config_stop"),
            ),
            (
                "nest_eggs.config_script",
                compact_str::format_compact!("{prefix}config_script"),
            ),
            (
                "nest_eggs.startup",
                compact_str::format_compact!("{prefix}startup"),
            ),
            (
                "nest_eggs.force_outgoing_ip",
                compact_str::format_compact!("{prefix}force_outgoing_ip"),
            ),
            (
                "nest_eggs.separate_port",
                compact_str::format_compact!("{prefix}separate_port"),
            ),
            (
                "nest_eggs.features",
                compact_str::format_compact!("{prefix}features"),
            ),
            (
                "nest_eggs.docker_images",
                compact_str::format_compact!("{prefix}docker_images"),
            ),
            (
                "nest_eggs.file_denylist",
                compact_str::format_compact!("{prefix}file_denylist"),
            ),
            (
                "nest_eggs.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ])
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            uuid: row.try_get(compact_str::format_compact!("{prefix}uuid").as_str())?,
            nest: super::nest::Nest::get_fetchable(
                row.try_get(compact_str::format_compact!("{prefix}nest_uuid").as_str())?,
            ),
            egg_repository_egg: row
                .try_get::<Option<uuid::Uuid>, _>(
                    compact_str::format_compact!("{prefix}egg_repository_egg_uuid").as_str(),
                )?
                .map(super::egg_repository_egg::EggRepositoryEgg::get_fetchable),
            name: row.try_get(compact_str::format_compact!("{prefix}name").as_str())?,
            description: row
                .try_get(compact_str::format_compact!("{prefix}description").as_str())?,
            author: row.try_get(compact_str::format_compact!("{prefix}author").as_str())?,
            config_files: serde_json::from_value(
                row.try_get(compact_str::format_compact!("{prefix}config_files").as_str())?,
            )?,
            config_startup: serde_json::from_value(
                row.try_get(compact_str::format_compact!("{prefix}config_startup").as_str())?,
            )?,
            config_stop: serde_json::from_value(
                row.try_get(compact_str::format_compact!("{prefix}config_stop").as_str())?,
            )?,
            config_script: serde_json::from_value(
                row.try_get(compact_str::format_compact!("{prefix}config_script").as_str())?,
            )?,
            startup: row.try_get(compact_str::format_compact!("{prefix}startup").as_str())?,
            force_outgoing_ip: row
                .try_get(compact_str::format_compact!("{prefix}force_outgoing_ip").as_str())?,
            separate_port: row
                .try_get(compact_str::format_compact!("{prefix}separate_port").as_str())?,
            features: row.try_get(compact_str::format_compact!("{prefix}features").as_str())?,
            docker_images: serde_json::from_value(
                row.try_get(compact_str::format_compact!("{prefix}docker_images").as_str())?,
            )?,
            file_denylist: row
                .try_get(compact_str::format_compact!("{prefix}file_denylist").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl NestEgg {
    pub async fn import(
        state: &crate::State,
        nest_uuid: uuid::Uuid,
        egg_repository_egg_uuid: Option<uuid::Uuid>,
        exported_egg: ExportedNestEgg,
    ) -> Result<Self, crate::database::DatabaseError> {
        let egg = Self::create(
            state,
            CreateNestEggOptions {
                nest_uuid,
                egg_repository_egg_uuid,
                author: exported_egg.author,
                name: exported_egg.name,
                description: exported_egg.description,
                config_files: exported_egg
                    .config
                    .files
                    .into_iter()
                    .map(|(file, config)| ProcessConfigurationFile {
                        file,
                        create_new: config.create_new,
                        parser: config.parser,
                        replace: config.replace,
                    })
                    .collect(),
                config_startup: exported_egg.config.startup,
                config_stop: exported_egg.config.stop,
                config_script: exported_egg.scripts.installation,
                startup: exported_egg.startup,
                force_outgoing_ip: exported_egg.force_outgoing_ip,
                separate_port: exported_egg.separate_port,
                features: exported_egg.features,
                docker_images: exported_egg.docker_images,
                file_denylist: exported_egg.file_denylist,
            },
        )
        .await?;

        for mut variable in exported_egg.variables {
            if rule_validator::validate_rules(&variable.rules, &()).is_err() {
                continue;
            }

            if variable.description.as_ref().is_some_and(|d| d.is_empty()) {
                variable.description = None;
            }

            if let Err(err) = super::nest_egg_variable::NestEggVariable::create(
                state,
                CreateNestEggVariableOptions {
                    egg_uuid: egg.uuid,
                    name: variable.name,
                    description: variable.description,
                    description_translations: variable.description_translations,
                    order: variable.order,
                    env_variable: variable.env_variable,
                    default_value: variable.default_value,
                    user_viewable: variable.user_viewable,
                    user_editable: variable.user_editable,
                    secret: variable.secret,
                    rules: variable.rules,
                },
            )
            .await
            {
                tracing::warn!("error while importing nest egg variable: {:?}", err);
            }
        }

        Ok(egg)
    }

    pub async fn import_update(
        &self,
        database: &crate::database::Database,
        mut exported_egg: ExportedNestEgg,
    ) -> Result<(), crate::database::DatabaseError> {
        sqlx::query!(
            "UPDATE nest_eggs
            SET
                author = $2, name = $3, description = $4,
                config_files = $5, config_startup = $6, config_stop = $7,
                config_script = $8, startup = $9,
                force_outgoing_ip = $10, separate_port = $11, features = $12,
                docker_images = $13::json, file_denylist = $14
            WHERE nest_eggs.uuid = $1",
            self.uuid,
            &exported_egg.author,
            &exported_egg.name,
            exported_egg.description.as_deref(),
            serde_json::to_value(
                &exported_egg
                    .config
                    .files
                    .into_iter()
                    .map(|(file, config)| ProcessConfigurationFile {
                        file,
                        create_new: config.create_new,
                        parser: config.parser,
                        replace: config.replace,
                    })
                    .collect::<Vec<_>>(),
            )?,
            serde_json::to_value(&exported_egg.config.startup)?,
            serde_json::to_value(&exported_egg.config.stop)?,
            serde_json::to_value(&exported_egg.scripts.installation)?,
            &exported_egg.startup,
            exported_egg.force_outgoing_ip,
            exported_egg.separate_port,
            &exported_egg
                .features
                .into_iter()
                .map(|f| f.into())
                .collect::<Vec<_>>(),
            serde_json::to_string(&exported_egg.docker_images)? as String,
            &exported_egg
                .file_denylist
                .into_iter()
                .map(|f| f.into())
                .collect::<Vec<_>>(),
        )
        .execute(database.write())
        .await?;

        let unused_variables = sqlx::query!(
            "SELECT nest_egg_variables.uuid
            FROM nest_egg_variables
            WHERE nest_egg_variables.egg_uuid = $1 AND nest_egg_variables.env_variable != ALL($2)",
            self.uuid,
            &exported_egg
                .variables
                .iter()
                .map(|v| v.env_variable.as_str())
                .collect::<Vec<_>>() as &[&str]
        )
        .fetch_all(database.read())
        .await?;

        for (i, variable) in exported_egg.variables.iter_mut().enumerate() {
            if rule_validator::validate_rules(&variable.rules, &()).is_err() {
                continue;
            }

            if variable.description.as_ref().is_some_and(|d| d.is_empty()) {
                variable.description = None;
            }

            if let Err(err) = sqlx::query!(
                "INSERT INTO nest_egg_variables (  
                    egg_uuid, name, description, description_translations, order_, env_variable,  
                    default_value, user_viewable, user_editable, rules  
                )  
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (egg_uuid, env_variable) DO UPDATE SET
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    description_translations = EXCLUDED.description_translations,
                    order_ = EXCLUDED.order_,
                    default_value = EXCLUDED.default_value,
                    user_viewable = EXCLUDED.user_viewable,
                    user_editable = EXCLUDED.user_editable,
                    rules = EXCLUDED.rules",
                self.uuid,
                &variable.name,
                variable.description.as_deref(),
                serde_json::to_value(&variable.description_translations)?,
                if variable.order == 0 {
                    i as i16 + 1
                } else {
                    variable.order
                },
                &variable.env_variable,
                variable.default_value.as_deref(),
                variable.user_viewable,
                variable.user_editable,
                &variable
                    .rules
                    .iter()
                    .map(|r| r.as_str())
                    .collect::<Vec<_>>() as &[&str]
            )
            .execute(database.read())
            .await
            {
                tracing::warn!("error while importing nest egg variable: {:?}", err);
            }
        }

        let order_base = exported_egg.variables.len() as i16
            + exported_egg
                .variables
                .iter()
                .map(|v| v.order)
                .max()
                .unwrap_or_default();

        sqlx::query!(
            "UPDATE nest_egg_variables
            SET order_ = $1 + array_position($2, nest_egg_variables.uuid)
            WHERE nest_egg_variables.uuid = ANY($2) AND nest_egg_variables.egg_uuid = $3",
            order_base as i32,
            &unused_variables
                .into_iter()
                .map(|v| v.uuid)
                .collect::<Vec<_>>(),
            self.uuid,
        )
        .execute(database.write())
        .await?;

        Ok(())
    }

    pub async fn all(
        database: &crate::database::Database,
    ) -> Result<Vec<Self>, crate::database::DatabaseError> {
        let rows = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM nest_eggs
            ORDER BY nest_eggs.created
            "#,
            Self::columns_sql(None)
        ))
        .fetch_all(database.read())
        .await?;

        rows.into_iter()
            .map(|row| Self::map(None, &row))
            .try_collect_vec()
    }

    pub async fn by_nest_uuid_with_pagination(
        database: &crate::database::Database,
        nest_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(&format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM nest_eggs
            WHERE nest_eggs.nest_uuid = $1 AND ($2 IS NULL OR nest_eggs.name ILIKE '%' || $2 || '%')
            ORDER BY nest_eggs.created
            LIMIT $3 OFFSET $4
            "#,
            Self::columns_sql(None)
        ))
        .bind(nest_uuid)
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

    pub async fn by_user_with_pagination(
        database: &crate::database::Database,
        user: &super::user::User,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(&format!(
            r#"
            SELECT *, COUNT(*) OVER() AS total_count
            FROM (
                SELECT DISTINCT ON (nest_eggs.uuid) {}
                FROM servers
                JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
                LEFT JOIN server_subusers ON server_subusers.server_uuid = servers.uuid AND server_subusers.user_uuid = $1
                JOIN nests ON nests.uuid = nest_eggs.nest_uuid
                WHERE (servers.owner_uuid = $1 OR server_subusers.user_uuid = $1 OR $2)
                    AND ($3 IS NULL OR nest_eggs.name ILIKE '%' || $3 || '%')
                ORDER BY nest_eggs.uuid
            ) AS eggs
            ORDER BY eggs.created
            LIMIT $4 OFFSET $5
            "#,
            Self::columns_sql(None)
        ))
        .bind(user.uuid)
        .bind(user.admin || user.role.as_ref().is_some_and(|r| r.admin_permissions.iter().any(|p| p == "servers.read")))
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

    pub async fn by_nest_uuid_uuid(
        database: &crate::database::Database,
        nest_uuid: uuid::Uuid,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM nest_eggs
            WHERE nest_eggs.nest_uuid = $1 AND nest_eggs.uuid = $2
            "#,
            Self::columns_sql(None)
        ))
        .bind(nest_uuid)
        .bind(uuid)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn by_nest_uuid_name(
        database: &crate::database::Database,
        nest_uuid: uuid::Uuid,
        name: &str,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM nest_eggs
            WHERE nest_eggs.nest_uuid = $1 AND nest_eggs.name = $2
            "#,
            Self::columns_sql(None)
        ))
        .bind(nest_uuid)
        .bind(name)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn count_by_nest_uuid(
        database: &crate::database::Database,
        nest_uuid: uuid::Uuid,
    ) -> i64 {
        sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM nest_eggs
            WHERE nest_eggs.nest_uuid = $1
            "#,
        )
        .bind(nest_uuid)
        .fetch_one(database.read())
        .await
        .unwrap_or(0)
    }

    pub async fn configuration(
        &self,
        database: &crate::database::Database,
    ) -> Result<super::egg_configuration::MergedEggConfiguration, anyhow::Error> {
        database
            .cache
            .cached(
                &format!("nest_egg::{}::configuration", self.uuid),
                10,
                || async {
                    super::egg_configuration::EggConfiguration::merged_by_egg_uuid(
                        database, self.uuid,
                    )
                    .await
                },
            )
            .await
    }

    #[inline]
    pub async fn into_exported(
        self,
        database: &crate::database::Database,
    ) -> Result<ExportedNestEgg, crate::database::DatabaseError> {
        Ok(ExportedNestEgg {
            uuid: self.uuid,
            author: self.author,
            name: self.name,
            description: self.description,
            config: ExportedNestEggConfigs {
                files: self
                    .config_files
                    .into_iter()
                    .map(|file| {
                        (
                            file.file,
                            ExportedNestEggConfigsFilesFile {
                                create_new: file.create_new,
                                parser: file.parser,
                                replace: file.replace,
                            },
                        )
                    })
                    .collect(),
                startup: self.config_startup,
                stop: self.config_stop,
            },
            scripts: ExportedNestEggScripts {
                installation: self.config_script,
            },
            startup: self.startup,
            force_outgoing_ip: self.force_outgoing_ip,
            separate_port: self.separate_port,
            features: self.features,
            docker_images: self.docker_images,
            file_denylist: self.file_denylist,
            variables: super::nest_egg_variable::NestEggVariable::all_by_egg_uuid(
                database, self.uuid,
            )
            .await?
            .into_iter()
            .map(|variable| variable.into_exported())
            .collect(),
        })
    }
}

#[async_trait::async_trait]
impl IntoAdminApiObject for NestEgg {
    type AdminApiObject = AdminApiNestEgg;
    type ExtraArgs<'a> = ();

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiNestEgg::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            AdminApiNestEgg {
                uuid: self.uuid,
                egg_repository_egg: match self.egg_repository_egg {
                    Some(egg_repository_egg) => Some(
                        egg_repository_egg
                            .fetch_cached(&state.database)
                            .await?
                            .into_admin_egg_api_object(state, ())
                            .await?,
                    ),
                    None => None,
                },
                name: self.name,
                description: self.description,
                author: self.author,
                config_files: self.config_files,
                config_startup: self.config_startup,
                config_stop: self.config_stop,
                config_script: self.config_script,
                startup: self.startup,
                force_outgoing_ip: self.force_outgoing_ip,
                separate_port: self.separate_port,
                features: self.features,
                docker_images: self.docker_images,
                file_denylist: self.file_denylist,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[async_trait::async_trait]
impl IntoApiObject for NestEgg {
    type ApiObject = ApiNestEgg;
    type ExtraArgs<'a> = ();

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::ApiObject, crate::database::DatabaseError> {
        let api_object = ApiNestEgg::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            ApiNestEgg {
                uuid: self.uuid,
                name: self.name,
                description: self.description,
                startup: self.startup,
                separate_port: self.separate_port,
                features: self.features,
                docker_images: self.docker_images,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[async_trait::async_trait]
impl ByUuid for NestEgg {
    async fn by_uuid(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
    ) -> Result<Self, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM nest_eggs
            WHERE nest_eggs.uuid = $1
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
pub struct CreateNestEggOptions {
    #[garde(skip)]
    pub nest_uuid: uuid::Uuid,
    #[garde(skip)]
    pub egg_repository_egg_uuid: Option<uuid::Uuid>,
    #[garde(length(chars, min = 2, max = 255))]
    #[schema(min_length = 2, max_length = 255)]
    pub author: compact_str::CompactString,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: compact_str::CompactString,
    #[garde(length(chars, min = 1, max = 1024))]
    #[schema(min_length = 1, max_length = 1024)]
    pub description: Option<compact_str::CompactString>,
    #[garde(skip)]
    #[schema(inline)]
    pub config_files: Vec<ProcessConfigurationFile>,
    #[garde(skip)]
    #[schema(inline)]
    pub config_startup: NestEggConfigStartup,
    #[garde(skip)]
    #[schema(inline)]
    pub config_stop: NestEggConfigStop,
    #[garde(skip)]
    #[schema(inline)]
    pub config_script: NestEggConfigScript,
    #[garde(length(chars, min = 1, max = 4096))]
    #[schema(min_length = 1, max_length = 4096)]
    pub startup: compact_str::CompactString,
    #[garde(skip)]
    pub force_outgoing_ip: bool,
    #[garde(skip)]
    pub separate_port: bool,
    #[garde(skip)]
    pub features: Vec<compact_str::CompactString>,
    #[garde(custom(validate_docker_images))]
    pub docker_images: IndexMap<compact_str::CompactString, compact_str::CompactString>,
    #[garde(skip)]
    pub file_denylist: Vec<compact_str::CompactString>,
}

#[async_trait::async_trait]
impl CreatableModel for NestEgg {
    type CreateOptions<'a> = CreateNestEggOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<NestEgg>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        if let Some(egg_repository_egg_uuid) = options.egg_repository_egg_uuid {
            super::egg_repository_egg::EggRepositoryEgg::by_uuid_optional_cached(
                &state.database,
                egg_repository_egg_uuid,
            )
            .await?
            .ok_or(crate::database::InvalidRelationError("egg_repository_egg"))?;
        }

        let mut transaction = state.database.write().begin().await?;

        let mut query_builder = InsertQueryBuilder::new("nest_eggs");

        Self::run_create_handlers(&mut options, &mut query_builder, state, &mut transaction)
            .await?;

        query_builder
            .set("nest_uuid", options.nest_uuid)
            .set("egg_repository_egg_uuid", options.egg_repository_egg_uuid)
            .set("author", &options.author)
            .set("name", &options.name)
            .set("description", &options.description)
            .set("config_files", serde_json::to_value(&options.config_files)?)
            .set(
                "config_startup",
                serde_json::to_value(&options.config_startup)?,
            )
            .set("config_stop", serde_json::to_value(&options.config_stop)?)
            .set(
                "config_script",
                serde_json::to_value(&options.config_script)?,
            )
            .set("startup", &options.startup)
            .set("force_outgoing_ip", options.force_outgoing_ip)
            .set("separate_port", options.separate_port)
            .set("features", &options.features)
            .set("docker_images", OrderedJson(&options.docker_images))
            .set("file_denylist", &options.file_denylist);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut *transaction)
            .await?;
        let nest_egg = Self::map(None, &row)?;

        transaction.commit().await?;

        Ok(nest_egg)
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Clone, Default)]
pub struct UpdateNestEggOptions {
    #[garde(skip)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub egg_repository_egg_uuid: Option<Option<uuid::Uuid>>,
    #[garde(length(chars, min = 2, max = 255))]
    #[schema(min_length = 2, max_length = 255)]
    pub author: Option<compact_str::CompactString>,
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
    #[garde(skip)]
    #[schema(inline)]
    pub config_files: Option<Vec<ProcessConfigurationFile>>,
    #[garde(skip)]
    #[schema(inline)]
    pub config_startup: Option<NestEggConfigStartup>,
    #[garde(skip)]
    #[schema(inline)]
    pub config_stop: Option<NestEggConfigStop>,
    #[garde(skip)]
    #[schema(inline)]
    pub config_script: Option<NestEggConfigScript>,
    #[garde(length(chars, min = 1, max = 4096))]
    #[schema(min_length = 1, max_length = 4096)]
    pub startup: Option<compact_str::CompactString>,
    #[garde(skip)]
    pub force_outgoing_ip: Option<bool>,
    #[garde(skip)]
    pub separate_port: Option<bool>,
    #[garde(skip)]
    pub features: Option<Vec<compact_str::CompactString>>,
    #[garde(inner(custom(validate_docker_images)))]
    pub docker_images: Option<IndexMap<compact_str::CompactString, compact_str::CompactString>>,
    #[garde(skip)]
    pub file_denylist: Option<Vec<compact_str::CompactString>>,
}

#[async_trait::async_trait]
impl UpdatableModel for NestEgg {
    type UpdateOptions = UpdateNestEggOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateListenerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateListenerList<NestEgg>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &UPDATE_LISTENERS
    }

    async fn update(
        &mut self,
        state: &crate::State,
        mut options: Self::UpdateOptions,
    ) -> Result<(), crate::database::DatabaseError> {
        options.validate()?;

        let egg_repository_egg =
            if let Some(egg_repository_egg_uuid) = &options.egg_repository_egg_uuid {
                match egg_repository_egg_uuid {
                    Some(uuid) => {
                        super::egg_repository_egg::EggRepositoryEgg::by_uuid_optional_cached(
                            &state.database,
                            *uuid,
                        )
                        .await?
                        .ok_or(crate::database::InvalidRelationError("egg_repository_egg"))?;
                        Some(Some(
                            super::egg_repository_egg::EggRepositoryEgg::get_fetchable(*uuid),
                        ))
                    }
                    None => Some(None),
                }
            } else {
                None
            };

        let mut transaction = state.database.write().begin().await?;

        let mut query_builder = UpdateQueryBuilder::new("nest_eggs");

        Self::run_update_handlers(
            self,
            &mut options,
            &mut query_builder,
            state,
            &mut transaction,
        )
        .await?;

        query_builder
            .set(
                "egg_repository_egg_uuid",
                options.egg_repository_egg_uuid.as_ref().map(|o| o.as_ref()),
            )
            .set("author", options.author.as_ref())
            .set("name", options.name.as_ref())
            .set(
                "description",
                options.description.as_ref().map(|d| d.as_ref()),
            )
            .set(
                "config_files",
                options
                    .config_files
                    .as_ref()
                    .map(serde_json::to_value)
                    .transpose()?,
            )
            .set(
                "config_startup",
                options
                    .config_startup
                    .as_ref()
                    .map(serde_json::to_value)
                    .transpose()?,
            )
            .set(
                "config_stop",
                options
                    .config_stop
                    .as_ref()
                    .map(serde_json::to_value)
                    .transpose()?,
            )
            .set(
                "config_script",
                options
                    .config_script
                    .as_ref()
                    .map(serde_json::to_value)
                    .transpose()?,
            )
            .set("startup", options.startup.as_ref())
            .set("force_outgoing_ip", options.force_outgoing_ip)
            .set("separate_port", options.separate_port)
            .set("features", options.features.as_ref())
            .set(
                "docker_images",
                options.docker_images.as_ref().map(OrderedJson),
            )
            .set("file_denylist", options.file_denylist.as_ref())
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut *transaction).await?;

        if let Some(egg_repository_egg) = egg_repository_egg {
            self.egg_repository_egg = egg_repository_egg;
        }
        if let Some(author) = options.author {
            self.author = author;
        }
        if let Some(name) = options.name {
            self.name = name;
        }
        if let Some(description) = options.description {
            self.description = description;
        }
        if let Some(config_files) = options.config_files {
            self.config_files = config_files;
        }
        if let Some(config_startup) = options.config_startup {
            self.config_startup = config_startup;
        }
        if let Some(config_stop) = options.config_stop {
            self.config_stop = config_stop;
        }
        if let Some(config_script) = options.config_script {
            self.config_script = config_script;
        }
        if let Some(startup) = options.startup {
            self.startup = startup;
        }
        if let Some(force_outgoing_ip) = options.force_outgoing_ip {
            self.force_outgoing_ip = force_outgoing_ip;
        }
        if let Some(separate_port) = options.separate_port {
            self.separate_port = separate_port;
        }
        if let Some(features) = options.features {
            self.features = features;
        }
        if let Some(docker_images) = options.docker_images {
            self.docker_images = docker_images;
        }
        if let Some(file_denylist) = options.file_denylist {
            self.file_denylist = file_denylist;
        }

        transaction.commit().await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl DeletableModel for NestEgg {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteListenerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteListenerList<NestEgg>> =
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
            DELETE FROM nest_eggs
            WHERE nest_eggs.uuid = $1
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
#[init_args(NestEgg, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "AdminNestEgg")]
pub struct AdminApiNestEgg {
    pub uuid: uuid::Uuid,
    pub egg_repository_egg: Option<super::egg_repository_egg::AdminApiEggEggRepositoryEgg>,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,
    pub author: compact_str::CompactString,

    #[schema(inline)]
    pub config_files: Vec<ProcessConfigurationFile>,
    #[schema(inline)]
    pub config_startup: NestEggConfigStartup,
    #[schema(inline)]
    pub config_stop: NestEggConfigStop,
    #[schema(inline)]
    pub config_script: NestEggConfigScript,

    pub startup: compact_str::CompactString,
    pub force_outgoing_ip: bool,
    pub separate_port: bool,

    pub features: Vec<compact_str::CompactString>,
    pub docker_images: IndexMap<compact_str::CompactString, compact_str::CompactString>,
    pub file_denylist: Vec<compact_str::CompactString>,

    pub created: chrono::DateTime<chrono::Utc>,
}

#[schema_extension_derive::extendible]
#[init_args(NestEgg, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "NestEgg")]
pub struct ApiNestEgg {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,

    pub startup: compact_str::CompactString,
    pub separate_port: bool,

    pub features: Vec<compact_str::CompactString>,
    pub docker_images: IndexMap<compact_str::CompactString, compact_str::CompactString>,

    pub created: chrono::DateTime<chrono::Utc>,
}
