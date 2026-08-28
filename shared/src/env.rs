use anyhow::Context;
use axum::{extract::ConnectInfo, http::HeaderMap};
use colored::Colorize;
use dotenvy::dotenv;
use std::sync::{Arc, atomic::AtomicBool};
use tracing_subscriber::{
    Layer,
    filter::{LevelFilter, Targets},
    fmt::writer::MakeWriterExt,
    layer::{Layered, SubscriberExt},
    util::SubscriberInitExt,
};

#[derive(Clone)]
pub enum RedisMode {
    Redis {
        redis_url: Option<String>,
    },
    Sentinel {
        cluster_name: String,
        redis_sentinels: Vec<String>,
    },
}

impl std::fmt::Display for RedisMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RedisMode::Redis { .. } => write!(f, "Redis"),
            RedisMode::Sentinel { .. } => write!(f, "Sentinel"),
        }
    }
}

pub struct EnvGuard(
    pub Option<tracing_appender::non_blocking::WorkerGuard>,
    pub tracing_appender::non_blocking::WorkerGuard,
);

type ReloadHandle =
    tracing_subscriber::reload::Handle<Targets, Layered<LevelFilter, tracing_subscriber::Registry>>;

fn log_filter(debug: bool) -> Targets {
    let crate_level = if debug {
        LevelFilter::DEBUG
    } else {
        LevelFilter::INFO
    };

    Targets::new()
        .with_default(LevelFilter::INFO)
        .with_target("backend", crate_level)
        .with_target("database_migrator", crate_level)
        .with_target("shared", crate_level)
        .with_target("panel_rs", crate_level)
        .with_target("panel_rs_aio", crate_level)
}

fn default_blocked_cidrs() -> Vec<cidr::IpCidr> {
    const DEFAULTS: [&str; 17] = [
        "0.0.0.0/8",
        "127.0.0.0/8",
        "10.0.0.0/8",
        "100.64.0.0/10",
        "172.16.0.0/12",
        "192.168.0.0/16",
        "169.254.0.0/16",
        "192.0.0.0/24",
        "198.18.0.0/15",
        "224.0.0.0/4",
        "240.0.0.0/4",
        "::/128",
        "::1/128",
        "fe80::/10",
        "fc00::/7",
        "2002::/16",
        "ff00::/8",
    ];

    DEFAULTS
        .iter()
        .map(|cidr| cidr.parse().expect("invalid default blocked cidr"))
        .collect()
}

pub struct Env {
    log_reload_handle: ReloadHandle,

    pub redis_mode: RedisMode,

    pub sentry_url: Option<String>,
    pub sentry_tracing_sample_rate: f32,

    pub database_migrate: bool,
    pub database_url: String,
    pub database_url_primary: Option<String>,

    pub bind: String,
    pub port: u16,

    pub aio_base_wings_configuration: Option<String>,

    pub app_primary: bool,
    pub app_debug_default: bool,
    app_debug: AtomicBool,
    pub app_enable_wings_proxy: bool,
    pub app_disable_frontend: bool,
    pub app_use_decryption_cache: bool,
    pub app_use_internal_cache: bool,
    pub app_trusted_proxies: Vec<cidr::IpCidr>,
    pub app_blocked_cidrs: Vec<cidr::IpCidr>,
    pub app_log_directory: Option<String>,
    pub app_encryption_key: String,
    pub server_name: Option<String>,
}

