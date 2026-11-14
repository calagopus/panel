use crate::{
    censor::{CENSORED_PLACEHOLDER, Censor},
    models::{InsertQueryBuilder, UpdateQueryBuilder},
    prelude::*,
};
use compact_str::ToCompactString;
use futures_util::StreamExt;
use garde::Validate;
use serde::{Deserialize, Serialize};
use sha2::Digest;
use sqlx::{Row, postgres::PgRow};
use std::{
    collections::{BTreeMap, HashMap, HashSet},
    io::Read,
    path::{Path, PathBuf},
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

fn default_true() -> bool {
    true
}

const BANNER_MAX_SOURCE_BYTES: u64 = 8 * 1024 * 1024;
const BANNER_MAX_WIDTH: u32 = 960;
const BANNER_MAX_HEIGHT: u32 = 480;

fn is_banner_file_name(name: &str) -> bool {
    let Some((stem, extension)) = name.rsplit_once('.') else {
        return false;
    };

    stem.eq_ignore_ascii_case("banner")
        && ["png", "jpg", "jpeg", "webp", "gif"]
            .iter()
            .any(|e| extension.eq_ignore_ascii_case(e))
}

fn banner_storage_path(egg_repository_uuid: uuid::Uuid, source: &[u8]) -> String {
    let mut hasher = sha2::Sha256::new();
    hasher.update(b"v1");
    hasher.update(source);

    format!(
        "publicdata/egg-repositories/{}/banners/{}.webp",
        egg_repository_uuid,
        hex::encode(&hasher.finalize()[..16])
    )
}

async fn transcode_banner(data: Vec<u8>) -> Result<Vec<u8>, anyhow::Error> {
    let image = super::user::avatar::decode(data, super::user::avatar::upload_limits()).await?;

    tokio::task::spawn_blocking(move || -> Result<Vec<u8>, anyhow::Error> {
        let image = if image.width() > BANNER_MAX_WIDTH || image.height() > BANNER_MAX_HEIGHT {
            image.resize(
                BANNER_MAX_WIDTH,
                BANNER_MAX_HEIGHT,
                image::imageops::FilterType::Triangle,
            )
        } else {
            image
        };
        let image = image::DynamicImage::ImageRgba8(image.into_rgba8());

        let mut data = Vec::new();
        image::codecs::webp::WebPEncoder::new_lossless(&mut data).encode(
            image.as_bytes(),
            image.width(),
            image.height(),
            image::ExtendedColorType::Rgba8,
        )?;

        Ok(data)
    })
    .await?
}

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
                "Invalid git repository: only http, https, ssh and scp-style (user@host:path) urls are supported",
            ));
        }
    }

    if url.host().is_none() {
        return Err(garde::Error::new("Invalid git repository: missing host"));
    }

    Ok(())
}

/// Stored credentials are only ever sent back to the scheme, host and port they were entered for.
fn same_origin(a: &str, b: &str) -> bool {
    match (gix::url::parse(a), gix::url::parse(b)) {
        (Ok(a), Ok(b)) => {
            a.scheme == b.scheme
                && a.port_or_default() == b.port_or_default()
                && a.host()
                    .zip(b.host())
                    .is_some_and(|(a, b)| a.eq_ignore_ascii_case(b))
        }
        _ => false,
    }
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
            EggRepositoryCredentials::None => {
                if scheme == gix::url::Scheme::Ssh {
                    return Err(crate::response::DisplayError::new(
                        "ssh repositories need credentials, use an https repository url for public repositories",
                    )
                    .into());
                }
            }
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
    pub default_nest: Option<Fetchable<super::nest::Nest>>,
    pub auto_sync: bool,

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
                "egg_repositories.default_nest_uuid",
                compact_str::format_compact!("{prefix}default_nest_uuid"),
            ),
            (
                "egg_repositories.auto_sync",
                compact_str::format_compact!("{prefix}auto_sync"),
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
            default_nest: row
                .try_get::<Option<uuid::Uuid>, _>(
                    compact_str::format_compact!("{prefix}default_nest_uuid").as_str(),
                )?
                .map(super::nest::Nest::get_fetchable),
            auto_sync: row.try_get(compact_str::format_compact!("{prefix}auto_sync").as_str())?,
            last_synced: row
                .try_get(compact_str::format_compact!("{prefix}last_synced").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }

    fn cache_invalidation_keys(&self) -> Vec<compact_str::CompactString> {
        vec![compact_str::format_compact!(
            "{}::{}",
            Self::NAME,
            self.uuid
        )]
    }
}

