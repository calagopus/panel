use crate::{env::RedisMode, response::ApiResponse};
use axum::http::StatusCode;
use compact_str::ToCompactString;
use rand::distr::SampleString;
use rustis::{
    ErrorKind, RedisError, RedisErrorKind,
    client::Client,
    commands::{
        GenericCommands, InfoSection, ScriptingCommands, ServerCommands, SetCondition,
        SetExpiration, StringCommands,
    },
    resp::BulkString,
};
use serde::{Serialize, de::DeserializeOwned};
use sha1::Digest;
use std::{
    borrow::Cow,
    collections::HashMap,
    future::Future,
    sync::{
        Arc, LazyLock,
        atomic::{AtomicU8, AtomicU64, Ordering},
    },
    time::{Duration, Instant},
};

const RATELIMIT_SCRIPT: &str = r#"
local hits = redis.call('INCR', KEYS[1])
local ttl = redis.call('TTL', KEYS[1])
if ttl < 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {hits, ttl}
"#;

static RATELIMIT_SCRIPT_SHA: LazyLock<String> =
    LazyLock::new(|| hex::encode(sha1::Sha1::digest(RATELIMIT_SCRIPT)));

const LOCK_RELEASE_SCRIPT: &str = r#"
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
"#;

#[derive(Clone, Serialize)]
pub struct BulkStringRef<'a>(
    #[serde(
        deserialize_with = "::rustis::resp::deserialize_byte_buf",
        serialize_with = "::rustis::resp::serialize_byte_buf"
    )]
    pub &'a [u8],
);

#[derive(Clone, Debug)]
struct DataEntry {
    data: Arc<Vec<u8>>,
    intended_ttl: Duration,
}

#[derive(Clone, Debug)]
pub struct Resolution {
    pub uuid: uuid::Uuid,
    pub fingerprint: Arc<Vec<u8>>,
}

#[derive(Debug)]
pub struct SharedComputeError(pub Arc<anyhow::Error>);

impl std::fmt::Display for SharedComputeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        std::fmt::Display::fmt(&self.0, f)
    }
}

impl std::error::Error for SharedComputeError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        Some(&**self.0)
    }
}

struct DataExpiry;

impl moka::Expiry<compact_str::CompactString, DataEntry> for DataExpiry {
    fn expire_after_create(
        &self,
        _key: &compact_str::CompactString,
        value: &DataEntry,
        _created_at: Instant,
    ) -> Option<Duration> {
        Some(value.intended_ttl)
    }
}

#[derive(Clone, Copy, Debug)]
struct RatelimitBlock {
    limit_used: u64,
    expire_unix: u64,
    ttl: Duration,
}

struct RatelimitBlockExpiry;

impl moka::Expiry<compact_str::CompactString, RatelimitBlock> for RatelimitBlockExpiry {
    fn expire_after_create(
        &self,
        _key: &compact_str::CompactString,
        value: &RatelimitBlock,
        _created_at: Instant,
    ) -> Option<Duration> {
        Some(value.ttl)
    }

    fn expire_after_update(
        &self,
        _key: &compact_str::CompactString,
        value: &RatelimitBlock,
        _updated_at: Instant,
        _duration_until_expiry: Option<Duration>,
    ) -> Option<Duration> {
        Some(value.ttl)
    }
}

fn ratelimited_response(limit: u64, limit_used: u64, expire_unix: u64, now: u64) -> ApiResponse {
    let retry_after = expire_unix.saturating_sub(now);

    ApiResponse::error(format!("you are ratelimited, retry in {retry_after}s"))
        .with_status(StatusCode::TOO_MANY_REQUESTS)
        .with_header("X-RateLimit-Limit", limit.to_compact_string())
        .with_header(
            "X-RateLimit-Remaining",
            limit.saturating_sub(limit_used).to_compact_string(),
        )
        .with_header("X-RateLimit-Reset", expire_unix.to_compact_string())
        .with_header("Retry-After", retry_after.to_compact_string())
}

const OUTCOME_COALESCED: u8 = 0;
const OUTCOME_REMOTE_HIT: u8 = 1;
const OUTCOME_MISS: u8 = 2;

fn is_dynamic_key_segment(segment: &str) -> bool {
    uuid::Uuid::try_parse(segment).is_ok()
        || (!segment.is_empty() && segment.bytes().all(|byte| byte.is_ascii_digit()))
}

fn key_prefix(key: &str) -> compact_str::CompactString {
    if !key.split("::").any(is_dynamic_key_segment) {
        return key.to_compact_string();
    }

    let mut prefix = compact_str::CompactString::const_new("");
    for (index, segment) in key.split("::").enumerate() {
        if index > 0 {
            prefix.push_str("::");
        }

        prefix.push_str(if is_dynamic_key_segment(segment) {
            "*"
        } else {
            segment
        });
    }

    prefix
}

#[derive(Default)]
struct CacheBucket {
    calls: AtomicU64,
    latency_ns_total: AtomicU64,
}

impl CacheBucket {
    fn record(&self, latency_ns: u64) {
        self.calls.fetch_add(1, Ordering::Relaxed);
        self.latency_ns_total
            .fetch_add(latency_ns, Ordering::Relaxed);
    }

