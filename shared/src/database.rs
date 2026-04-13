use base64::Engine;
use sqlx::postgres::PgPoolOptions;
use std::{collections::HashMap, fmt::Display, pin::Pin, sync::Arc};
use tokio::sync::Mutex;

pub static BASE64_ENGINE: base64::engine::GeneralPurpose = base64::engine::GeneralPurpose::new(
    &base64::alphabet::STANDARD,
    base64::engine::GeneralPurposeConfig::new()
        .with_decode_allow_trailing_bits(true)
        .with_decode_padding_mode(base64::engine::DecodePaddingMode::Indifferent),
);

type BatchFuture = Pin<Box<dyn Future<Output = Result<(), anyhow::Error>> + Send>>;

pub struct Database {
    pub cache: Arc<crate::cache::Cache>,

    write: sqlx::PgPool,
    read: Option<sqlx::PgPool>,

    encryption_key: Arc<str>,
    use_decryption_cache: bool,
    batch_actions: Arc<Mutex<HashMap<(&'static str, uuid::Uuid), BatchFuture>>>,
}

impl Database {
    pub async fn new(env: &crate::env::Env, cache: Arc<crate::cache::Cache>) -> Self {
        let start = std::time::Instant::now();

        let instance = Self {
            cache,

            write: match &env.database_url_primary {
                Some(url) => PgPoolOptions::new()
                    .min_connections(10)
                    .max_connections(20)
                    .test_before_acquire(false)
                    .connect(url)
                    .await
                    .unwrap(),

                None => PgPoolOptions::new()
                    .min_connections(10)
                    .max_connections(50)
                    .test_before_acquire(false)
                    .connect(&env.database_url)
                    .await
                    .unwrap(),
            },
            read: if env.database_url_primary.is_some() {
                Some(
                    PgPoolOptions::new()
                        .min_connections(10)
                        .max_connections(50)
                        .test_before_acquire(false)
                        .connect(&env.database_url)
                        .await
                        .unwrap(),
                )
            } else {
                None
            },

            encryption_key: env.app_encryption_key.clone().into(),
            use_decryption_cache: env.app_use_decryption_cache,
            batch_actions: Arc::new(Mutex::new(HashMap::new())),
        };

        let version = instance
            .version()
            .await
            .unwrap_or_else(|_| "unknown".into());

        tracing::info!(
            "database connected (postgres@{}, {}ms)",
            version,
            start.elapsed().as_millis()
        );

        tokio::spawn({
            let batch_actions = instance.batch_actions.clone();

            async move {
                loop {
                    tokio::time::sleep(std::time::Duration::from_secs(5)).await;

                    let mut actions = batch_actions.lock().await;
                    for (key, action) in actions.drain() {
                        tracing::debug!("executing batch action for {}:{}", key.0, key.1);
                        if let Err(err) = action.await {
                            tracing::error!(
                                "error executing batch action for {}:{} - {:?}",
                                key.0,
                                key.1,
                                err
                            );
                            sentry_anyhow::capture_anyhow(&err);
                        }
                    }
                }
            }
        });

        instance
    }

    pub async fn flush_batch_actions(&self) {
        let mut actions = self.batch_actions.lock().await;
        for (key, action) in actions.drain() {
            tracing::debug!("executing batch action for {}:{}", key.0, key.1);
            if let Err(err) = action.await {
                tracing::error!(
                    "error executing batch action for {}:{} - {:?}",
                    key.0,
                    key.1,
                    err
                );
                sentry_anyhow::capture_anyhow(&err);
            }
        }
    }

    pub async fn version(&self) -> Result<compact_str::CompactString, sqlx::Error> {
        let version: (compact_str::CompactString,) =
            sqlx::query_as("SELECT split_part(version(), ' ', 2)")
                .fetch_one(self.read())
                .await?;

        Ok(version.0)
    }

    pub async fn size(&self) -> Result<u64, sqlx::Error> {
        let size: (i64,) = sqlx::query_as("SELECT pg_database_size(current_database())")
            .fetch_one(self.read())
            .await?;

        Ok(size.0 as u64)
    }

    #[inline]
    pub fn write(&self) -> &sqlx::PgPool {
        &self.write
    }

    #[inline]
    pub fn read(&self) -> &sqlx::PgPool {
        self.read.as_ref().unwrap_or(&self.write)
    }

    pub async fn encrypt(
        &self,
        data: impl AsRef<[u8]> + Send + 'static,
    ) -> Result<Vec<u8>, anyhow::Error> {
        let encryption_key = self.encryption_key.clone();

        tokio::task::spawn_blocking(move || {
            simple_crypt::encrypt(data.as_ref(), encryption_key.as_bytes())
        })
        .await?
    }

    pub async fn encrypt_base64(
        &self,
        data: impl AsRef<[u8]> + Send + 'static,
    ) -> Result<compact_str::CompactString, anyhow::Error> {
        let encrypted = self.encrypt(data).await?;
        Ok(BASE64_ENGINE.encode(&encrypted).into())
    }

    #[inline]
    pub fn blocking_encrypt(&self, data: impl AsRef<[u8]>) -> Result<Vec<u8>, anyhow::Error> {
        simple_crypt::encrypt(data.as_ref(), self.encryption_key.as_bytes())
    }

    #[inline]
    pub fn blocking_encrypt_base64(
        &self,
        data: impl AsRef<[u8]>,
    ) -> Result<compact_str::CompactString, anyhow::Error> {
        let encrypted = self.blocking_encrypt(data)?;
        Ok(BASE64_ENGINE.encode(&encrypted).into())
    }

