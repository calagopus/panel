use crate::{
    censor::{CENSORED_PLACEHOLDER, Censor},
    models::{InsertQueryBuilder, UpdateQueryBuilder},
    prelude::*,
};
use compact_str::ToCompactString;
use futures_util::StreamExt;
use garde::Validate;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{
    collections::BTreeMap,
    path::PathBuf,
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

fn validate_git_repository(
    git_repository: &compact_str::CompactString,
    _context: &(),
) -> Result<(), garde::Error> {
    let url = match gix::url::parse(git_repository.as_str()) {
        Ok(url) => url,
        Err(err) => return Err(garde::Error::new(format!("Invalid git repository: {err}"))),
    };

    match url.scheme {
        gix::url::Scheme::Http | gix::url::Scheme::Https | gix::url::Scheme::Ssh => {}
        _ => {
            return Err(garde::Error::new(
                "Invalid git repository: only http, https and ssh urls are supported, scp-style urls have to be written as ssh://user@host/path",
            ));
        }
    }

    if url.host().is_none() {
        return Err(garde::Error::new("Invalid git repository: missing host"));
    }

    Ok(())
}

#[derive(ToSchema, Validate, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum EggRepositoryCredentials {
    None,
    Password {
        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        username: compact_str::CompactString,
        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        password: compact_str::CompactString,
    },
    PrivateKey {
        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        username: compact_str::CompactString,
        #[garde(
            length(chars, min = 1, max = 16384),
            custom(crate::git::validate_private_key)
        )]
        #[schema(min_length = 1, max_length = 16384)]
        private_key: String,
        #[garde(inner(length(chars, min = 1, max = 255)))]
        #[schema(min_length = 1, max_length = 255)]
        passphrase: Option<compact_str::CompactString>,
    },
}

impl EggRepositoryCredentials {
    fn validate_scheme_for_url(&self, git_repository: &str) -> Result<(), anyhow::Error> {
        let scheme = gix::url::parse(git_repository)
            .map(|url| url.scheme)
            .unwrap_or(gix::url::Scheme::Https);

        match self {
            EggRepositoryCredentials::None => {}
            EggRepositoryCredentials::Password { .. } => {
                if scheme == gix::url::Scheme::Http {
                    return Err(crate::response::DisplayError::new(
                        "password credentials cannot be sent over plain http, use an https repository url",
                    )
                    .into());
                }
            }
            EggRepositoryCredentials::PrivateKey { .. } => {
                if scheme != gix::url::Scheme::Ssh {
                    return Err(crate::response::DisplayError::new(
                        "private key credentials can only be used with ssh repositories",
                    )
                    .into());
                }
            }
        }

        Ok(())
    }

    fn validate_key_material(&self) -> Result<(), anyhow::Error> {
        if let EggRepositoryCredentials::PrivateKey {
            private_key,
            passphrase,
            ..
        } = self
        {
            crate::git::parse_private_key(private_key, passphrase.as_deref()).map_err(|err| {
                crate::response::DisplayError::new(format!("private key is unusable: {err}"))
            })?;
        }

        Ok(())
    }

    pub async fn encrypt(
        &mut self,
        database: &crate::database::Database,
    ) -> Result<(), anyhow::Error> {
        match self {
            EggRepositoryCredentials::None => {}
            EggRepositoryCredentials::Password { password, .. } => {
                *password = database.encrypt_base64(password.clone()).await?;
            }
            EggRepositoryCredentials::PrivateKey {
                private_key,
                passphrase,
                ..
            } => {
                *private_key = database.encrypt_base64(private_key.clone()).await?.into();

                if let Some(passphrase) = passphrase {
                    *passphrase = database.encrypt_base64(passphrase.clone()).await?;
                }
            }
        }

        Ok(())
    }

    pub async fn decrypt(
        &mut self,
        database: &crate::database::Database,
    ) -> Result<(), anyhow::Error> {
        match self {
            EggRepositoryCredentials::None => {}
            EggRepositoryCredentials::Password { password, .. } => {
                if let Some(decrypted) = database.decrypt_base64_optional(&password).await? {
                    *password = decrypted;
                }
            }
            EggRepositoryCredentials::PrivateKey {
                private_key,
                passphrase,
                ..
            } => {
                if let Some(decrypted) = database.decrypt_base64_optional(&private_key).await? {
                    *private_key = decrypted.into();
                }

                if let Some(passphrase) = passphrase
                    && let Some(decrypted) = database.decrypt_base64_optional(&passphrase).await?
                {
                    *passphrase = decrypted;
                }
            }
        }

        Ok(())
    }
}