impl Env {
    pub fn parse() -> Result<(Arc<Self>, EnvGuard), anyhow::Error> {
        dotenv().ok();

        let redis_mode = match std::env::var("REDIS_MODE")
            .unwrap_or("redis".to_string())
            .trim_matches('"')
        {
            "redis" => RedisMode::Redis {
                redis_url: std::env::var("REDIS_URL")
                    .ok()
                    .map(|s| s.trim_matches('"').to_string()),
            },
            "sentinel" => RedisMode::Sentinel {
                cluster_name: std::env::var("REDIS_SENTINEL_CLUSTER")
                    .context("REDIS_SENTINEL_CLUSTER is required")?
                    .trim_matches('"')
                    .to_string(),
                redis_sentinels: std::env::var("REDIS_SENTINELS")
                    .context("REDIS_SENTINELS is required")?
                    .trim_matches('"')
                    .split(',')
                    .map(|s| s.to_string())
                    .collect(),
            },
            _ => {
                return Err(anyhow::anyhow!(
                    "Invalid REDIS_MODE. Expected 'redis' or 'sentinel'."
                ));
            }
        };

        let app_debug_default = std::env::var("APP_DEBUG")
            .unwrap_or("false".to_string())
            .trim_matches('"')
            .parse()
            .context("Invalid APP_DEBUG value")?;

        let app_encryption_key = std::env::var("APP_ENCRYPTION_KEY")
            .expect("APP_ENCRYPTION_KEY is required")
            .trim_matches('"')
            .to_string();

        if app_encryption_key.to_lowercase() == "changeme" {
            println!(
                "{}", "You are using the default APP_ENCRYPTION_KEY. This is unsupported, please modify your .env or your docker compose file.".red()
            );
            std::process::exit(1);
        }

        let app_log_directory = std::env::var("APP_LOG_DIRECTORY")
            .ok()
            .map(|s| s.trim_matches('"').to_string());

        let (stdout_writer, stdout_guard) = tracing_appender::non_blocking(std::io::stdout());

        let (appender, file_guard) = if let Some(app_log_directory) = &app_log_directory {
            if !std::path::Path::new(app_log_directory).exists() {
                std::fs::create_dir_all(app_log_directory)
                    .context("failed to create log directory")?;
            }

            let latest_log_path = std::path::Path::new(&app_log_directory).join("panel.log");
            let latest_file = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&latest_log_path)
                .context("failed to open latest log file")?;

            let rolling_appender = tracing_appender::rolling::Builder::new()
                .filename_prefix("panel")
                .filename_suffix("log")
                .max_log_files(30)
                .rotation(tracing_appender::rolling::Rotation::DAILY)
                .build(app_log_directory)
                .context("failed to create rolling log file appender")?;

            let (appender, guard) = tracing_appender::non_blocking::NonBlockingBuilder::default()
                .buffered_lines_limit(50)
                .finish(latest_file.and(rolling_appender));

            (Some(appender), Some(guard))
        } else {
            (None, None)
        };

        let initial_filter = log_filter(app_debug_default);
        let (reload_layer, log_reload_handle) =
            tracing_subscriber::reload::Layer::new(initial_filter);

        let fmt_layer = tracing_subscriber::fmt::layer()
            .with_timer(tracing_subscriber::fmt::time::ChronoLocal::new(
                "%Y-%m-%d %H:%M:%S %z".to_string(),
            ))
            .with_target(false)
            .with_level(true)
            .with_file(true)
            .with_line_number(true);

        let fmt_layer = if let Some(file_appender) = appender {
            fmt_layer
                .with_writer(stdout_writer.and(file_appender))
                .boxed()
        } else {
            fmt_layer.with_writer(stdout_writer).boxed()
        };

        tracing_subscriber::registry()
            .with(LevelFilter::DEBUG)
            .with(reload_layer)
            .with(fmt_layer)
            .try_init()
            .context("failed to install tracing subscriber")?;