    fn stats(&self) -> CacheBucketStats {
        CacheBucketStats {
            calls: self.calls.load(Ordering::Relaxed),
            latency_ns_total: self.latency_ns_total.load(Ordering::Relaxed),
        }
    }
}

#[derive(Clone, Copy)]
pub struct CacheBucketStats {
    pub calls: u64,
    pub latency_ns_total: u64,
}

impl CacheBucketStats {
    #[inline]
    pub fn average_latency_ns(&self) -> u64 {
        self.latency_ns_total.checked_div(self.calls).unwrap_or(0)
    }

    fn merge(&self, other: &Self) -> Self {
        Self {
            calls: self.calls + other.calls,
            latency_ns_total: self.latency_ns_total + other.latency_ns_total,
        }
    }
}

pub struct CacheStats {
    pub local_hits: CacheBucketStats,
    pub remote_hits: CacheBucketStats,
    pub coalesced_waits: CacheBucketStats,
    pub misses: CacheBucketStats,
    pub max_latency_ns: u64,
}

impl CacheStats {
    #[inline]
    pub fn total_calls(&self) -> u64 {
        self.local_hits.calls
            + self.remote_hits.calls
            + self.coalesced_waits.calls
            + self.misses.calls
    }

    #[inline]
    pub fn hits(&self) -> CacheBucketStats {
        self.local_hits.merge(&self.remote_hits)
    }
}

pub struct Cache {
    client: Option<Arc<Client>>,
    redis_prefix: Option<compact_str::CompactString>,
    use_internal_cache: bool,
    local: moka::future::Cache<compact_str::CompactString, DataEntry>,
    local_task: tokio::task::JoinHandle<()>,
    local_locks: LocalLocks,
    local_locks_task: tokio::task::JoinHandle<()>,
    local_ratelimits: moka::future::Cache<compact_str::CompactString, (u64, u64)>,
    ratelimit_blocks: moka::future::Cache<compact_str::CompactString, RatelimitBlock>,
    local_resolutions: moka::future::Cache<compact_str::CompactString, Resolution>,

    cache_local_hits: CacheBucket,
    cache_remote_hits: CacheBucket,
    cache_coalesced_waits: CacheBucket,
    cache_misses: CacheBucket,
    cache_latency_ns_max: AtomicU64,
}

async fn connect_client(label: &str, url: &str) -> Client {
    crate::retry::startup_connect(label, || Client::connect(url)).await
}

impl Cache {
    pub async fn new(env: &crate::env::Env) -> Arc<Self> {
        let start = std::time::Instant::now();

        let client = match &env.redis_mode {
            RedisMode::Redis { redis_url } => {
                if let Some(redis_url) = redis_url {
                    Some(Arc::new(connect_client("redis", redis_url).await))
                } else {
                    None
                }
            }
            RedisMode::Sentinel {
                cluster_name,
                redis_sentinels,
            } => Some(Arc::new(
                connect_client(
                    "redis sentinel",
                    &format!(
                        "redis-sentinel://{}/{cluster_name}/0",
                        redis_sentinels.join(",")
                    ),
                )
                .await,
            )),
        };

        let local = moka::future::Cache::builder()
            .max_capacity(16384)
            .expire_after(DataExpiry)
            .build();

        let local_task = tokio::spawn({
            let local = local.clone();

            async move {
                loop {
                    tokio::time::sleep(Duration::from_secs(10)).await;
                    local.run_pending_tasks().await;
                }
            }
        });

        let local_locks = LocalLocks::default();

        let local_locks_task = tokio::spawn({
            let local_locks = local_locks.clone();

            async move {
                loop {
                    tokio::time::sleep(Duration::from_secs(10)).await;
                    local_locks
                        .lock()
                        .retain(|_, semaphore| Arc::strong_count(semaphore) > 1);
                }
            }
        });

        let local_ratelimits = moka::future::Cache::builder().max_capacity(16384).build();
        let ratelimit_blocks = moka::future::Cache::builder()
            .max_capacity(16384)
            .expire_after(RatelimitBlockExpiry)
            .build();
        let local_resolutions = moka::future::Cache::builder()
            .max_capacity(65536)
            .time_to_idle(Duration::from_secs(3600))
            .build();

        let instance = Arc::new(Self {
            client,
            redis_prefix: env
                .redis_key_prefix
                .as_deref()
                .map(|prefix| compact_str::format_compact!("{prefix}::")),
            use_internal_cache: env.app_use_internal_cache,
            local,
            local_task,
            local_locks,
            local_locks_task,
            local_ratelimits,
            ratelimit_blocks,
            local_resolutions,
            cache_local_hits: CacheBucket::default(),
            cache_remote_hits: CacheBucket::default(),
            cache_coalesced_waits: CacheBucket::default(),
            cache_misses: CacheBucket::default(),
            cache_latency_ns_max: AtomicU64::new(0),
        });

        let version = instance
            .version()
            .await
            .unwrap_or_else(|_| "unknown".into());

        tracing::info!(
            "cache connected (redis@{}, {}ms, moka_enabled={})",
            version,
            start.elapsed().as_millis(),
            env.app_use_internal_cache
        );

        instance
    }

