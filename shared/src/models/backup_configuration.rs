use crate::{
    models::{InsertQueryBuilder, UpdateQueryBuilder},
    prelude::*,
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

    pub fn into_client(self) -> Result<Box<s3::Bucket>, s3::error::S3Error> {
        let mut bucket = s3::Bucket::new(
            &self.bucket,
            s3::Region::Custom {
                region: self.region.into(),
                endpoint: self.endpoint.into(),
            },
            s3::creds::Credentials::new(
                Some(&self.access_key),
                Some(&self.secret_key),
                None,
                None,
                None,
            )
            .unwrap(),
        )?;

        if self.path_style {
            bucket.set_path_style();
        }

        Ok(bucket)
    }
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
}

#[derive(ToSchema, Serialize, Deserialize, Default, Validate, Clone)]
pub struct BackupConfigs {
    #[garde(dive)]
    pub s3: Option<BackupConfigsS3>,
    #[garde(dive)]
    pub restic: Option<BackupConfigsRestic>,
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

        Ok(())
    }

    pub fn censor(&mut self) {
        if let Some(s3) = &mut self.s3 {
            s3.censor();
        }
        if let Some(restic) = &mut self.restic {
            restic.censor();
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct BackupConfiguration {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,

    pub maintenance_enabled: bool,

    pub backup_disk: super::server_backup::BackupDisk,
    pub backup_configs: BackupConfigs,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for BackupConfiguration {
    const NAME: &'static str = "backup_configuration";

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

        let rows = sqlx::query(&format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM backup_configurations
            WHERE $1 IS NULL OR backup_configurations.name ILIKE '%' || $1 || '%'
            ORDER BY backup_configurations.created
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
                maintenance_enabled: self.maintenance_enabled,
                description: self.description,
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
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM backup_configurations
            WHERE backup_configurations.uuid = $1
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

    async fn create(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        let mut transaction = state.database.write().begin().await?;

        let mut query_builder = InsertQueryBuilder::new("backup_configurations");

        Self::run_create_handlers(&mut options, &mut query_builder, state, &mut transaction)
            .await?;

        options.backup_configs.encrypt(&state.database).await?;

        query_builder
            .set("name", &options.name)
            .set("description", &options.description)
            .set("maintenance_enabled", options.maintenance_enabled)
            .set("backup_disk", options.backup_disk)
            .set(
                "backup_configs",
                serde_json::to_value(&options.backup_configs)?,
            );

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut *transaction)
            .await?;
        let backup_configuration = Self::map(None, &row)?;

        transaction.commit().await?;

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
    pub backup_disk: Option<super::server_backup::BackupDisk>,
    #[garde(dive)]
    pub backup_configs: Option<BackupConfigs>,
}

#[async_trait::async_trait]
impl UpdatableModel for BackupConfiguration {
    type UpdateOptions = UpdateBackupConfigurationOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateListenerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateListenerList<BackupConfiguration>> =
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

        let mut query_builder = UpdateQueryBuilder::new("backup_configurations");

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
            .set("maintenance_enabled", options.maintenance_enabled)
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

        query_builder.execute(&mut *transaction).await?;

        if let Some(name) = options.name {
            self.name = name;
        }
        if let Some(description) = options.description {
            self.description = description;
        }
        if let Some(maintenance_enabled) = options.maintenance_enabled {
            self.maintenance_enabled = maintenance_enabled;
        }
        if let Some(backup_disk) = options.backup_disk {
            self.backup_disk = backup_disk;
        }
        if let Some(backup_configs) = options.backup_configs {
            self.backup_configs = backup_configs;
        }

        transaction.commit().await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl DeletableModel for BackupConfiguration {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteListenerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteListenerList<BackupConfiguration>> =
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
            DELETE FROM backup_configurations
            WHERE backup_configurations.uuid = $1
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
#[init_args(BackupConfiguration, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "BackupConfiguration")]
pub struct AdminApiBackupConfiguration {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub maintenance_enabled: bool,
    pub description: Option<compact_str::CompactString>,

    pub backup_disk: super::server_backup::BackupDisk,
    pub backup_configs: BackupConfigs,

    pub created: chrono::DateTime<chrono::Utc>,
}
