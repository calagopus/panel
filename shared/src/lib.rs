//! Shared library for the Calagopus Panel.
//!
//! This library contains code that is shared between the backend and extensions.
//! It includes models, utilities, and other common functionality to avoid repetition
//! and ensure consistency across the project. If something for a job exists in here,
//! it's generally preferred to be used instead of re-implementing it elsewhere.

use anyhow::Context;
use colored::Colorize;
use include_dir::Dir;
use serde::{Deserialize, Serialize};
use std::{
    borrow::Cow,
    sync::{Arc, LazyLock, OnceLock},
    time::Instant,
};
use tokio::sync::RwLock;
use tower::util::ServiceExt;
use utoipa::ToSchema;

pub mod cache;
pub mod cap;
pub mod captcha;
pub mod censor;
pub mod crypt;
pub mod database;
pub mod deserialize;
pub mod env;
pub mod events;
pub mod extensions;
pub mod extract;
pub mod git;
#[cfg(unix)]
pub mod heavy;
pub mod icons;
pub mod ignore_list;
pub mod jwt;
pub mod mail;
pub mod models;
pub mod net;
pub mod ntp;
pub mod payload;
pub mod permissions;
pub mod prelude;
pub mod response;
pub mod retry;
pub mod settings;
pub mod storage;
pub mod telemetry;
pub mod tunnel;
pub mod updates;
pub mod utils;

pub use payload::Payload;
pub use schema_extension_core::Extendible;

pub const VERSION: &str = env!("CARGO_PKG_VERSION");
pub const GIT_COMMIT: &str = env!("CARGO_GIT_COMMIT");
pub const GIT_BRANCH: &str = env!("CARGO_GIT_BRANCH");
pub const TARGET: &str = env!("CARGO_TARGET");

pub fn full_version() -> String {
    if GIT_BRANCH == "unknown" {
        VERSION.to_string()
    } else {
        format!("{VERSION}:{GIT_COMMIT}@{GIT_BRANCH}")
    }
}

pub const BUFFER_SIZE: usize = 32 * 1024;

pub type GetIp = axum::extract::Extension<std::net::IpAddr>;

#[derive(Clone, Default)]
pub struct RequestHost(pub Option<compact_str::CompactString>);

impl RequestHost {
    #[inline]
    pub fn as_deref(&self) -> Option<&str> {
        self.0.as_deref()
    }
}

pub type GetRequestHost = axum::extract::Extension<RequestHost>;

#[derive(ToSchema, Serialize)]
pub struct ApiError {
    pub errors: Vec<String>,
}

impl ApiError {
    #[inline]
    pub fn new_value(errors: &[&str]) -> serde_json::Value {
        serde_json::json!({
            "errors": errors,
        })
    }

    #[inline]
    pub fn new_strings_value(errors: Vec<String>) -> serde_json::Value {
        serde_json::json!({
            "errors": errors,
        })
    }

    #[inline]
    pub fn new_wings_value(error: wings_api::ApiError) -> serde_json::Value {
        serde_json::json!({
            "errors": [error.error],
        })
    }

    #[inline]
    pub fn new_database_agent_value(error: db_agent_api::ApiError) -> serde_json::Value {
        serde_json::json!({
            "errors": [error.error],
        })
    }
}

#[derive(Debug, ToSchema, Deserialize, Serialize, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum AppContainerType {
    Official,
    #[serde(rename = "official_aio")]
    OfficialAIO,
    OfficialHeavy,
    #[serde(rename = "official_heavy_aio")]
    OfficialHeavyAIO,
    Unknown,
    None,
}

impl AppContainerType {
    pub fn detect() -> Self {
        match std::env::var("OCI_CONTAINER").as_deref() {
            Ok("official") => AppContainerType::Official,
            Ok("official-aio") => AppContainerType::OfficialAIO,
            Ok("official-heavy") => AppContainerType::OfficialHeavy,
            Ok("official-heavy-aio") => AppContainerType::OfficialHeavyAIO,
            Ok(_) => AppContainerType::Unknown,
            Err(_) => AppContainerType::None,
        }
    }