    fn redis_key<'a>(&self, key: &'a str) -> Cow<'a, str> {
        match &self.redis_prefix {
            Some(prefix) => Cow::Owned(format!("{prefix}{key}")),
            None => Cow::Borrowed(key),
        }
    }

    pub async fn version(&self) -> Result<compact_str::CompactString, rustis::Error> {
        let Some(client) = &self.client else {
            return Ok("memory-only".into());
        };

        let version: String = client.info([InfoSection::Server]).await?;
        let version = version
            .lines()
            .find(|line| line.starts_with("valkey_version:"))
            .or_else(|| {
                version
                    .lines()
                    .find(|line| line.starts_with("redis_version:"))
            })
            .unwrap_or("_:unknown")
            .split_once(':')
            .map_or("unknown", |(_, v)| v.trim())
            .into();

        Ok(version)
    }

    pub async fn ratelimit(
        &self,
        limit_identifier: impl AsRef<str>,
        limit: u64,
        limit_window: u64,
        client: impl AsRef<str>,
    ) -> Result<(), ApiResponse> {
        let key = compact_str::format_compact!(
            "ratelimit::{}::{}",
            limit_identifier.as_ref(),
            client.as_ref()
        );

        let now = chrono::Utc::now().timestamp() as u64;

        // the counter only grows and the ttl is never extended within a window, so a blocked
        // client stays blocked until the window ends and needs no counting round trip
        let blocked = match &self.client {
            Some(_) => self
                .ratelimit_blocks
                .get(&key)
                .await
                .filter(|block| block.expire_unix > now + 1)
                .map(|block| (block.limit_used, block.expire_unix)),
            None => self
                .local_ratelimits
                .get(&key)
                .await
                .filter(|(_, expire_unix)| *expire_unix > now + 2),
        };
        if let Some((limit_used, expire_unix)) = blocked
            && limit_used >= limit
        {
            return Err(ratelimited_response(limit, limit_used, expire_unix, now));
        }

        let remote = match &self.client {
            Some(redis_client) => match Self::eval_ratelimit(
                redis_client,
                self.redis_key(&key).as_ref(),
                limit_window,
            )
            .await
            {
                Ok((limit_used, ttl)) => {
                    let expire_unix = now + ttl.max(0) as u64;

                    if limit_used >= limit && expire_unix > now + 1 {
                        self.ratelimit_blocks
                            .insert(
                                key.clone(),
                                RatelimitBlock {
                                    limit_used,
                                    expire_unix,
                                    ttl: Duration::from_secs(expire_unix - now),
                                },
                            )
                            .await;
                    }

                    Some((limit_used, expire_unix))
                }
                Err(err) => {
                    tracing::warn!(
                        "failed to apply redis ratelimit for {key}, falling back to local ratelimit: {err:#?}"
                    );

                    None
                }
            },
            None => None,
        };

        let (limit_used, expire_unix) = match remote {
            Some(remote) => remote,
            None => self
                .local_ratelimits
                .entry(key)
                .and_upsert_with(|entry| {
                    let current = entry
                        .map(|entry| entry.into_value())
                        .filter(|(_, expire_unix)| *expire_unix > now + 2);

                    std::future::ready(match current {
                        Some((limit_used, expire_unix)) => (limit_used + 1, expire_unix),
                        None => (1, now + limit_window),
                    })
                })
                .await
                .into_value(),
        };

        if limit_used > limit {
            return Err(ratelimited_response(limit, limit_used, expire_unix, now));
        }

        Ok(())
    }

    async fn eval_ratelimit(
        client: &Client,
        redis_key: &str,
        limit_window: u64,
    ) -> Result<(u64, i64), rustis::Error> {
        match client
            .evalsha::<(u64, i64)>(RATELIMIT_SCRIPT_SHA.as_str(), [redis_key], [limit_window])
            .await
        {
            Err(err)
                if matches!(
                    err.kind(),
                    ErrorKind::Redis(RedisError {
                        kind: RedisErrorKind::NoScript,
                        ..
                    })
                ) =>
            {
                client
                    .eval::<(u64, i64)>(RATELIMIT_SCRIPT, [redis_key], [limit_window])
                    .await
            }
            result => result,
        }
    }

    pub async fn ratelimit_reached(
        &self,
        limit_identifier: impl AsRef<str>,
        limit: u64,
        client: impl AsRef<str>,
    ) -> bool {
        let key = compact_str::format_compact!(
            "ratelimit::{}::{}",
            limit_identifier.as_ref(),
            client.as_ref()
        );

        let remote = match &self.client {
            Some(redis_client) => {
                let now = chrono::Utc::now().timestamp() as u64;

                if let Some(block) = self.ratelimit_blocks.get(&key).await
                    && block.expire_unix > now + 1
                    && block.limit_used >= limit
                {
                    return true;
                }

                match redis_client
                    .get::<Option<u64>>(self.redis_key(&key).as_ref())
                    .await
                {
                    Ok(limit_used) => Some(limit_used.unwrap_or(0)),
                    Err(err) => {
                        tracing::warn!(
                            "failed to read redis ratelimit for {key}, falling back to local ratelimit: {err:#?}"
                        );

                        None
                    }
                }
            }
            None => None,
        };

        let limit_used = match remote {
            Some(limit_used) => limit_used,
            None => {
                let now = chrono::Utc::now().timestamp() as u64;

                self.local_ratelimits
                    .get(&key)
                    .await
                    .filter(|(_, expire_unix)| *expire_unix > now + 2)
                    .map_or(0, |(limit_used, _)| limit_used)
            }
        };

        limit_used >= limit
    }

    #[tracing::instrument(skip(self))]
    pub async fn lock(
        &self,
        lock_id: impl Into<compact_str::CompactString> + std::fmt::Debug,
        ttl: Option<u64>,
        timeout: Option<u64>,
    ) -> Result<CacheLock, anyhow::Error> {
        let lock_id = lock_id.into();
        let ttl_secs = ttl.unwrap_or(30).max(1);
        let deadline = timeout.map(|ms| Instant::now() + Duration::from_millis(ms));

        tracing::debug!("acquiring cache lock");

        let semaphore = self
            .local_locks
            .lock()
            .entry(lock_id.clone())
            .or_insert_with(|| Arc::new(tokio::sync::Semaphore::new(1)))
            .clone();

        let permit = match deadline {
            Some(dl) => {
                let remaining = dl.saturating_duration_since(Instant::now());
                tokio::time::timeout(remaining, semaphore.acquire_owned())
                    .await
                    .map_err(|_| anyhow::anyhow!("timed out waiting for cache lock `{}`", lock_id))?
                    .map_err(|_| anyhow::anyhow!("semaphore closed for lock `{}`", lock_id))?
            }
            None => semaphore
                .acquire_owned()
                .await
                .map_err(|_| anyhow::anyhow!("semaphore closed for lock `{}`", lock_id))?,
        };

        let Some(redis_client) = &self.client else {
            tracing::debug!("acquired memory cache lock");
            return Ok(CacheLock::new(
                lock_id,
                HeldLock {
                    permit: Some(permit),
                    redis: None,
                },
                ttl_secs,
            ));
        };

        let redis = RedisLock {
            client: redis_client.clone(),
            key: self.redis_key(&format!("lock::{lock_id}")).into(),
            token: rand::distr::Alphanumeric
                .sample_string(&mut rand::rng(), 32)
                .into(),
        };

        // constructed before SET NX so a cancelled acquire still releases its key
        let held = HeldLock {
            permit: Some(permit),
            redis: Some(redis.clone()),
        };

        if !redis.acquire(ttl_secs, deadline).await {
            anyhow::bail!("timed out acquiring redis lock `{}`", lock_id);
        }

        tracing::debug!("acquired redis cache lock");
        Ok(CacheLock::new(lock_id, held, ttl_secs))
    }

    #[tracing::instrument(
        skip(self, fn_compute),
        fields(cache.prefix = %key_prefix(key), cache.outcome = tracing::field::Empty)
    )]
    pub async fn cached<
        T: Serialize + DeserializeOwned + Send,
        F: FnOnce() -> Fut,
        Fut: Future<Output = Result<T, FutErr>>,
        FutErr: Into<anyhow::Error> + Send + Sync + 'static,
    >(
        &self,
        key: &str,
        ttl: u64,
        fn_compute: F,
    ) -> Result<T, anyhow::Error> {
        let effective_moka_ttl = if self.use_internal_cache {
            Duration::from_secs(ttl)
        } else {
            Duration::from_millis(50)
        };

        let start_time = Instant::now();

        if let Some(entry) = self.local.get(key).await {
            let value = rmp_serde::from_slice::<T>(&entry.data);
            tracing::Span::current().record("cache.outcome", "local_hit");
            self.record_call(&self.cache_local_hits, start_time.elapsed());

            return Ok(value?);
        }

        let client_opt = self.client.clone();
        let redis_key = self.redis_key(key);
        let outcome = AtomicU8::new(OUTCOME_COALESCED);

        let entry = self
            .local
            .try_get_with(key.to_compact_string(), {
                let outcome = &outcome;

                async move {
                    if let Some(client) = &client_opt {
                        tracing::debug!("checking redis cache");
                        let cached_value: Option<BulkString> = client
                            .get(redis_key.as_ref())
                            .await
                            .map_err(|err| {
                                tracing::error!("redis get error: {:?}", err);
                                err
                            })
                            .ok()
                            .flatten();

                        if let Some(value) = cached_value {
                            tracing::debug!("found in redis cache");
                            outcome.store(OUTCOME_REMOTE_HIT, Ordering::Relaxed);

                            return Ok(DataEntry {
                                data: Arc::new(value.to_vec()),
                                intended_ttl: effective_moka_ttl,
                            });
                        }
                    }

                    outcome.store(OUTCOME_MISS, Ordering::Relaxed);

                    tracing::debug!("executing compute");
                    let result = fn_compute().await.map_err(|e| e.into())?;
                    tracing::debug!("executed compute");

                    let serialized = rmp_serde::to_vec(&result)?;
                    let serialized_arc = Arc::new(serialized);

                    if let Some(client) = &client_opt {
                        let _ = client
                            .set_with_options(
                                redis_key.as_ref(),
                                BulkStringRef(&serialized_arc),
                                None,
                                SetExpiration::Ex(ttl),
                            )
                            .await;
                    }

                    Ok::<_, anyhow::Error>(DataEntry {
                        data: serialized_arc,
                        intended_ttl: effective_moka_ttl,
                    })
                }
            })
            .await;

        let value = match entry {
            Ok(internal_entry) => {
                rmp_serde::from_slice::<T>(&internal_entry.data).map_err(anyhow::Error::new)
            }
            Err(arc_error) => Err(anyhow::Error::new(SharedComputeError(arc_error))),
        };

        let (bucket, outcome_label) = match outcome.load(Ordering::Relaxed) {
            OUTCOME_REMOTE_HIT => (&self.cache_remote_hits, "remote_hit"),
            OUTCOME_MISS => (&self.cache_misses, "miss"),
            _ => (&self.cache_coalesced_waits, "coalesced_wait"),
        };

        tracing::Span::current().record("cache.outcome", outcome_label);
        self.record_call(bucket, start_time.elapsed());

        value
    }

    fn record_call(&self, bucket: &CacheBucket, elapsed: Duration) {
        let latency_ns = elapsed.as_nanos() as u64;

        bucket.record(latency_ns);
        self.cache_latency_ns_max
            .fetch_max(latency_ns, Ordering::Relaxed);
    }

    pub async fn get<T: DeserializeOwned>(&self, key: &str) -> Result<Option<T>, anyhow::Error> {
        if let Some(entry) = self.local.get(key).await {
            tracing::debug!("get: found in moka cache");
            return Ok(Some(rmp_serde::from_slice::<T>(&entry.data)?));
        }

        if let Some(client) = &self.client {
            tracing::debug!("get: checking redis cache");
            let cached_value: Option<BulkString> = client.get(self.redis_key(key).as_ref()).await?;

            if let Some(value) = cached_value {
                tracing::debug!("get: found in redis cache");
                let data = Arc::new(value.to_vec());
                return Ok(Some(rmp_serde::from_slice::<T>(&data)?));
            }
        }

        Ok(None)
    }

    pub async fn get_raw(&self, key: &str) -> Result<Option<Arc<Vec<u8>>>, anyhow::Error> {
        if let Some(entry) = self.local.get(key).await {
            tracing::debug!("get_raw: found in moka cache");
            return Ok(Some(entry.data.clone()));
        }

        if let Some(client) = &self.client {
            tracing::debug!("get_raw: checking redis cache");
            let cached_value: Option<BulkString> = client.get(self.redis_key(key).as_ref()).await?;

            if let Some(value) = cached_value {
                tracing::debug!("get_raw: found in redis cache");
                return Ok(Some(Arc::new(value.to_vec())));
            }
        }

        Ok(None)
    }

    pub async fn set<T: Serialize + Send + Sync>(
        &self,
        key: &str,
        ttl: u64,
        value: &T,
    ) -> Result<(), anyhow::Error> {
        let serialized = rmp_serde::to_vec(value)?;
        let serialized_arc = Arc::new(serialized);

        let effective_moka_ttl = if self.use_internal_cache {
            Duration::from_secs(ttl)
        } else {
            Duration::from_millis(50)
        };

        self.local
            .insert(
                key.to_compact_string(),
                DataEntry {
                    data: serialized_arc.clone(),
                    intended_ttl: effective_moka_ttl,
                },
            )
            .await;

        if let Some(client) = &self.client {
            client
                .set_with_options(
                    self.redis_key(key).as_ref(),
                    BulkStringRef(&serialized_arc),
                    None,
                    SetExpiration::Ex(ttl),
                )
                .await?;
        }

        Ok(())
    }

    pub async fn set_raw(
        &self,
        key: &str,
        ttl: u64,
        value: impl Into<Arc<Vec<u8>>>,
    ) -> Result<(), anyhow::Error> {
        let serialized_arc = value.into();

        let effective_moka_ttl = if self.use_internal_cache {
            Duration::from_secs(ttl)
        } else {
            Duration::from_millis(50)
        };

        self.local
            .insert(
                key.to_compact_string(),
                DataEntry {
                    data: serialized_arc.clone(),
                    intended_ttl: effective_moka_ttl,
                },
            )
            .await;

        if let Some(client) = &self.client {
            client
                .set_with_options(
                    self.redis_key(key).as_ref(),
                    BulkStringRef(&serialized_arc),
                    None,
                    SetExpiration::Ex(ttl),
                )
                .await?;
        }

        Ok(())
    }

    pub async fn exists(&self, key: &str) -> Result<bool, anyhow::Error> {
        if self.local.contains_key(key) {
            return Ok(true);
        }

        if let Some(client) = &self.client {
            Ok(client.exists(self.redis_key(key).as_ref()).await? > 0)
        } else {
            Ok(false)
        }
    }

    pub async fn list(
        &self,
        prefix: &str,
    ) -> Result<Vec<compact_str::CompactString>, anyhow::Error> {
        if let Some(client) = &self.client {
            let Some(redis_prefix) = &self.redis_prefix else {
                return Ok(client.keys(format!("{prefix}*")).await?);
            };

            let mut pattern = String::with_capacity(redis_prefix.len() + prefix.len() + 1);
            for c in redis_prefix.chars() {
                if matches!(c, '*' | '?' | '[' | ']' | '\\') {
                    pattern.push('\\');
                }
                pattern.push(c);
            }
            pattern.push_str(prefix);
            pattern.push('*');

            let keys: Vec<compact_str::CompactString> = client.keys(pattern).await?;
            Ok(keys
                .into_iter()
                .filter_map(|key| key.strip_prefix(redis_prefix.as_str()).map(Into::into))
                .collect())
        } else {
            let mut keys = Vec::new();
            for (key, _) in self.local.iter() {
                if key.starts_with(prefix) {
                    keys.push(key.to_compact_string());
                }
            }
            Ok(keys)
        }
    }

    pub async fn resolution(&self, key: &str) -> Option<Resolution> {
        self.local_resolutions.get(key).await
    }

    pub async fn resolve<
        F: FnOnce() -> Fut,
        Fut: Future<Output = Result<Resolution, anyhow::Error>>,
    >(
        &self,
        key: &str,
        fn_resolve: F,
    ) -> Result<Resolution, anyhow::Error> {
        self.local_resolutions
            .try_get_with(key.to_compact_string(), fn_resolve())
            .await
            .map_err(|err| anyhow::Error::new(SharedComputeError(err)))
    }

    pub async fn remove_resolution(&self, key: &str) {
        self.local_resolutions.invalidate(key).await;
    }

    pub async fn invalidate(&self, key: &str) -> Result<(), anyhow::Error> {
        self.local.invalidate(key).await;
        if let Some(client) = &self.client {
            client.del(self.redis_key(key).as_ref()).await?;
        }

        Ok(())
    }

    pub fn stats(&self) -> CacheStats {
        CacheStats {
            local_hits: self.cache_local_hits.stats(),
            remote_hits: self.cache_remote_hits.stats(),
            coalesced_waits: self.cache_coalesced_waits.stats(),
            misses: self.cache_misses.stats(),
            max_latency_ns: self.cache_latency_ns_max.load(Ordering::Relaxed),
        }
    }
}

