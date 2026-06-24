use crate::{
    models::{InsertQueryBuilder, UpdateQueryBuilder},
    prelude::*,
};
use aws_sdk_s3::{
    Client as S3Client,
    config::{
        BehaviorVersion, Config as S3Config, Credentials, Region, retry::RetryConfig,
        timeout::TimeoutConfig,
    },
};
use garde::Validate;
use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{
    collections::BTreeMap,
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

fn default_compression_type() -> wings_api::CompressionType {
    wings_api::CompressionType::Gz
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Clone)]
pub struct BackupConfigsS3 {
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub access_key: compact_str::CompactString,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub secret_key: compact_str::CompactString,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub bucket: compact_str::CompactString,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub region: compact_str::CompactString,
    #[garde(length(chars, min = 1, max = 255), url)]
    #[schema(min_length = 1, max_length = 255, format = "uri")]
    pub endpoint: compact_str::CompactString,
    #[garde(skip)]
    pub path_style: bool,
    #[garde(skip)]
    #[serde(default = "default_compression_type")]
    pub compression_type: wings_api::CompressionType,
    #[garde(skip)]
    pub part_size: u64,
}

impl BackupConfigsS3 {
    pub async fn encrypt(
        &mut self,
        database: &crate::database::Database,
    ) -> Result<(), anyhow::Error> {
        self.secret_key = base32::encode(
            base32::Alphabet::Z,
            &database.encrypt(self.secret_key.clone()).await?,
        )
        .into();

        Ok(())
    }

    pub async fn decrypt(
        &mut self,
        database: &crate::database::Database,
    ) -> Result<(), anyhow::Error> {
        if let Some(decoded) = base32::decode(base32::Alphabet::Z, &self.secret_key) {
            self.secret_key = database.decrypt(decoded).await?;
        }

        Ok(())
    }

    pub fn censor(&mut self) {
        self.secret_key = "".into();
    }

    pub fn into_client(self) -> (S3Client, compact_str::CompactString) {
        let credentials = Credentials::new(
            self.access_key,
            self.secret_key,
            None,
            None,
            "calagopus-static",
        );

        let timeout_config = TimeoutConfig::builder()
            .connect_timeout(std::time::Duration::from_secs(10))
            .build();

        let config = S3Config::builder()
            .behavior_version(BehaviorVersion::latest())
            .credentials_provider(credentials)
            .region(Region::new(self.region.to_string()))
            .endpoint_url(self.endpoint)
            .force_path_style(self.path_style)
            .timeout_config(timeout_config)
            .retry_config(RetryConfig::standard())
            .build();

        (S3Client::from_conf(config), self.bucket)
    }
}

#[derive(ToSchema, Serialize, Deserialize, Clone)]
pub struct BackupConfigsResticPruneJob {
    #[schema(value_type = String, example = "0 0 0 * * *")]
    pub cron: cron::Schedule,
    pub nodes: Vec<uuid::Uuid>,
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Clone)]
pub struct BackupConfigsRestic {
    #[garde(length(chars, min = 3, max = 255))]
    #[schema(min_length = 3, max_length = 255)]
    pub repository: compact_str::CompactString,
    #[garde(skip)]
    pub retry_lock_seconds: u64,

    #[garde(skip)]
    pub environment: IndexMap<compact_str::CompactString, compact_str::CompactString>,
    #[garde(length(max = 50))]
    #[schema(inline, max_items = 50)]
    #[serde(default)]
    pub prune_jobs: Vec<BackupConfigsResticPruneJob>,
}

impl BackupConfigsRestic {
    pub async fn encrypt(
        &mut self,
        database: &crate::database::Database,
    ) -> Result<(), anyhow::Error> {
        for value in self.environment.values_mut() {
            *value =
                base32::encode(base32::Alphabet::Z, &database.encrypt(value.clone()).await?).into();
        }

        Ok(())
    }

    pub async fn decrypt(
        &mut self,
        database: &crate::database::Database,
    ) -> Result<(), anyhow::Error> {
        for value in self.environment.values_mut() {
            if let Some(decoded) = base32::decode(base32::Alphabet::Z, value) {
                *value = database.decrypt(decoded).await?;
            }
        }

        Ok(())
    }