    #[inline]
    pub fn is_all_in_one(&self) -> bool {
        matches!(
            self,
            AppContainerType::OfficialAIO | AppContainerType::OfficialHeavyAIO
        )
    }

    #[inline]
    pub fn is_heavy(&self) -> bool {
        matches!(
            self,
            AppContainerType::OfficialHeavy | AppContainerType::OfficialHeavyAIO
        )
    }
}

pub struct AppState {
    pub start_time: Instant,
    pub container_type: AppContainerType,
    pub version: String,

    pub client: reqwest::Client,
    pub app_router: RwLock<Option<axum::Router>>,

    pub extensions: Arc<extensions::manager::ExtensionManager>,
    pub updates: Arc<updates::UpdateManager>,
    pub background_tasks: Arc<extensions::background_tasks::BackgroundTaskManager>,
    pub shutdown_handlers: Arc<extensions::shutdown_handlers::ShutdownHandlerManager>,
    pub settings: Arc<settings::Settings>,
    pub jwt: Arc<jwt::Jwt>,
    pub ntp: Arc<ntp::Ntp>,
    pub storage: Arc<storage::Storage>,
    pub captcha: Arc<captcha::Captcha>,
    pub mail: Arc<mail::Mail>,
    pub database: Arc<database::Database>,
    pub cache: Arc<cache::Cache>,
    pub env: Arc<env::Env>,
}

impl AppState {
    pub fn ensure_extension_management(&self) -> Result<(), response::ApiResponse> {
        if !self.container_type.is_heavy() {
            return Err(response::ApiResponse::error(
                "extension management is only available in the official heavy container",
            )
            .with_status(axum::http::StatusCode::NOT_IMPLEMENTED));
        }

        if self.env.app_disable_extension_management {
            return Err(response::ApiResponse::error(
                "extension management has been disabled by an administrator",
            )
            .with_status(axum::http::StatusCode::FORBIDDEN));
        }

        Ok(())
    }

    pub async fn new_cli(env: Option<Arc<env::Env>>) -> Result<State, anyhow::Error> {
        let env = match env {
            Some(env) => env,
            None => {
                eprintln!(
                    "{}",
                    "please setup the new panel environment before using this command.".red()
                );
                std::process::exit(1);
            }
        };

        let jwt = Arc::new(jwt::Jwt::new(&env).context("failed to initialize JWT")?);
        let ntp = ntp::Ntp::new();
        let cache = cache::Cache::new(&env).await;
        let database = Arc::new(database::Database::new(&env, cache.clone()).await);

        let background_tasks =
            Arc::new(extensions::background_tasks::BackgroundTaskManager::default());
        let shutdown_handlers =
            Arc::new(extensions::shutdown_handlers::ShutdownHandlerManager::default());
        let settings = Arc::new(
            settings::Settings::new(database.clone())
                .await
                .context("failed to load settings")?,
        );
        let storage = Arc::new(storage::Storage::new(settings.clone()));
        let captcha = Arc::new(captcha::Captcha::new(settings.clone()));
        let mail = Arc::new(mail::Mail::new(settings.clone()));

        let state = Arc::new(AppState {
            start_time: Instant::now(),
            container_type: AppContainerType::detect(),
            version: full_version(),

            client: reqwest::ClientBuilder::new()
                .user_agent(format!("github.com/calagopus/panel {}", VERSION))
                .connect_timeout(std::time::Duration::from_secs(10))
                .read_timeout(std::time::Duration::from_secs(60))
                .build()
                .unwrap(),
            app_router: RwLock::new(None),

            extensions: Arc::new(extensions::manager::ExtensionManager::new(vec![])),
            updates: Arc::new(updates::UpdateManager::default()),
            background_tasks: background_tasks.clone(),
            shutdown_handlers: shutdown_handlers.clone(),
            settings: settings.clone(),
            jwt,
            ntp,
            storage,
            captcha,
            mail,
            database: database.clone(),
            cache: cache.clone(),
            env: env.clone(),
        });

        Ok(state)
    }