impl EggRepository {
    pub async fn all_with_pagination(
        database: &crate::database::Database,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        super::PaginatedQueryBuilder::new(
            Self::columns_sql(None),
            format!(
                r#"
                FROM egg_repositories
                WHERE {search}
                "#,
                search =
                    super::search_sql(1, &["egg_repositories.name"], &["egg_repositories.uuid"]),
            ),
            "egg_repositories.created, egg_repositories.uuid",
        )
        .bind(search)
        .fetch(database, page, per_page)
        .await
    }

    pub async fn all_auto_sync(
        database: &crate::database::Database,
    ) -> Result<Vec<Self>, crate::database::DatabaseError> {
        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM egg_repositories
            WHERE egg_repositories.auto_sync
            ORDER BY egg_repositories.created, egg_repositories.uuid
            "#,
            Self::columns_sql(None)
        )))
        .fetch_all(database.read())
        .await?;

        rows.into_iter()
            .map(|row| Self::map(None, &row))
            .try_collect_vec()
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
            banner: Option<String>,
            exported_egg: super::nest_egg::ExportedNestEgg,
            updated: chrono::DateTime<chrono::Utc>,
        }
        type NewBanners = HashMap<String, Vec<u8>>;

        let egg_repository_uuid = self.uuid;
        let previous_banners: HashSet<String> =
            super::egg_repository_egg::EggRepositoryEgg::banners_by_egg_repository_uuid(
                &state.database,
                self.uuid,
            )
            .await?
            .into_iter()
            .collect();
        let known_banners = previous_banners.clone();

        let (mut exported_eggs, new_banners) = tokio::task::spawn_blocking(
            move || -> Result<(Vec<FoundEgg>, NewBanners), anyhow::Error> {
                let mut exported_eggs = Vec::new();
                let mut banner_files: HashMap<PathBuf, Option<String>> = HashMap::new();
                let mut new_banners: HashMap<String, Vec<u8>> = HashMap::new();
                let temp_dir = tempfile::tempdir()?;
                let filesystem = crate::cap::CapFilesystem::new_sync(temp_dir.path())?;

                let mut prepare_fetch = gix::clone::PrepareFetch::new(
                    url.clone(),
                    temp_dir.path(),
                    gix::create::Kind::WithWorktree,
                    Default::default(),
                    gix::open::Options::default()
                        .config_overrides(["credential.helper=", "http.followRedirects=false"]),
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
                while let Some(Ok(entry)) = walker.next_entry() {
                    let is_dir = entry.file_type().is_dir();
                    let entry = Path::new(".").join(&entry.path);
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

                    let file_content = match filesystem
                        .read_to_string(&entry, super::nest_egg::NestEgg::MAX_EXPORTED_SIZE)
                    {
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
                            match serde_saphyr::from_str_with_options(
                                file_content.trim(),
                                crate::utils::yaml_deserialize_options(),
                            ) {
                                Ok(egg) => egg,
                                Err(_) => continue,
                            }
                        };

                    let mut readme = None;
                    let mut banner = None;
                    let mut current_path = entry.parent();
                    while let Some(path) = current_path
                        && (readme.is_none() || banner.is_none())
                    {
                        let mut dir = filesystem.read_dir(path)?;

                        while let Some(Ok((file_type, entry))) = dir.next_entry() {
                            if file_type.is_dir() {
                                continue;
                            }

                            let path = path.join(&entry);

                            if readme.is_none()
                                && entry.to_lowercase().contains("readme")
                                && filesystem
                                    .metadata(&path)
                                    .is_ok_and(|m| m.is_file() && m.len() <= 1024 * 1024)
                                && let Ok(content) = filesystem.read_to_string(&path, 1024 * 1024)
                            {
                                readme = Some(content);
                            } else if banner.is_none() && is_banner_file_name(&entry) {
                                banner = banner_files
                                    .entry(path.clone())
                                    .or_insert_with(|| {
                                        if !filesystem.metadata(&path).is_ok_and(|m| {
                                            m.is_file() && m.len() <= BANNER_MAX_SOURCE_BYTES
                                        }) {
                                            return None;
                                        }

                                        let mut data = Vec::new();
                                        filesystem
                                            .open(&path)
                                            .ok()?
                                            .take(BANNER_MAX_SOURCE_BYTES)
                                            .read_to_end(&mut data)
                                            .ok()?;

                                        let storage_path =
                                            banner_storage_path(egg_repository_uuid, &data);
                                        if !known_banners.contains(&storage_path) {
                                            new_banners.insert(storage_path.clone(), data);
                                        }

                                        Some(storage_path)
                                    })
                                    .clone();
                            }
                        }

                        current_path = path.parent();
                    }

                    exported_eggs.push(FoundEgg {
                        path: entry,
                        readme,
                        banner,
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

                Ok((exported_eggs, new_banners))
            },
        )
        .await??;

        let mut failed_banners = HashSet::new();
        for (path, data) in new_banners {
            let result = match transcode_banner(data).await {
                Ok(data) => {
                    state
                        .storage
                        .store_with_cache_control(
                            &path,
                            data.as_slice(),
                            "image/webp",
                            Some("public, max-age=31536000, immutable"),
                        )
                        .await
                }
                Err(err) => Err(err),
            };

            if let Err(err) = result {
                tracing::warn!(
                    "failed to store egg repository banner {} for {}: {:?}",
                    path,
                    self.git_repository,
                    err
                );
                failed_banners.insert(path);
            }
        }

        for egg in exported_eggs.iter_mut() {
            if egg
                .banner
                .as_ref()
                .is_some_and(|banner| failed_banners.contains(banner))
            {
                egg.banner = None;
            }
        }

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
                egg.banner.as_deref(),
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

        Self::invalidate_cached(&state.database, self.uuid).await;

        let current_banners: HashSet<String> =
            super::egg_repository_egg::EggRepositoryEgg::banners_by_egg_repository_uuid(
                &state.database,
                self.uuid,
            )
            .await?
            .into_iter()
            .collect();
        for banner in previous_banners.difference(&current_banners) {
            state.storage.remove(Some(banner)).await?;
        }

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

        let default_nest = match self.default_nest {
            Some(default_nest) => Some(
                default_nest
                    .fetch_cached(&state.database)
                    .await?
                    .into_admin_api_object(state, ())
                    .await?,
            ),
            None => None,
        };

        let api_object = finish_extendible!(
            AdminApiEggRepository {
                uuid: self.uuid,
                name: self.name,
                description: self.description,
                git_repository: self.git_repository,
                credentials: self.credentials,
                default_nest,
                auto_sync: self.auto_sync,
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
    #[garde(skip)]
    pub default_nest_uuid: Option<uuid::Uuid>,
    #[garde(skip)]
    #[serde(default = "default_true")]
    pub auto_sync: bool,
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

        if let Some(default_nest_uuid) = options.default_nest_uuid {
            super::nest::Nest::by_uuid_optional_cached(&state.database, default_nest_uuid)
                .await?
                .ok_or(crate::database::InvalidRelationError("nest"))?;
        }

        query_builder
            .set("name", &options.name)
            .set("description", &options.description)
            .set("git_repository", &options.git_repository)
            .set("credentials", serde_json::to_value(&credentials)?)
            .set("default_nest_uuid", options.default_nest_uuid)
            .set("auto_sync", options.auto_sync);

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
    #[garde(skip)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub default_nest_uuid: Option<Option<uuid::Uuid>>,
    #[garde(skip)]
    pub auto_sync: Option<bool>,
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

        if options.credentials.is_none()
            && options
                .git_repository
                .as_deref()
                .is_some_and(|git_repository| !same_origin(git_repository, &self.git_repository))
        {
            options.credentials = Some(EggRepositoryCredentials::None);
        }

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

        if let Some(Some(default_nest_uuid)) = options.default_nest_uuid {
            super::nest::Nest::by_uuid_optional_cached(&state.database, default_nest_uuid)
                .await?
                .ok_or(crate::database::InvalidRelationError("nest"))?;
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
            .set(
                "default_nest_uuid",
                options.default_nest_uuid.as_ref().map(|o| o.as_ref()),
            )
            .set("auto_sync", options.auto_sync)
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
        if let Some(default_nest_uuid) = options.default_nest_uuid {
            self.default_nest = default_nest_uuid.map(super::nest::Nest::get_fetchable);
        }
        if let Some(auto_sync) = options.auto_sync {
            self.auto_sync = auto_sync;
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
    async fn delete(
        &self,
        state: &crate::State,
        options: Self::DeleteOptions,
    ) -> Result<(), anyhow::Error> {
        let banners = super::egg_repository_egg::EggRepositoryEgg::banners_by_egg_repository_uuid(
            &state.database,
            self.uuid,
        )
        .await?;

        let mut transaction = state.database.write().begin().await?;

        if let Err(err) = self
            .delete_with_transaction(state, options, &mut transaction)
            .await
        {
            transaction.rollback().await?;
            return Err(err);
        }

        transaction.commit().await?;

        Self::invalidate_cached(&state.database, self.uuid).await;

        for banner in banners {
            state.storage.remove(Some(banner)).await?;
        }

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
    pub default_nest: Option<super::nest::AdminApiNest>,
    pub auto_sync: bool,

    pub last_synced: Option<chrono::DateTime<chrono::Utc>>,
    pub created: chrono::DateTime<chrono::Utc>,
}