impl Censor for EggRepositoryCredentials {
    fn censor(&mut self) {
        match self {
            EggRepositoryCredentials::None => {}
            EggRepositoryCredentials::Password { password, .. } => {
                *password = CENSORED_PLACEHOLDER.into();
            }
            EggRepositoryCredentials::PrivateKey {
                private_key,
                passphrase,
                ..
            } => {
                *private_key = CENSORED_PLACEHOLDER.into();

                if let Some(passphrase) = passphrase {
                    *passphrase = CENSORED_PLACEHOLDER.into();
                }
            }
        }
    }
}

impl From<EggRepositoryCredentials> for crate::git::GitCredentials {
    fn from(value: EggRepositoryCredentials) -> Self {
        match value {
            EggRepositoryCredentials::None => Self::None,
            EggRepositoryCredentials::Password { username, password } => {
                Self::Password { username, password }
            }
            EggRepositoryCredentials::PrivateKey {
                username,
                private_key,
                passphrase,
            } => Self::PrivateKey {
                username,
                private_key,
                passphrase,
            },
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct EggRepository {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,
    pub git_repository: compact_str::CompactString,
    pub credentials: EggRepositoryCredentials,

    pub last_synced: Option<chrono::NaiveDateTime>,
    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for EggRepository {
    const NAME: &'static str = "egg_repository";

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
                "egg_repositories.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "egg_repositories.name",
                compact_str::format_compact!("{prefix}name"),
            ),
            (
                "egg_repositories.description",
                compact_str::format_compact!("{prefix}description"),
            ),
            (
                "egg_repositories.git_repository",
                compact_str::format_compact!("{prefix}git_repository"),
            ),
            (
                "egg_repositories.credentials",
                compact_str::format_compact!("{prefix}credentials"),
            ),
            (
                "egg_repositories.last_synced",
                compact_str::format_compact!("{prefix}last_synced"),
            ),
            (
                "egg_repositories.created",
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
            git_repository: row
                .try_get(compact_str::format_compact!("{prefix}git_repository").as_str())?,
            credentials: serde_json::from_value(
                row.try_get(compact_str::format_compact!("{prefix}credentials").as_str())?,
            )?,
            last_synced: row
                .try_get(compact_str::format_compact!("{prefix}last_synced").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl EggRepository {
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
            FROM egg_repositories
            WHERE ($1 IS NULL OR egg_repositories.name ILIKE '%' || $1 || '%')
            ORDER BY egg_repositories.created
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

    pub async fn sync(&self, state: &crate::State) -> Result<usize, anyhow::Error> {
        let git_repository = self.git_repository.clone();

        let mut credentials = self.credentials.clone();
        credentials.decrypt(&state.database).await?;

        let url = gix::url::parse(git_repository.as_str())?;
        crate::git::resolve_addresses(&state.env, &url).await?;

        let env = Arc::clone(&state.env);

        struct FoundEgg {
            path: PathBuf,
            readme: Option<String>,
            exported_egg: super::nest_egg::ExportedNestEgg,
            updated: chrono::DateTime<chrono::Utc>,
        }

        let exported_eggs =
            tokio::task::spawn_blocking(move || -> Result<Vec<FoundEgg>, anyhow::Error> {
                let mut exported_eggs = Vec::new();
                let temp_dir = tempfile::tempdir()?;
                let filesystem = crate::cap::CapFilesystem::new(temp_dir.path().to_path_buf())?;

                let mut prepare_fetch = gix::clone::PrepareFetch::new(
                    url.clone(),
                    temp_dir.path(),
                    gix::create::Kind::WithWorktree,
                    Default::default(),
                    gix::open::Options::default().config_overrides(["credential.helper="]),
                )?
                .configure_connection(
                    crate::git::GitCredentials::from(credentials)
                        .into_connection_configurator(env, url),
                );

                let (mut prepare_checkout, _) = prepare_fetch
                    .fetch_then_checkout(gix::progress::Discard, &gix::interrupt::IS_INTERRUPTED)?;
                let _ = prepare_checkout
                    .main_worktree(gix::progress::Discard, &gix::interrupt::IS_INTERRUPTED)?;

                tracing::info!(
                    "cloned egg repository {} to temporary directory",
                    git_repository
                );

                let mut walker = filesystem.walk_dir(".")?;
                while let Some(Ok((is_dir, entry))) = walker.next_entry() {
                    if is_dir
                        || !matches!(
                            entry.extension().and_then(|s| s.to_str()),
                            Some("json") | Some("yml") | Some("yaml")
                        )
                    {
                        continue;
                    }

                    let metadata = match filesystem.metadata(&entry) {
                        Ok(metadata) => metadata,
                        Err(_) => continue,
                    };

                    if !metadata.is_file()
                        || metadata.len() > super::nest_egg::NestEgg::MAX_EXPORTED_SIZE as u64
                    {
                        continue;
                    }

                    let file_content = match filesystem.read_to_string(&entry) {
                        Ok(content) => content,
                        Err(_) => continue,
                    };
                    let exported_egg: super::nest_egg::ExportedNestEgg =
                        if entry.extension().and_then(|s| s.to_str()) == Some("json") {
                            match serde_json::from_str(file_content.trim()) {
                                Ok(egg) => egg,
                                Err(_) => continue,
                            }
                        } else {
                            match serde_norway::from_str(file_content.trim()) {
                                Ok(egg) => egg,
                                Err(_) => continue,
                            }
                        };

                    let mut readme = None;
                    let mut current_path = entry.parent();
                    'readme: while let Some(path) = current_path {
                        let mut dir = filesystem.read_dir(path)?;

                        while let Some(Ok((is_dir, entry))) = dir.next_entry() {
                            if is_dir {
                                continue;
                            }

                            let path = path.join(&entry);

                            if entry.to_lowercase().contains("readme")
                                && filesystem
                                    .metadata(&path)
                                    .is_ok_and(|m| m.is_file() && m.len() <= 1024 * 1024)
                                && let Ok(content) = filesystem.read_to_string(&path)
                            {
                                readme = Some(content);
                                break 'readme;
                            }
                        }

                        current_path = path.parent();
                    }

                    exported_eggs.push(FoundEgg {
                        path: entry,
                        readme,
                        exported_egg,
                        updated: chrono::DateTime::from_timestamp(
                            metadata
                                .modified()
                                .map_or_else(|_| std::time::SystemTime::now(), |t| t.into_std())
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_secs() as i64,
                            0,
                        )
                        .unwrap_or_else(chrono::Utc::now),
                    });
                }

                drop(prepare_fetch);

                Ok(exported_eggs)
            })
            .await??;

        super::egg_repository_egg::EggRepositoryEgg::delete_unused(
            &state.database,
            self.uuid,
            &exported_eggs
                .iter()
                .map(|egg| egg.path.to_string_lossy().to_compact_string())
                .collect::<Vec<_>>(),
        )
        .await?;

        let mut futures = Vec::new();
        futures.reserve_exact(exported_eggs.len());

        for egg in exported_eggs.iter() {
            futures.push(super::egg_repository_egg::EggRepositoryEgg::create(
                &state.database,
                self.uuid,
                egg.path.to_string_lossy(),
                egg.readme.as_deref(),
                &egg.exported_egg,
                egg.updated.naive_utc(),
            ));
        }

        let mut results_stream = futures_util::stream::iter(futures).buffer_unordered(25);
        while let Some(result) = results_stream.next().await {
            result?;
        }

        sqlx::query(
            r#"
            UPDATE egg_repositories
            SET last_synced = NOW()
            WHERE egg_repositories.uuid = $1
            "#,
        )
        .bind(self.uuid)
        .execute(state.database.write())
        .await?;

        Ok(exported_eggs.len())
    }
}

#[async_trait::async_trait]
impl IntoAdminApiObject for EggRepository {
    type AdminApiObject = AdminApiEggRepository;
    type ExtraArgs<'a> = ();

    async fn into_admin_api_object<'a>(
        mut self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiEggRepository::init_hooks(&self, state).await?;

        self.credentials.censor();

        let api_object = finish_extendible!(
            AdminApiEggRepository {
                uuid: self.uuid,
                name: self.name,
                description: self.description,
                git_repository: self.git_repository,
                credentials: self.credentials,
                last_synced: self.last_synced.map(|dt| dt.and_utc()),
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[derive(ToSchema, Deserialize, Validate)]
pub struct CreateEggRepositoryOptions {
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: compact_str::CompactString,
    #[garde(length(max = 1024))]
    #[schema(max_length = 1024)]
    pub description: Option<compact_str::CompactString>,
    #[garde(custom(validate_git_repository))]
    #[schema(example = "https://github.com/example/repo.git", format = "uri")]
    pub git_repository: compact_str::CompactString,
    #[garde(dive)]
    pub credentials: Option<EggRepositoryCredentials>,
}

#[async_trait::async_trait]
impl CreatableModel for EggRepository {
    type CreateOptions<'a> = CreateEggRepositoryOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<EggRepository>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create_with_transaction(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self::CreateResult, crate::database::DatabaseError> {
        options.validate()?;

        let mut query_builder = InsertQueryBuilder::new("egg_repositories");

        Self::run_create_handlers(&mut options, &mut query_builder, state, transaction).await?;

        let credentials = options
            .credentials
            .get_or_insert(EggRepositoryCredentials::None);
        credentials.validate_scheme_for_url(&options.git_repository)?;
        credentials.validate_key_material()?;
        credentials.encrypt(&state.database).await?;

        query_builder
            .set("name", &options.name)
            .set("description", &options.description)
            .set("git_repository", &options.git_repository)
            .set("credentials", serde_json::to_value(&credentials)?);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut **transaction)
            .await?;
        let mut egg_repository = Self::map(None, &row)?;

        Self::run_after_create_handlers(&mut egg_repository, &options, state, transaction).await?;

        Ok(egg_repository)
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Clone, Default)]
pub struct UpdateEggRepositoryOptions {
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: Option<compact_str::CompactString>,
    #[garde(length(max = 1024))]
    #[schema(max_length = 1024)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub description: Option<Option<compact_str::CompactString>>,
    #[garde(inner(custom(validate_git_repository)))]
    #[schema(example = "https://github.com/example/repo.git", format = "uri")]
    pub git_repository: Option<compact_str::CompactString>,
    #[garde(dive)]
    pub credentials: Option<EggRepositoryCredentials>,
}

#[async_trait::async_trait]
impl UpdatableModel for EggRepository {
    type UpdateOptions = UpdateEggRepositoryOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateHandlerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateHandlerList<EggRepository>> =
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

        let mut query_builder = UpdateQueryBuilder::new("egg_repositories");

        self.run_update_handlers(&mut options, &mut query_builder, state, transaction)
            .await?;

        let git_repository = options
            .git_repository
            .as_deref()
            .unwrap_or(&self.git_repository);

        match &mut options.credentials {
            Some(credentials) => {
                credentials.validate_scheme_for_url(git_repository)?;
                credentials.validate_key_material()?;
                credentials.encrypt(&state.database).await?;
            }
            None => self.credentials.validate_scheme_for_url(git_repository)?,
        }

        query_builder
            .set("name", options.name.as_ref())
            .set(
                "description",
                options.description.as_ref().map(|d| d.as_ref()),
            )
            .set("git_repository", options.git_repository.as_ref())
            .set(
                "credentials",
                options
                    .credentials
                    .as_ref()
                    .map(serde_json::to_value)
                    .transpose()?,
            )
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut **transaction).await?;

        if let Some(name) = options.name {
            self.name = name;
        }
        if let Some(description) = options.description {
            self.description = description;
        }
        if let Some(git_repository) = options.git_repository {
            self.git_repository = git_repository;
        }
        if let Some(credentials) = options.credentials {
            self.credentials = credentials;
        }

        self.run_after_update_handlers(state, transaction).await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl ByUuid for EggRepository {
    async fn by_uuid(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
    ) -> Result<Self, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM egg_repositories
            WHERE egg_repositories.uuid = $1
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
            FROM egg_repositories
            WHERE egg_repositories.uuid = $1
            "#,
            Self::columns_sql(None)
        )))
        .bind(uuid)
        .fetch_one(&mut **transaction)
        .await?;

        Self::map(None, &row)
    }
}

#[async_trait::async_trait]
impl DeletableModel for EggRepository {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteHandlerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteHandlerList<EggRepository>> =
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
            DELETE FROM egg_repositories
            WHERE egg_repositories.uuid = $1
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
#[init_args(EggRepository, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "EggRepository")]
pub struct AdminApiEggRepository {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,
    pub git_repository: compact_str::CompactString,
    pub credentials: EggRepositoryCredentials,

    pub last_synced: Option<chrono::DateTime<chrono::Utc>>,
    pub created: chrono::DateTime<chrono::Utc>,
}
