use anyhow::Context;
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    net::SocketAddr,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::sync::{RwLock, RwLockReadGuard};
use utoipa::ToSchema;

#[derive(Debug, Clone, Copy, ToSchema, Deserialize, Serialize)]
pub struct NtpOffset {
    offset_micros: i64,
}

impl NtpOffset {
    #[inline]
    pub fn is_negative(self) -> bool {
        self.offset_micros.is_negative()
    }

    #[inline]
    pub fn abs_duration(self) -> Duration {
        Duration::from_micros(self.offset_micros.unsigned_abs())
    }
}

pub struct Ntp {
    last_check: RwLock<Instant>,
    last_result: RwLock<BTreeMap<SocketAddr, NtpOffset>>,
}

impl Ntp {
    pub fn new() -> Arc<Self> {
        let ntp = Arc::new(Self {
            last_check: RwLock::new(Instant::now()),
            last_result: RwLock::new(BTreeMap::new()),
        });

        tokio::spawn({
            let ntp = ntp.clone();

            async move {
                let result = match check_ntp().await {
                    Ok(result) => result,
                    Err(err) => {
                        tracing::error!("error while checking ntp time: {:?}", err);
                        return;
                    }
                };

                ntp.update_result(result).await;
            }
        });

        ntp
    }

    async fn update_result(&self, result: BTreeMap<SocketAddr, NtpOffset>) {
        *self.last_check.write().await = Instant::now();
        *self.last_result.write().await = result;
    }

    pub async fn recheck_ntp(&self) -> Result<(), anyhow::Error> {
        let result = check_ntp().await?;
        self.update_result(result).await;

        Ok(())
    }

    pub async fn get_last_result(&self) -> RwLockReadGuard<'_, BTreeMap<SocketAddr, NtpOffset>> {
        self.last_result.read().await
    }
}

pub async fn check_ntp() -> Result<BTreeMap<SocketAddr, NtpOffset>, anyhow::Error> {
    let socket = tokio::net::UdpSocket::bind("0.0.0.0:0").await?;
    let socket = sntpc_net_tokio::UdpSocketWrapper::from(socket);
    let context = sntpc::NtpContext::new(sntpc::StdTimestampGen::default());

    let pool_ntp_addrs = tokio::net::lookup_host(("pool.ntp.org", 123))
        .await
        .context("failed to resolve pool.ntp.org")?;

    let get_pool_time = async |addr: SocketAddr| {
        tokio::time::timeout(
            Duration::from_secs(2),
            sntpc::get_time(addr, &socket, context),
        )
        .await?
        .map_err(|err| std::io::Error::other(format!("{:?}", err)))
        .context("failed to get time from pool.ntp.org")
    };

    let mut result = BTreeMap::new();

    for pool_ntp_addr in pool_ntp_addrs {
        let pool_time = match get_pool_time(pool_ntp_addr).await {
            Ok(time) => time,
            Err(err) => {
                tracing::warn!("failed to get time from {:?}: {:?}", pool_ntp_addr, err);
                continue;
            }
        };

        result.insert(
            pool_ntp_addr,
            NtpOffset {
                offset_micros: pool_time.offset(),
            },
        );
    }

    Ok(result)
}
