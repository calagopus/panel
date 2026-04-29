use crate::{env::RedisMode, response::ApiResponse};
use axum::http::StatusCode;
use compact_str::ToCompactString;
use rustis::{
    client::Client,
    commands::{
        GenericCommands, InfoSection, ServerCommands, SetCondition, SetExpiration, StringCommands,
    },
    resp::BulkString,
};
use serde::{Serialize, de::DeserializeOwned};
use std::{
    future::Future,
    sync::{
        Arc,
        atomic::{AtomicU64, Ordering},
    },
    time::{Duration, Instant},
};

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
struct LockEntry {
    semaphore: Arc<tokio::sync::Semaphore>,
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

pub struct Cache {
    client: Option<Arc<Client>>,
    use_internal_cache: bool,
    local: moka::future::Cache<compact_str::CompactString, DataEntry>,
    local_task: tokio::task::JoinHandle<()>,
    local_locks: moka::future::Cache<compact_str::CompactString, LockEntry>,
    local_locks_task: tokio::task::JoinHandle<()>,
    local_ratelimits: moka::future::Cache<compact_str::CompactString, (u64, u64)>,

    cache_calls: AtomicU64,
    cache_latency_ns_total: AtomicU64,
    cache_latency_ns_max: AtomicU64,
    cache_misses: AtomicU64,
}

impl Cache {
    pub async fn new(env: &crate::env::Env) -> Arc<Self> {
        let start = std::time::Instant::now();

        let client = match &env.redis_mode {
            RedisMode::Redis { redis_url } => {
                if let Some(redis_url) = redis_url {
                    Some(Arc::new(Client::connect(redis_url.clone()).await.unwrap()))
                } else {
                    None
                }
            }
            RedisMode::Sentinel {
                cluster_name,
                redis_sentinels,
            } => Some(Arc::new(
                Client::connect(
                    format!(
                        "redis-sentinel://{}/{cluster_name}/0",
                        redis_sentinels.join(",")
                    )
                    .as_str(),
                )
                .await
                .unwrap(),
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

        let local_locks = moka::future::Cache::builder().max_capacity(4096).build();

        let local_locks_task = tokio::spawn({
            let local_locks = local_locks.clone();

            async move {
                loop {
                    tokio::time::sleep(Duration::from_secs(10)).await;
                    local_locks.run_pending_tasks().await;
                }
            }
        });

        let local_ratelimits = moka::future::Cache::builder().max_capacity(16384).build();

        let instance = Arc::new(Self {
            client,
            use_internal_cache: env.app_use_internal_cache,
            local,
            local_task,
            local_locks,
            local_locks_task,
            local_ratelimits,
            cache_calls: AtomicU64::new(0),
            cache_latency_ns_total: AtomicU64::new(0),
            cache_latency_ns_max: AtomicU64::new(0),
            cache_misses: AtomicU64::new(0),
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

    pub async fn version(&self) -> Result<compact_str::CompactString, rustis::Error> {
        let Some(client) = &self.client else {
            return Ok("memory-only".into());
        };

        let version: String = client.info([InfoSection::Server]).await?;
        let version = version
            .lines()
            .find(|line| line.starts_with("redis_version:"))
            .unwrap_or("redis_version:unknown")
            .split(':')
            .nth(1)
            .unwrap_or("unknown")
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

        let now = chrono::Utc::now().timestamp();

        if let Some(redis_client) = &self.client {
            let expiry = redis_client.expiretime(&key).await.unwrap_or_default();
            let expire_unix: u64 = if expiry > now + 2 {
                expiry as u64
            } else {
                now as u64 + limit_window
            };

            let limit_used = redis_client.get::<u64>(&key).await.unwrap_or_default() + 1;
            redis_client
                .set_with_options(key, limit_used, None, SetExpiration::Exat(expire_unix))
                .await?;

            if limit_used >= limit {
                return Err(ApiResponse::error(format!(
                    "you are ratelimited, retry in {}s",
                    expiry - now
                ))
                .with_status(StatusCode::TOO_MANY_REQUESTS)
                .with_header("X-RateLimit-Limit", limit.to_string())
                .with_header(
                    "X-RateLimit-Remaining",
                    limit.saturating_sub(limit_used).to_string(),
                )
                .with_header("X-RateLimit-Reset", expire_unix.to_string())
                .with_header("Retry-After", (expiry - now).to_compact_string()));
            }
        } else {
            let mut current_count = 0;
            let mut expire_unix = now as u64 + limit_window;

            if let Some((count, exp)) = self.local_ratelimits.get(&key).await
                && exp > now as u64 + 2
            {
                current_count = count;
                expire_unix = exp;
            }

            let limit_used = current_count + 1;
            self.local_ratelimits
                .insert(key, (limit_used, expire_unix))
                .await;

            if limit_used >= limit {
                return Err(ApiResponse::error(format!(
                    "you are ratelimited, retry in {}s",
                    expire_unix.saturating_sub(now as u64)
                ))
                .with_status(StatusCode::TOO_MANY_REQUESTS)
                .with_header("X-RateLimit-Limit", limit.to_string())
                .with_header(
                    "X-RateLimit-Remaining",
                    limit.saturating_sub(limit_used).to_string(),
                )
                .with_header("X-RateLimit-Reset", expire_unix.to_string())
                .with_header(
                    "Retry-After",
                    (expire_unix.saturating_sub(now as u64)).to_compact_string(),
                ));
            }
        }

        Ok(())
    }

    #[tracing::instrument(skip(self))]
    pub async fn lock(
        &self,
        lock_id: impl Into<compact_str::CompactString> + std::fmt::Debug,
        ttl: Option<u64>,
        timeout: Option<u64>,
    ) -> Result<CacheLock, anyhow::Error> {
        let lock_id = lock_id.into();
        let redis_key = compact_str::format_compact!("lock::{}", lock_id);
        let ttl_secs = ttl.unwrap_or(30);
        let deadline = timeout.map(|ms| Instant::now() + Duration::from_secs(ms));

        tracing::debug!("acquiring cache lock");

        let entry = self
            .local_locks
            .entry(lock_id.clone())
            .or_insert_with(async {
                LockEntry {
                    semaphore: Arc::new(tokio::sync::Semaphore::new(1)),
                }
            })
            .await
            .into_value();

        let permit = match deadline {
            Some(dl) => {
                let remaining = dl.saturating_duration_since(Instant::now());
                tokio::time::timeout(remaining, entry.semaphore.acquire_owned())
                    .await
                    .map_err(|_| anyhow::anyhow!("timed out waiting for cache lock `{}`", lock_id))?
                    .map_err(|_| anyhow::anyhow!("semaphore closed for lock `{}`", lock_id))?
            }
            None => entry
                .semaphore
                .acquire_owned()
                .await
                .map_err(|_| anyhow::anyhow!("semaphore closed for lock `{}`", lock_id))?,
        };

        if let Some(redis_client) = &self.client {
            match Self::try_acquire_redis_lock(redis_client, &redis_key, ttl_secs, deadline).await?
            {
                true => {
                    tracing::debug!("acquired redis cache lock");
                    Ok(CacheLock::new(
                        lock_id,
                        Some(redis_client.clone()),
                        permit,
                        ttl,
                    ))
                }
                false => anyhow::bail!("timed out acquiring redis lock `{}`", lock_id),
            }
        } else {
            tracing::debug!("acquired memory cache lock");
            Ok(CacheLock::new(lock_id, None, permit, ttl))
        }
    }

    async fn try_acquire_redis_lock(
        client: &Arc<Client>,
        redis_key: &compact_str::CompactString,
        ttl_secs: u64,
        deadline: Option<Instant>,
    ) -> Result<bool, anyhow::Error> {
        loop {
            let acquired = client
                .set_with_options(
                    redis_key.as_str(),
                    "1",
                    SetCondition::NX,
                    SetExpiration::Ex(ttl_secs),
                )
                .await
                .unwrap_or(false);

            if acquired {
                return Ok(true);
            }

            if let Some(dl) = deadline {
                let remaining = dl.saturating_duration_since(Instant::now());
                if remaining.is_zero() {
                    return Ok(false);
                }
                tokio::time::sleep(remaining.min(Duration::from_millis(50))).await;
            } else {
                tokio::time::sleep(Duration::from_millis(50)).await;
            }
        }
    }

    #[tracing::instrument(skip(self, fn_compute))]
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

        let client_opt = self.client.clone();

        self.cache_calls.fetch_add(1, Ordering::Relaxed);
        let start_time = Instant::now();

        let entry = self
            .local
            .try_get_with(key.to_compact_string(), async move {
                if let Some(client) = &client_opt {
                    tracing::debug!("checking redis cache");
                    let cached_value: Option<BulkString> = client
                        .get(key)
                        .await
                        .map_err(|err| {
                            tracing::error!("redis get error: {:?}", err);
                            err
                        })
                        .ok()
                        .flatten();

                    if let Some(value) = cached_value {
                        tracing::debug!("found in redis cache");
                        return Ok(DataEntry {
                            data: Arc::new(value.to_vec()),
                            intended_ttl: effective_moka_ttl,
                        });
                    }
                }

                self.cache_misses.fetch_add(1, Ordering::Relaxed);

                tracing::debug!("executing compute");
                let result = fn_compute().await.map_err(|e| e.into())?;
                tracing::debug!("executed compute");

                let serialized = rmp_serde::to_vec(&result)?;
                let serialized_arc = Arc::new(serialized);

                if let Some(client) = &client_opt {
                    let _ = client
                        .set_with_options(
                            key,
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
            })
            .await;

        let elapsed_ns = start_time.elapsed().as_nanos() as u64;
        self.cache_latency_ns_total
            .fetch_add(elapsed_ns, Ordering::Relaxed);

        let _ = self.cache_latency_ns_max.fetch_update(
            Ordering::Relaxed,
            Ordering::Relaxed,
            |current_max| {
                if elapsed_ns > current_max {
                    Some(elapsed_ns)
                } else {
                    Some(current_max)
                }
            },
        );

        match entry {
            Ok(internal_entry) => Ok(rmp_serde::from_slice::<T>(&internal_entry.data)?),
            Err(arc_error) => Err(anyhow::anyhow!("cache computation failed: {:?}", arc_error)),
        }
    }

    pub async fn get<T: DeserializeOwned>(&self, key: &str) -> Result<Option<T>, anyhow::Error> {
        if let Some(entry) = self.local.get(key).await {
            tracing::debug!("get: found in moka cache");
            return Ok(Some(rmp_serde::from_slice::<T>(&entry.data)?));
        }

        if let Some(client) = &self.client {
            tracing::debug!("get: checking redis cache");
            let cached_value: Option<BulkString> = client.get(key).await?;

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
            let cached_value: Option<BulkString> = client.get(key).await?;

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
                    key,
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
                    key,
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
            Ok(client.exists(key).await? > 0)
        } else {
            Ok(false)
        }
    }

    pub async fn invalidate(&self, key: &str) -> Result<(), anyhow::Error> {
        self.local.invalidate(key).await;
        if let Some(client) = &self.client {
            client.del(key).await?;
        }

        Ok(())
    }

    #[inline]
    pub fn cache_calls(&self) -> u64 {
        self.cache_calls.load(Ordering::Relaxed)
    }

    #[inline]
    pub fn cache_misses(&self) -> u64 {
        self.cache_misses.load(Ordering::Relaxed)
    }

    #[inline]
    pub fn cache_latency_ns_average(&self) -> u64 {
        let calls = self.cache_calls();
        self.cache_latency_ns_total
            .load(Ordering::Relaxed)
            .checked_div(calls)
            .unwrap_or(0)
    }

    #[inline]
    pub fn cache_latency_ns_max(&self) -> u64 {
        self.cache_latency_ns_max.load(Ordering::Relaxed)
    }
}

impl Drop for Cache {
    fn drop(&mut self) {
        self.local_task.abort();
        self.local_locks_task.abort();
    }
}

pub struct CacheLock {
    lock_id: Option<compact_str::CompactString>,
    redis_client: Option<Arc<Client>>,
    permit: Option<tokio::sync::OwnedSemaphorePermit>,
    ttl_guard: Option<tokio::task::JoinHandle<()>>,
}

impl CacheLock {
    fn new(
        lock_id: compact_str::CompactString,
        redis_client: Option<Arc<Client>>,
        permit: tokio::sync::OwnedSemaphorePermit,
        ttl: Option<u64>,
    ) -> Self {
        let ttl_guard = ttl.and_then(|secs| {
            let lock_id_clone = lock_id.clone();
            redis_client.clone().map(|client| {
                tokio::spawn(async move {
                    tokio::time::sleep(Duration::from_secs(secs)).await;
                    tracing::warn!(%lock_id_clone, "cache lock TTL expired; force-releasing");
                    let redis_key = compact_str::format_compact!("lock::{}", lock_id_clone);
                    let _ = client.del(&redis_key).await;
                })
            })
        });

        Self {
            lock_id: Some(lock_id),
            redis_client,
            permit: Some(permit),
            ttl_guard,
        }
    }

    #[inline]
    pub fn is_active(&self) -> bool {
        self.lock_id.is_some() && self.ttl_guard.as_ref().is_none_or(|h| !h.is_finished())
    }
}

impl Drop for CacheLock {
    fn drop(&mut self) {
        if let Some(ttl_guard) = self.ttl_guard.take() {
            ttl_guard.abort();
        }

        self.permit.take();

        if let Some(lock_id) = self.lock_id.take()
            && let Some(client) = self.redis_client.take()
        {
            tokio::spawn(async move {
                let redis_key = compact_str::format_compact!("lock::{}", lock_id);
                let _ = client.del(&redis_key).await;
            });
        }
    }
}
