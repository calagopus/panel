use anyhow::Context;
use axum::{extract::ConnectInfo, http::HeaderMap};
use colored::Colorize;
use dotenvy::dotenv;
use std::sync::{Arc, atomic::AtomicBool};
use tracing_subscriber::fmt::writer::MakeWriterExt;

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

pub struct Env {
    pub redis_mode: RedisMode,

    pub sentry_url: Option<String>,
    pub database_migrate: bool,
    pub database_url: String,
    pub database_url_primary: Option<String>,

    pub bind: String,
    pub port: u16,

    pub aio_base_wings_configuration: Option<String>,

    pub app_primary: bool,
    pub app_debug: AtomicBool,
    pub app_enable_wings_proxy: bool,
    pub app_use_decryption_cache: bool,
    pub app_use_internal_cache: bool,
    pub app_trusted_proxies: Vec<cidr::IpCidr>,
    pub app_log_directory: Option<String>,
    pub app_encryption_key: String,
    pub server_name: Option<String>,
}

impl Env {
    pub fn parse() -> Result<(Arc<Self>, EnvGuard), anyhow::Error> {
        dotenv().ok();

        let env = Self {
            redis_mode: match std::env::var("REDIS_MODE")
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
            },

            sentry_url: std::env::var("SENTRY_URL")
                .ok()
                .map(|s| s.trim_matches('"').to_string()),
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
                .unwrap_or("6969".to_string())
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
            app_debug: AtomicBool::new(
                std::env::var("APP_DEBUG")
                    .unwrap_or("false".to_string())
                    .trim_matches('"')
                    .parse()
                    .context("Invalid APP_DEBUG value")?,
            ),
            app_enable_wings_proxy: std::env::var("APP_ENABLE_WINGS_PROXY")
                .unwrap_or("false".to_string())
                .trim_matches('"')
                .parse()
                .context("Invalid APP_ENABLE_WINGS_PROXY value")?,
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
            app_log_directory: std::env::var("APP_LOG_DIRECTORY")
                .ok()
                .map(|s| s.trim_matches('"').to_string()),
            app_encryption_key: std::env::var("APP_ENCRYPTION_KEY")
                .expect("APP_ENCRYPTION_KEY is required")
                .trim_matches('"')
                .to_string(),
            server_name: std::env::var("SERVER_NAME")
                .ok()
                .map(|s| s.trim_matches('"').to_string()),
        };

        if env.app_encryption_key.to_lowercase() == "changeme" {
            println!(
                "{}", "You are using the default APP_ENCRYPTION_KEY. This is unsupported, please modify your .env or your docker compose file.".red()
            );
            std::process::exit(1);
        }

        let (stdout_writer, stdout_guard) = tracing_appender::non_blocking(std::io::stdout());

        let (appender, guard) = if let Some(app_log_directory) = &env.app_log_directory {
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

        if let Some(file_appender) = appender {
            tracing::subscriber::set_global_default(
                tracing_subscriber::fmt()
                    .with_timer(tracing_subscriber::fmt::time::ChronoLocal::rfc_3339())
                    .with_writer(stdout_writer.and(file_appender))
                    .with_target(false)
                    .with_level(true)
                    .with_file(true)
                    .with_line_number(true)
                    .with_max_level(if env.is_debug() {
                        tracing::Level::DEBUG
                    } else {
                        tracing::Level::INFO
                    })
                    .finish(),
            )?;
        } else {
            tracing::subscriber::set_global_default(
                tracing_subscriber::fmt()
                    .with_timer(tracing_subscriber::fmt::time::ChronoLocal::new(
                        "%Y-%m-%d %H:%M:%S %z".to_string(),
                    ))
                    .with_writer(stdout_writer)
                    .with_target(false)
                    .with_level(true)
                    .with_file(true)
                    .with_line_number(true)
                    .with_max_level(if env.is_debug() {
                        tracing::Level::DEBUG
                    } else {
                        tracing::Level::INFO
                    })
                    .finish(),
            )?;
        }

        Ok((Arc::new(env), EnvGuard(guard, stdout_guard)))
    }

    #[inline]
    pub fn find_ip(
        &self,
        headers: &HeaderMap,
        connect_info: ConnectInfo<std::net::SocketAddr>,
    ) -> std::net::IpAddr {
        for cidr in &self.app_trusted_proxies {
            if cidr.contains(&connect_info.ip()) {
                if let Some(forwarded) = headers.get("X-Forwarded-For")
                    && let Ok(forwarded) = forwarded.to_str()
                    && let Some(ip) = forwarded.split(',').next()
                {
                    return ip.parse().unwrap_or_else(|_| connect_info.ip());
                }

                if let Some(forwarded) = headers.get("X-Real-IP")
                    && let Ok(forwarded) = forwarded.to_str()
                {
                    return forwarded.parse().unwrap_or_else(|_| connect_info.ip());
                }
            }
        }

        connect_info.ip()
    }

    #[inline]
    pub fn is_debug(&self) -> bool {
        self.app_debug.load(std::sync::atomic::Ordering::Relaxed)
    }
}