    pub fn censor(&mut self) {
        for (key, value) in self.environment.iter_mut() {
            if key == "RESTIC_PASSWORD" || key == "AWS_SECRET_ACCESS_KEY" {
                *value = "".into();
            }
        }
    }

    pub fn into_wings_configuration(self) -> wings_api::ResticBackupConfiguration {
        wings_api::ResticBackupConfiguration {
            repository: self.repository,
            password_file: None,
            retry_lock_seconds: self.retry_lock_seconds,
            environment: self.environment,
        }
    }
}

fn validate_fingerprint(
    fingerprint: &compact_str::CompactString,
    _context: &(),
) -> Result<(), garde::Error> {
    let normalized = normalize_pbs_fingerprint(fingerprint);

    if normalized.len() != 64 || !normalized.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err(garde::Error::new(
            "fingerprint must be a SHA-256 hash (64 hex characters, colons optional)",
        ));
    }

    Ok(())
}

pub fn normalize_pbs_fingerprint(fingerprint: &str) -> compact_str::CompactString {
    fingerprint
        .chars()
        .filter(|c| !c.is_whitespace() && *c != ':')
        .map(|c| c.to_ascii_lowercase())
        .collect()
}

fn validate_pbs_token_id(
    token_id: &compact_str::CompactString,
    _context: &(),
) -> Result<(), garde::Error> {
    static TOKEN_ID_REGEX: std::sync::LazyLock<regex::Regex> = std::sync::LazyLock::new(|| {
        regex::Regex::new(r"^[^\s:/!@]+@[A-Za-z][A-Za-z0-9._-]*![A-Za-z0-9._-]+$").unwrap()
    });

    if !TOKEN_ID_REGEX.is_match(token_id) {
        return Err(garde::Error::new(
            "token id must be in the form user@realm!token-name",
        ));
    }

    Ok(())
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Clone)]
pub struct BackupConfigsPbs {
    #[garde(length(chars, min = 1, max = 255), url)]
    #[schema(min_length = 1, max_length = 255, format = "uri")]
    pub url: compact_str::CompactString,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub datastore: compact_str::CompactString,
    #[garde(inner(length(chars, min = 1, max = 255)))]
    #[schema(min_length = 1, max_length = 255)]
    pub namespace: Option<compact_str::CompactString>,
    #[garde(length(chars, min = 1, max = 255), custom(validate_pbs_token_id))]
    #[schema(min_length = 1, max_length = 255)]
    pub token_id: compact_str::CompactString,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub token_secret: compact_str::CompactString,
    #[garde(custom(validate_fingerprint))]
    #[schema(min_length = 64, max_length = 95)]
    pub fingerprint: compact_str::CompactString,
    #[garde(inner(length(chars, min = 1, max = 255)))]
    #[schema(min_length = 1, max_length = 255)]
    pub backup_id_prefix: Option<compact_str::CompactString>,
}

impl BackupConfigsPbs {
    pub async fn encrypt(
        &mut self,
        database: &crate::database::Database,
    ) -> Result<(), anyhow::Error> {
        self.token_secret = base32::encode(
            base32::Alphabet::Z,
            &database.encrypt(self.token_secret.clone()).await?,
        )
        .into();

        Ok(())
    }

    pub async fn decrypt(
        &mut self,
        database: &crate::database::Database,
    ) -> Result<(), anyhow::Error> {
        if let Some(decoded) = base32::decode(base32::Alphabet::Z, &self.token_secret) {
            self.token_secret = database.decrypt(decoded).await?;
        }

        Ok(())
    }

    pub fn censor(&mut self) {
        self.token_secret = "".into();
    }
}

fn validate_kopia_username(
    username: &compact_str::CompactString,
    _context: &(),
) -> Result<(), garde::Error> {
    static KOPIA_USERNAME_REGEX: std::sync::LazyLock<regex::Regex> =
        std::sync::LazyLock::new(|| {
            regex::Regex::new(r"^[a-z0-9][a-z0-9._-]*@[a-z0-9][a-z0-9._-]*$").unwrap()
        });

    if !KOPIA_USERNAME_REGEX.is_match(username) {
        return Err(garde::Error::new("username must be in the form user@host"));
    }

    Ok(())
}