impl Drop for Cache {
    fn drop(&mut self) {
        self.local_task.abort();
        self.local_locks_task.abort();
    }
}

type LocalLocks =
    Arc<parking_lot::Mutex<HashMap<compact_str::CompactString, Arc<tokio::sync::Semaphore>>>>;

#[derive(Clone)]
struct RedisLock {
    client: Arc<Client>,
    key: compact_str::CompactString,
    token: compact_str::CompactString,
}

impl RedisLock {
    async fn acquire(&self, ttl_secs: u64, deadline: Option<Instant>) -> bool {
        loop {
            match self
                .client
                .set_with_options(
                    self.key.as_str(),
                    self.token.as_str(),
                    SetCondition::NX,
                    SetExpiration::Ex(ttl_secs),
                )
                .await
            {
                Ok(true) => return true,
                Ok(false) => {}
                Err(err) => {
                    tracing::warn!(key = %self.key, "failed to acquire redis lock: {err:#?}")
                }
            }

            if let Some(dl) = deadline {
                let remaining = dl.saturating_duration_since(Instant::now());
                if remaining.is_zero() {
                    return false;
                }
                tokio::time::sleep(remaining.min(Duration::from_millis(50))).await;
            } else {
                tokio::time::sleep(Duration::from_millis(50)).await;
            }
        }
    }