    pub async fn decrypt(
        &self,
        data: impl AsRef<[u8]> + Send + 'static,
    ) -> Result<compact_str::CompactString, anyhow::Error> {
        if self.use_decryption_cache {
            self.cache
                .cached(
                    &format!(
                        "decryption_cache::{}",
                        base32::encode(base32::Alphabet::Z, data.as_ref())
                    ),
                    30,
                    || async {
                        let encryption_key = self.encryption_key.clone();
                        let data = data.as_ref().to_vec();

                        tokio::task::spawn_blocking(move || {
                            simple_crypt::decrypt(&data, encryption_key.as_bytes())
                                .map(|s| compact_str::CompactString::from_utf8_lossy(&s))
                        })
                        .await?
                    },
                )
                .await
        } else {
            let encryption_key = self.encryption_key.clone();

            tokio::task::spawn_blocking(move || {
                simple_crypt::decrypt(data.as_ref(), encryption_key.as_bytes())
                    .map(|s| compact_str::CompactString::from_utf8_lossy(&s))
            })
            .await?
        }
    }

    pub async fn decrypt_base64(
        &self,
        data: impl AsRef<str>,
    ) -> Result<compact_str::CompactString, anyhow::Error> {
        let decoded = BASE64_ENGINE.decode(data.as_ref())?;
        self.decrypt(decoded).await
    }

    pub async fn decrypt_base64_optional(
        &self,
        data: impl AsRef<str>,
    ) -> Result<Option<compact_str::CompactString>, anyhow::Error> {
        match BASE64_ENGINE.decode(data.as_ref()) {
            Ok(decoded) => Ok(Some(self.decrypt(decoded).await?)),
            Err(_) => Ok(None),
        }
    }

    #[inline]
    pub fn blocking_decrypt(
        &self,
        data: impl AsRef<[u8]>,
    ) -> Result<compact_str::CompactString, anyhow::Error> {
        simple_crypt::decrypt(data.as_ref(), self.encryption_key.as_bytes())
            .map(|s| compact_str::CompactString::from_utf8_lossy(&s))
    }

    #[inline]
    pub fn blocking_decrypt_base64(
        &self,
        data: impl AsRef<str>,
    ) -> Result<compact_str::CompactString, anyhow::Error> {
        let decoded = BASE64_ENGINE.decode(data.as_ref())?;
        self.blocking_decrypt(decoded)
    }

    #[inline]
    pub async fn batch_action(
        &self,
        key: &'static str,
        uuid: uuid::Uuid,
        action: impl Future<Output = Result<(), anyhow::Error>> + Send + 'static,
    ) {
        let mut actions = self.batch_actions.lock().await;
        actions.insert((key, uuid), Box::pin(action));
    }
}

#[derive(Debug)]
pub enum DatabaseError {
    Sqlx(sqlx::Error),
    Mongodb(mongodb::error::Error),
    Serde(serde_json::Error),
    Any(anyhow::Error),
    Validation(garde::Report),
    InvalidRelation(InvalidRelationError),
}

impl Display for DatabaseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Sqlx(sqlx_value) => sqlx_value.fmt(f),
            Self::Mongodb(mongodb_value) => mongodb_value.fmt(f),
            Self::Serde(serde_value) => serde_value.fmt(f),
            Self::Any(any_value) => any_value.fmt(f),
            Self::Validation(validation_value) => validation_value.fmt(f),
            Self::InvalidRelation(relation_value) => relation_value.fmt(f),
        }
    }
}

impl From<wings_api::client::ApiHttpError> for DatabaseError {
    #[inline]
    fn from(value: wings_api::client::ApiHttpError) -> Self {
        Self::Any(value.into())
    }
}

impl From<anyhow::Error> for DatabaseError {
    #[inline]
    fn from(value: anyhow::Error) -> Self {
        Self::Any(value)
    }
}

impl From<serde_json::Error> for DatabaseError {
    #[inline]
    fn from(value: serde_json::Error) -> Self {
        Self::Serde(value)
    }
}

impl From<sqlx::Error> for DatabaseError {
    #[inline]
    fn from(value: sqlx::Error) -> Self {
        Self::Sqlx(value)
    }
}

impl From<mongodb::error::Error> for DatabaseError {
    #[inline]
    fn from(value: mongodb::error::Error) -> Self {
        Self::Mongodb(value)
    }
}

impl From<garde::Report> for DatabaseError {
    #[inline]
    fn from(value: garde::Report) -> Self {
        Self::Validation(value)
    }
}

impl From<InvalidRelationError> for DatabaseError {
    fn from(value: InvalidRelationError) -> Self {
        Self::InvalidRelation(value)
    }
}

impl DatabaseError {
    #[inline]
    pub fn is_unique_violation(&self) -> bool {
        match self {
            Self::Sqlx(sqlx_value) => sqlx_value
                .as_database_error()
                .is_some_and(|e| e.is_unique_violation()),
            _ => false,
        }
    }

    #[inline]
    pub fn is_foreign_key_violation(&self) -> bool {
        match self {
            Self::Sqlx(sqlx_value) => sqlx_value
                .as_database_error()
                .is_some_and(|e| e.is_foreign_key_violation()),
            _ => false,
        }
    }

    #[inline]
    pub fn is_check_violation(&self) -> bool {
        match self {
            Self::Sqlx(sqlx_value) => sqlx_value
                .as_database_error()
                .is_some_and(|e| e.is_check_violation()),
            _ => false,
        }
    }

    #[inline]
    pub const fn is_validation_error(&self) -> bool {
        matches!(self, Self::Validation(_))
    }

    #[inline]
    pub const fn is_invalid_relation(&self) -> bool {
        matches!(self, Self::InvalidRelation(_))
    }
}

impl std::error::Error for DatabaseError {}

#[derive(Debug)]
pub struct InvalidRelationError(pub &'static str);

impl Display for InvalidRelationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "invalid relation `{}` provided", self.0)
    }
}