        let env = Self {
            log_reload_handle,

            redis_mode,

            sentry_url: std::env::var("SENTRY_URL")
                .ok()
                .map(|s| s.trim_matches('"').to_string()),
            sentry_tracing_sample_rate: std::env::var("SENTRY_TRACING_SAMPLE_RATE")
                .unwrap_or("1.0".to_string())
                .trim_matches('"')
                .parse()
                .context("Invalid SENTRY_TRACING_SAMPLE_RATE value")?,

            database_migrate: std::env::var("DATABASE_MIGRATE")
                .unwrap_or("false".to_string())
                .trim_matches('"')
                .parse()
                .unwrap(),
            database_url: std::env::var("DATABASE_URL")
                .context("DATABASE_URL is required")?
                .trim_matches('"')
                .to_string(),
            database_url_primary: std::env::var("DATABASE_URL_PRIMARY")
                .ok()
                .map(|s| s.trim_matches('"').to_string()),

            bind: std::env::var("BIND")
                .unwrap_or("0.0.0.0".to_string())
                .trim_matches('"')
                .to_string(),
            port: std::env::var("PORT")
                .unwrap_or("8000".to_string())
                .parse()
                .context("Invalid PORT value")?,

            aio_base_wings_configuration: std::env::var("AIO_BASE_WINGS_CONFIGURATION")
                .ok()
                .map(|s| s.trim_matches('"').to_string()),

            app_primary: std::env::var("APP_PRIMARY")
                .unwrap_or("true".to_string())
                .trim_matches('"')
                .parse()
                .context("Invalid APP_PRIMARY value")?,
            app_debug_default,
            app_debug: AtomicBool::new(app_debug_default),
            app_enable_wings_proxy: std::env::var("APP_ENABLE_WINGS_PROXY")
                .unwrap_or("false".to_string())
                .trim_matches('"')
                .parse()
                .context("Invalid APP_ENABLE_WINGS_PROXY value")?,
            app_disable_frontend: std::env::var("APP_DISABLE_FRONTEND")
                .unwrap_or("false".to_string())
                .trim_matches('"')
                .parse()
                .context("Invalid APP_DISABLE_FRONTEND value")?,
            app_use_decryption_cache: std::env::var("APP_USE_DECRYPTION_CACHE")
                .unwrap_or("false".to_string())
                .trim_matches('"')
                .parse()
                .context("Invalid APP_USE_DECRYPTION_CACHE value")?,
            app_use_internal_cache: std::env::var("APP_USE_INTERNAL_CACHE")
                .unwrap_or("true".to_string())
                .trim_matches('"')
                .parse()
                .context("Invalid APP_USE_INTERNAL_CACHE value")?,
            app_trusted_proxies: std::env::var("APP_TRUSTED_PROXIES")
                .unwrap_or("".to_string())
                .trim_matches('"')
                .split(',')
                .filter_map(|s| if s.is_empty() { None } else { s.parse().ok() })
                .collect(),
            app_blocked_cidrs: match std::env::var("APP_BLOCKED_CIDRS") {
                Ok(cidrs) => cidrs
                    .trim_matches('"')
                    .split(',')
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
                    .map(str::parse)
                    .collect::<Result<_, _>>()
                    .context("Invalid APP_BLOCKED_CIDRS value")?,
                Err(_) => default_blocked_cidrs(),
            },
            app_log_directory,
            app_encryption_key,
            server_name: std::env::var("SERVER_NAME")
                .ok()
                .map(|s| s.trim_matches('"').to_string()),
        };

        Ok((Arc::new(env), EnvGuard(file_guard, stdout_guard)))
    }

    #[inline]
    pub fn find_ip(
        &self,
        headers: &HeaderMap,
        connect_info: ConnectInfo<std::net::SocketAddr>,
    ) -> std::net::IpAddr {
        let peer = connect_info.ip();

        if !self
            .app_trusted_proxies
            .iter()
            .any(|cidr| cidr.contains(&peer))
        {
            return peer;
        }

        fn find_forwarded_ip(
            forwarded: &str,
            trusted_proxies: &[cidr::IpCidr],
        ) -> Option<std::net::IpAddr> {
            for entry in forwarded.rsplit(',') {
                let ip: std::net::IpAddr = entry.trim().parse().ok()?;

                if !trusted_proxies.iter().any(|cidr| cidr.contains(&ip)) {
                    return Some(ip);
                }
            }

            None
        }

        if let Some(forwarded) = headers.get("X-Forwarded-For")
            && let Ok(forwarded) = forwarded.to_str()
            && let Some(ip) = find_forwarded_ip(forwarded, &self.app_trusted_proxies)
        {
            return ip;
        }

        if let Some(forwarded) = headers.get("X-Real-IP")
            && let Ok(forwarded) = forwarded.to_str()
            && let Ok(ip) = forwarded.trim().parse()
        {
            return ip;
        }

        peer
    }

    #[inline]
    pub fn is_debug(&self) -> bool {
        self.app_debug.load(std::sync::atomic::Ordering::Relaxed)
    }

    pub fn set_debug(&self, debug: bool) -> Result<(), anyhow::Error> {
        self.app_debug
            .store(debug, std::sync::atomic::Ordering::Relaxed);

        self.log_reload_handle
            .modify(|filter| *filter = log_filter(debug))
            .context("failed to reload tracing level filter")?;

        Ok(())
    }
}