    async fn release(self) {
        match tokio::time::timeout(
            Duration::from_secs(2),
            self.client.eval::<i64>(
                LOCK_RELEASE_SCRIPT,
                [self.key.as_str()],
                [self.token.as_str()],
            ),
        )
        .await
        {
            Ok(Ok(_)) => {}
            Ok(Err(err)) => {
                tracing::warn!(key = %self.key, "failed to release redis lock: {err:#?}")
            }
            Err(_) => tracing::warn!(key = %self.key, "timed out releasing redis lock"),
        }
    }
}

struct HeldLock {
    permit: Option<tokio::sync::OwnedSemaphorePermit>,
    redis: Option<RedisLock>,
}

impl HeldLock {
    async fn release(mut self) {
        if let Some(redis) = self.redis.take() {
            redis.release().await;
        }

        self.permit.take();
    }
}

impl Drop for HeldLock {
    fn drop(&mut self) {
        let permit = self.permit.take();

        if let Some(redis) = self.redis.take()
            && let Ok(runtime) = tokio::runtime::Handle::try_current()
        {
            runtime.spawn(async move {
                redis.release().await;
                drop(permit);
            });
        }
    }
}

pub struct CacheLock {
    release_tx: tokio::sync::oneshot::Sender<()>,
}

impl CacheLock {
    fn new(lock_id: compact_str::CompactString, held: HeldLock, ttl_secs: u64) -> Self {
        let (release_tx, release_rx) = tokio::sync::oneshot::channel();

        tokio::spawn(async move {
            tokio::select! {
                _ = release_rx => {}
                _ = tokio::time::sleep(Duration::from_secs(ttl_secs)) => {
                    tracing::warn!(%lock_id, "cache lock TTL expired; releasing");
                }
            }

            held.release().await;
        });

        Self { release_tx }
    }