fn validate_kopia_tags(
    tags: &IndexMap<compact_str::CompactString, compact_str::CompactString>,
    _context: &(),
) -> Result<(), garde::Error> {
    if tags.len() > 50 {
        return Err(garde::Error::new("cannot have more than 50 tags"));
    }

    for (key, value) in tags.iter() {
        if key.is_empty() || key.len() > 255 {
            return Err(garde::Error::new(
                "tag keys must be between 1 and 255 characters",
            ));
        }
        if value.is_empty() || value.len() > 255 {
            return Err(garde::Error::new(
                "tag values must be between 1 and 255 characters",
            ));
        }
    }

    Ok(())
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Clone)]
pub struct BackupConfigKopia {
    #[garde(length(chars, min = 1, max = 255), url)]
    #[schema(min_length = 1, max_length = 255, format = "uri")]
    pub url: compact_str::CompactString,
    #[garde(length(chars, min = 1, max = 255), custom(validate_kopia_username))]
    #[schema(min_length = 1, max_length = 255)]
    pub username: compact_str::CompactString,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub password: compact_str::CompactString,
    #[garde(custom(validate_fingerprint))]
    #[schema(min_length = 64, max_length = 95)]
    pub fingerprint: compact_str::CompactString,
    #[garde(custom(validate_kopia_tags))]
    pub tags: IndexMap<compact_str::CompactString, compact_str::CompactString>,
}

impl BackupConfigKopia {
    pub async fn encrypt(
        &mut self,
        database: &crate::database::Database,
    ) -> Result<(), anyhow::Error> {
        self.password = base32::encode(
            base32::Alphabet::Z,
            &database.encrypt(self.password.clone()).await?,
        )
        .into();

        Ok(())
    }

    pub async fn decrypt(
        &mut self,
        database: &crate::database::Database,
    ) -> Result<(), anyhow::Error> {
        if let Some(decoded) = base32::decode(base32::Alphabet::Z, &self.password) {
            self.password = database.decrypt(decoded).await?;
        }

        Ok(())
    }

    pub fn censor(&mut self) {
        self.password = "".into();
    }
}

#[derive(ToSchema, Serialize, Deserialize, Default, Validate, Clone)]
pub struct BackupConfigs {
    #[garde(dive)]
    pub s3: Option<BackupConfigsS3>,
    #[garde(dive)]
    pub restic: Option<BackupConfigsRestic>,
    #[garde(dive)]
    pub pbs: Option<BackupConfigsPbs>,
    #[garde(dive)]
    pub kopia: Option<BackupConfigKopia>,
}

impl BackupConfigs {
    pub async fn encrypt(
        &mut self,
        database: &crate::database::Database,
    ) -> Result<(), anyhow::Error> {
        if let Some(s3) = &mut self.s3 {
            s3.encrypt(database).await?;
        }
        if let Some(restic) = &mut self.restic {
            restic.encrypt(database).await?;
        }
        if let Some(pbs) = &mut self.pbs {
            pbs.encrypt(database).await?;
        }
        if let Some(kopia) = &mut self.kopia {
            kopia.encrypt(database).await?;
        }

        Ok(())
    }

    pub async fn decrypt(
        &mut self,
        database: &crate::database::Database,
    ) -> Result<(), anyhow::Error> {
        if let Some(s3) = &mut self.s3 {
            s3.decrypt(database).await?;
        }
        if let Some(restic) = &mut self.restic {
            restic.decrypt(database).await?;
        }
        if let Some(pbs) = &mut self.pbs {
            pbs.decrypt(database).await?;
        }
        if let Some(kopia) = &mut self.kopia {
            kopia.decrypt(database).await?;
        }

        Ok(())
    }