    pub async fn send_router_oneshot(
        &self,
        req: axum::http::Request<axum::body::Body>,
    ) -> Result<axum::http::Response<axum::body::Body>, anyhow::Error> {
        let routes_service = self.app_router.read().await;
        let routes_service = routes_service
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("router not initialized"))?;
        let routes_service = routes_service.clone();

        let svc = routes_service.oneshot(req);
        match svc.await {
            Ok(res) => Ok(res),
            Err(err) => Err(anyhow::anyhow!(
                "failed to process request in oneshot router: {:#?}",
                err
            )),
        }
    }

    pub async fn send_authenticated_router_oneshot(
        &self,
        mut req: axum::http::Request<axum::body::Body>,
        user: models::user::User,
        auth_method: models::user::AuthMethod,
    ) -> Result<axum::http::Response<axum::body::Body>, anyhow::Error> {
        let routes_service = self.app_router.read().await;
        let routes_service = routes_service
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("router not initialized"))?;
        let routes_service = routes_service.clone();

        req.extensions_mut().insert((user, auth_method));

        let svc = routes_service.oneshot(req);
        match svc.await {
            Ok(res) => Ok(res),
            Err(err) => Err(anyhow::anyhow!(
                "failed to process request in oneshot router: {:#?}",
                err
            )),
        }
    }
}

pub type State = Arc<AppState>;
pub type GetState = axum::extract::State<State>;

#[inline(always)]
#[cold]
fn cold_path() {}

#[inline(always)]
pub fn likely(b: bool) -> bool {
    if b {
        true
    } else {
        cold_path();
        false
    }
}

#[inline(always)]
pub fn unlikely(b: bool) -> bool {
    if b {
        cold_path();
        true
    } else {
        false
    }
}

pub struct EmbeddedFrontend {
    pub assets: &'static Dir<'static>,
    pub index_html: &'static str,
}

static EMBEDDED_FRONTEND: OnceLock<EmbeddedFrontend> = OnceLock::new();

pub fn register_frontend(frontend: EmbeddedFrontend) {
    EMBEDDED_FRONTEND.set(frontend).ok();
}

fn frontend_assets() -> &'static Dir<'static> {
    static EMPTY: Dir<'static> = Dir::new("", &[]);

    EMBEDDED_FRONTEND
        .get()
        .map_or(&EMPTY, |frontend| frontend.assets)
}

pub fn frontend_index_html() -> Option<&'static str> {
    EMBEDDED_FRONTEND.get().map(|frontend| frontend.index_html)
}

pub struct FrontendAsset {
    pub path: &'static str,
    pub contents: &'static [u8],
    pub gzipped: bool,
}

impl FrontendAsset {
    pub fn decompressed(&self) -> Result<Cow<'static, [u8]>, std::io::Error> {
        if !self.gzipped {
            return Ok(Cow::Borrowed(self.contents));
        }

        let mut decompressed = Vec::with_capacity(self.contents.len() * 4);
        std::io::Read::read_to_end(
            &mut flate2::read::GzDecoder::new(self.contents),
            &mut decompressed,
        )?;

        Ok(Cow::Owned(decompressed))
    }
}

pub fn frontend_asset(path: &str) -> Option<FrontendAsset> {
    if let Some(file) = frontend_assets().get_file(path) {
        return Some(FrontendAsset {
            path: file.path().to_str()?,
            contents: file.contents(),
            gzipped: false,
        });
    }

    let file = frontend_assets().get_file(format!("{path}.gz"))?;

    Some(FrontendAsset {
        path: file.path().to_str()?.strip_suffix(".gz")?,
        contents: file.contents(),
        gzipped: true,
    })
}

pub static FRONTEND_LANGUAGES: LazyLock<Vec<compact_str::CompactString>> = LazyLock::new(|| {
    let mut languages = Vec::new();

    let Some(translations) = frontend_assets().get_dir("translations") else {
        return languages;
    };

    for translation in translations.files() {
        let Some(file_name) = translation.path().file_name() else {
            continue;
        };
        let file_name = file_name.to_string_lossy();
        let file_name = file_name.strip_suffix(".gz").unwrap_or(&file_name);
        let Some(lang) = file_name.strip_suffix(".json") else {
            continue;
        };

        languages.push(lang.into());
    }

    languages
});