    #[inline]
    pub fn is_active(&self) -> bool {
        !self.release_tx.is_closed()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::DatabaseError;

    fn memory_only() -> Cache {
        with_client(None)
    }

    fn with_client(client: Option<Arc<Client>>) -> Cache {
        Cache {
            client,
            redis_prefix: None,
            use_internal_cache: true,
            local: moka::future::Cache::builder()
                .max_capacity(16)
                .expire_after(DataExpiry)
                .build(),
            local_task: tokio::spawn(async {}),
            local_locks: LocalLocks::default(),
            local_locks_task: tokio::spawn(async {}),
            local_ratelimits: moka::future::Cache::builder().max_capacity(16).build(),
            ratelimit_blocks: moka::future::Cache::builder()
                .max_capacity(16)
                .expire_after(RatelimitBlockExpiry)
                .build(),
            local_resolutions: moka::future::Cache::builder().max_capacity(16).build(),
            cache_local_hits: CacheBucket::default(),
            cache_remote_hits: CacheBucket::default(),
            cache_coalesced_waits: CacheBucket::default(),
            cache_misses: CacheBucket::default(),
            cache_latency_ns_max: AtomicU64::new(0),
        }
    }

    fn row_not_found() -> anyhow::Error {
        DatabaseError::Sqlx(sqlx::Error::RowNotFound).into()
    }

    fn is_row_not_found(err: &anyhow::Error) -> bool {
        err.chain().any(|err| {
            matches!(
                err.downcast_ref::<DatabaseError>(),
                Some(DatabaseError::Sqlx(sqlx::Error::RowNotFound))
            )
        })
    }

    #[tokio::test]
    async fn ratelimit_reached_reads_without_counting() {
        let cache = memory_only();

        assert!(!cache.ratelimit_reached("test", 2, "client").await);
        assert!(!cache.ratelimit_reached("test", 2, "client").await);

        cache.ratelimit("test", 2, 60, "client").await.unwrap();
        assert!(!cache.ratelimit_reached("test", 2, "client").await);

        cache.ratelimit("test", 2, 60, "client").await.unwrap();
        assert!(cache.ratelimit_reached("test", 2, "client").await);
        assert!(!cache.ratelimit_reached("test", 2, "other").await);
    }

    #[tokio::test]
    async fn ratelimit_allows_exactly_hits_per_window() {
        let cache = memory_only();

        for limit in [1, 3] {
            let client = limit.to_string();

            for _ in 0..limit {
                cache.ratelimit("test", limit, 60, &client).await.unwrap();
            }
            cache
                .ratelimit("test", limit, 60, &client)
                .await
                .unwrap_err();
            cache
                .ratelimit("test", limit, 60, &client)
                .await
                .unwrap_err();
        }
    }

    #[tokio::test]
    async fn cached_calls_are_bucketed_by_outcome() {
        let cache = memory_only();

        cache
            .cached("key", 10, || async {
                tokio::time::sleep(Duration::from_millis(10)).await;
                Ok::<u8, anyhow::Error>(1)
            })
            .await
            .unwrap();
        cache
            .cached("key", 10, || async { Ok::<u8, anyhow::Error>(2) })
            .await
            .unwrap();

        let stats = cache.stats();

        assert_eq!(stats.total_calls(), 2);
        assert_eq!(stats.misses.calls, 1);
        assert_eq!(stats.local_hits.calls, 1);
        assert_eq!(stats.remote_hits.calls, 0);
        assert_eq!(stats.coalesced_waits.calls, 0);

        assert!(stats.misses.average_latency_ns() >= Duration::from_millis(10).as_nanos() as u64);
        assert!(
            stats.local_hits.average_latency_ns() < Duration::from_millis(10).as_nanos() as u64
        );
        assert_eq!(stats.max_latency_ns, stats.misses.average_latency_ns());
    }

    #[tokio::test]
    async fn coalesced_waits_are_not_counted_as_hits() {
        let cache = Arc::new(memory_only());
        let (release, released) = tokio::sync::oneshot::channel::<()>();

        let first = tokio::spawn({
            let cache = Arc::clone(&cache);
            async move {
                cache
                    .cached("key", 10, || async {
                        released.await.unwrap();
                        Ok::<u8, anyhow::Error>(1)
                    })
                    .await
            }
        });
        tokio::time::sleep(Duration::from_millis(20)).await;

        let second = tokio::spawn({
            let cache = Arc::clone(&cache);
            async move {
                cache
                    .cached("key", 10, || async { Ok::<u8, anyhow::Error>(2) })
                    .await
            }
        });
        tokio::time::sleep(Duration::from_millis(20)).await;
        release.send(()).unwrap();

        first.await.unwrap().unwrap();
        second.await.unwrap().unwrap();

        let stats = cache.stats();

        assert_eq!(stats.misses.calls, 1);
        assert_eq!(stats.coalesced_waits.calls, 1);
        assert_eq!(stats.hits().calls, 0);
        assert!(stats.coalesced_waits.average_latency_ns() > 0);
    }

    #[tokio::test]
    async fn sole_caller_receives_the_original_error() {
        let cache = memory_only();

        let err = cache
            .cached("key", 10, || async { Err::<u8, _>(row_not_found()) })
            .await
            .unwrap_err();

        assert!(err.downcast_ref::<SharedComputeError>().is_some());
        assert!(is_row_not_found(&err));
    }

    #[tokio::test]
    async fn coalesced_callers_can_reach_the_original_error() {
        let cache = Arc::new(memory_only());
        let (release, released) = tokio::sync::oneshot::channel::<()>();

        let first = tokio::spawn({
            let cache = Arc::clone(&cache);
            async move {
                cache
                    .cached("key", 10, || async {
                        released.await.unwrap();
                        Err::<u8, _>(row_not_found())
                    })
                    .await
            }
        });
        tokio::time::sleep(Duration::from_millis(20)).await;

        let second = tokio::spawn({
            let cache = Arc::clone(&cache);
            async move {
                cache
                    .cached("key", 10, || async { Ok::<u8, anyhow::Error>(1) })
                    .await
            }
        });
        tokio::time::sleep(Duration::from_millis(20)).await;
        release.send(()).unwrap();

        let first = first.await.unwrap().unwrap_err();
        let second = second.await.unwrap().unwrap_err();

        assert!(is_row_not_found(&first));
        assert!(is_row_not_found(&second));
    }

    async fn redis_backed() -> Option<Cache> {
        let url = std::env::var("TEST_REDIS_URL").ok()?;

        Some(with_client(Some(Arc::new(
            Client::connect(url).await.unwrap(),
        ))))
    }

    fn unique_lock_id() -> String {
        format!("test::{}", uuid::Uuid::new_v4())
    }

    async fn wait_for_key_gone(cache: &Cache, key: &str) -> bool {
        let client = cache.client.as_ref().unwrap();
        for _ in 0..40 {
            if client.exists(key).await.unwrap() == 0 {
                return true;
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }

        false
    }

    // Cache::lock
    #[tokio::test]
    async fn lock_is_exclusive_until_dropped() {
        let cache = memory_only();

        let guard = cache.lock("lock", None, Some(100)).await.unwrap();
        assert!(cache.lock("lock", None, Some(100)).await.is_err());
        cache.lock("other", None, Some(100)).await.unwrap();

        drop(guard);
        cache.lock("lock", None, Some(1000)).await.unwrap();
    }

    #[tokio::test]
    async fn lock_ttl_releases_live_guard() {
        let cache = memory_only();

        let guard = cache.lock("lock", Some(1), None).await.unwrap();
        assert!(guard.is_active());

        let _second = cache.lock("lock", Some(30), Some(2500)).await.unwrap();
        assert!(!guard.is_active());
    }

    #[tokio::test]
    async fn redis_lock_ttl_releases_live_guard_in_process() {
        let Some(cache) = redis_backed().await else {
            return;
        };
        let id = unique_lock_id();

        let guard = cache.lock(id.as_str(), Some(1), None).await.unwrap();
        let second = cache.lock(id.as_str(), Some(30), Some(2500)).await.unwrap();
        assert!(!guard.is_active());

        drop(guard);
        drop(second);
        assert!(wait_for_key_gone(&cache, &format!("lock::{id}")).await);
    }

    #[tokio::test]
    async fn redis_lock_stale_guard_keeps_next_holder() {
        let (Some(holder), Some(contender)) = (redis_backed().await, redis_backed().await) else {
            return;
        };
        let id = unique_lock_id();
        let key = format!("lock::{id}");

        let stale = holder.lock(id.as_str(), Some(1), None).await.unwrap();
        let current = contender
            .lock(id.as_str(), Some(30), Some(2500))
            .await
            .unwrap();

        drop(stale);
        tokio::time::sleep(Duration::from_millis(500)).await;

        let still_held = holder
            .client
            .as_ref()
            .unwrap()
            .exists(key.as_str())
            .await
            .unwrap()
            == 1;
        let still_exclusive = holder.lock(id.as_str(), Some(30), Some(200)).await.is_err();

        drop(current);
        assert!(wait_for_key_gone(&contender, &key).await);
        assert!(still_held);
        assert!(still_exclusive);
    }

    #[tokio::test]
    async fn redis_lock_drop_releases_before_ttl() {
        let (Some(holder), Some(contender)) = (redis_backed().await, redis_backed().await) else {
            return;
        };
        let id = unique_lock_id();
        let key = format!("lock::{id}");

        drop(holder.lock(id.as_str(), Some(30), None).await.unwrap());
        assert!(wait_for_key_gone(&holder, &key).await);

        drop(
            contender
                .lock(id.as_str(), Some(30), Some(500))
                .await
                .unwrap(),
        );
        assert!(wait_for_key_gone(&holder, &key).await);
    }

    #[tokio::test]
    async fn redis_lock_drop_keeps_foreign_holder() {
        let Some(cache) = redis_backed().await else {
            return;
        };
        let id = unique_lock_id();
        let key = format!("lock::{id}");
        let client = cache.client.clone().unwrap();

        let guard = cache.lock(id.as_str(), Some(1), None).await.unwrap();
        client
            .set_with_options(key.as_str(), "foreign", None, SetExpiration::Ex(30))
            .await
            .unwrap();

        drop(guard);
        tokio::time::sleep(Duration::from_millis(1500)).await;

        let value: Option<String> = client.get(key.as_str()).await.unwrap();
        client.del(key.as_str()).await.unwrap();
        assert_eq!(value.as_deref(), Some("foreign"));
    }
}