    pub fn censor(&mut self) {
        if let Some(s3) = &mut self.s3 {
            s3.censor();
        }
        if let Some(restic) = &mut self.restic {
            restic.censor();
        }
        if let Some(pbs) = &mut self.pbs {
            pbs.censor();
        }
        if let Some(kopia) = &mut self.kopia {
            kopia.censor();
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct BackupConfiguration {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,

    pub maintenance_enabled: bool,
    pub shared: bool,

    pub backup_disk: super::server_backup::BackupDisk,
    pub backup_configs: BackupConfigs,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for BackupConfiguration {
    const NAME: &'static str = "backup_configuration";

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
                "backup_configurations.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "backup_configurations.name",
                compact_str::format_compact!("{prefix}name"),
            ),
            (
                "backup_configurations.description",
                compact_str::format_compact!("{prefix}description"),
            ),
            (
                "backup_configurations.maintenance_enabled",
                compact_str::format_compact!("{prefix}maintenance_enabled"),
            ),
            (
                "backup_configurations.shared",
                compact_str::format_compact!("{prefix}shared"),
            ),
            (
                "backup_configurations.backup_disk",
                compact_str::format_compact!("{prefix}backup_disk"),
            ),
            (
                "backup_configurations.backup_configs",
                compact_str::format_compact!("{prefix}backup_configs"),
            ),
            (
                "backup_configurations.created",
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
            maintenance_enabled: row
                .try_get(compact_str::format_compact!("{prefix}maintenance_enabled").as_str())?,
            shared: row.try_get(compact_str::format_compact!("{prefix}shared").as_str())?,
            backup_disk: row
                .try_get(compact_str::format_compact!("{prefix}backup_disk").as_str())?,
            backup_configs: serde_json::from_value(
                row.get(compact_str::format_compact!("{prefix}backup_configs").as_str()),
            )
            .unwrap_or_default(),
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl BackupConfiguration {
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
            FROM backup_configurations
            WHERE $1 IS NULL OR backup_configurations.name ILIKE '%' || $1 || '%'
            ORDER BY backup_configurations.created
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

    pub async fn cleanup_uuid_arrays(
        database: &crate::database::Database,
    ) -> Result<u64, crate::database::DatabaseError> {
        let result = sqlx::query(
            "UPDATE backup_configurations
            SET backup_configs = jsonb_set(
                backup_configs,
                '{restic,prune_jobs}',
                (
                    SELECT COALESCE(jsonb_agg(
                        jsonb_set(
                            job,
                            '{nodes}',
                            COALESCE(
                                (
                                    SELECT jsonb_agg(node)
                                    FROM jsonb_array_elements_text(job->'nodes') AS node
                                    WHERE EXISTS (SELECT 1 FROM nodes WHERE uuid = node::uuid)
                                ),
                                '[]'::jsonb
                            )
                        )
                    ), '[]'::jsonb)
                    FROM jsonb_array_elements(backup_configs->'restic'->'prune_jobs') AS job
                )
            )
            WHERE jsonb_typeof(backup_configs->'restic'->'prune_jobs') = 'array'
            AND EXISTS (
                SELECT 1
                FROM jsonb_array_elements(backup_configs->'restic'->'prune_jobs') AS job,
                     jsonb_array_elements_text(job->'nodes') AS node
                WHERE NOT EXISTS (SELECT 1 FROM nodes WHERE uuid = node::uuid)
            )",
        )
        .execute(database.write())
        .await?;

        Ok(result.rows_affected())
    }
}

#[async_trait::async_trait]
impl IntoAdminApiObject for BackupConfiguration {
    type AdminApiObject = AdminApiBackupConfiguration;
    type ExtraArgs<'a> = ();

    async fn into_admin_api_object<'a>(
        mut self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiBackupConfiguration::init_hooks(&self, state).await?;

        self.backup_configs.decrypt(&state.database).await?;

        let api_object = finish_extendible!(
            AdminApiBackupConfiguration {
                uuid: self.uuid,
                name: self.name,
                description: self.description,
                maintenance_enabled: self.maintenance_enabled,
                shared: self.shared,
                backup_disk: self.backup_disk,
                backup_configs: self.backup_configs,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[async_trait::async_trait]
impl ByUuid for BackupConfiguration {
    async fn by_uuid(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
    ) -> Result<Self, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM backup_configurations
            WHERE backup_configurations.uuid = $1
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
            FROM backup_configurations
            WHERE backup_configurations.uuid = $1
            "#,
            Self::columns_sql(None)
        )))
        .bind(uuid)
        .fetch_one(&mut **transaction)
        .await?;

        Self::map(None, &row)
    }
}

#[derive(ToSchema, Deserialize, Validate)]
pub struct CreateBackupConfigurationOptions {
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: compact_str::CompactString,
    #[garde(length(chars, min = 1, max = 1024))]
    #[schema(min_length = 1, max_length = 1024)]
    pub description: Option<compact_str::CompactString>,
    #[garde(skip)]
    pub maintenance_enabled: bool,
    #[garde(skip)]
    pub shared: bool,
    #[garde(skip)]
    pub backup_disk: super::server_backup::BackupDisk,
    #[garde(dive)]
    pub backup_configs: BackupConfigs,
}

#[async_trait::async_trait]
impl CreatableModel for BackupConfiguration {
    type CreateOptions<'a> = CreateBackupConfigurationOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<BackupConfiguration>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create_with_transaction(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        let mut query_builder = InsertQueryBuilder::new("backup_configurations");

        Self::run_create_handlers(&mut options, &mut query_builder, state, transaction).await?;

        options.backup_configs.encrypt(&state.database).await?;

        query_builder
            .set("name", &options.name)
            .set("description", &options.description)
            .set("maintenance_enabled", options.maintenance_enabled)
            .set("shared", options.shared)
            .set("backup_disk", options.backup_disk)
            .set(
                "backup_configs",
                serde_json::to_value(&options.backup_configs)?,
            );

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut **transaction)
            .await?;
        let mut backup_configuration = Self::map(None, &row)?;

        Self::run_after_create_handlers(&mut backup_configuration, &options, state, transaction)
            .await?;

        Ok(backup_configuration)
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Clone, Default)]
pub struct UpdateBackupConfigurationOptions {
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
    pub maintenance_enabled: Option<bool>,
    #[garde(skip)]
    pub shared: Option<bool>,
    #[garde(skip)]
    pub backup_disk: Option<super::server_backup::BackupDisk>,
    #[garde(dive)]
    pub backup_configs: Option<BackupConfigs>,
}

#[async_trait::async_trait]
impl UpdatableModel for BackupConfiguration {
    type UpdateOptions = UpdateBackupConfigurationOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateHandlerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateHandlerList<BackupConfiguration>> =
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

        let mut query_builder = UpdateQueryBuilder::new("backup_configurations");

        self.run_update_handlers(&mut options, &mut query_builder, state, transaction)
            .await?;

        query_builder
            .set("name", options.name.as_ref())
            .set(
                "description",
                options.description.as_ref().map(|d| d.as_ref()),
            )
            .set("maintenance_enabled", options.maintenance_enabled)
            .set("shared", options.shared)
            .set("backup_disk", options.backup_disk)
            .set(
                "backup_configs",
                if let Some(backup_configs) = &mut options.backup_configs {
                    backup_configs.encrypt(&state.database).await?;

                    Some(serde_json::to_value(backup_configs)?)
                } else {
                    None
                },
            )
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut **transaction).await?;

        if let Some(name) = options.name {
            self.name = name;
        }
        if let Some(description) = options.description {
            self.description = description;
        }
        if let Some(maintenance_enabled) = options.maintenance_enabled {
            self.maintenance_enabled = maintenance_enabled;
        }
        if let Some(shared) = options.shared {
            self.shared = shared;
        }
        if let Some(backup_disk) = options.backup_disk {
            self.backup_disk = backup_disk;
        }
        if let Some(backup_configs) = options.backup_configs {
            self.backup_configs = backup_configs;
        }

        self.run_after_update_handlers(state, transaction).await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl DeletableModel for BackupConfiguration {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteHandlerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteHandlerList<BackupConfiguration>> =
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
            DELETE FROM backup_configurations
            WHERE backup_configurations.uuid = $1
            "#,
        )
        .bind(self.uuid)
        .execute(&mut **transaction)
        .await?;

        self.run_after_delete_handlers(&options, state, transaction)
            .await?;

        Ok(())
    }
}

#[schema_extension_derive::extendible]
#[init_args(BackupConfiguration, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "BackupConfiguration")]
pub struct AdminApiBackupConfiguration {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,

    pub maintenance_enabled: bool,
    pub shared: bool,

    pub backup_disk: super::server_backup::BackupDisk,
    pub backup_configs: BackupConfigs,

    pub created: chrono::DateTime<chrono::Utc>,
}
