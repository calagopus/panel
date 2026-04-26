//! Shared library for the Calagopus Panel.
//!
//! This library contains code that is shared between the backend and extensions.
//! It includes models, utilities, and other common functionality to avoid repetition
//! and ensure consistency across the project. If something for a job exists in here,
//! it's generally preferred to be used instead of re-implementing it elsewhere.

use anyhow::Context;
use colored::Colorize;
use include_dir::{Dir, include_dir};
use serde::{Deserialize, Serialize};
use std::{
    sync::{Arc, LazyLock},
    time::Instant,
};
use tokio::sync::RwLock;
use tower::util::ServiceExt;
use utoipa::ToSchema;

pub mod cache;
pub mod cap;
pub mod captcha;
pub mod database;
pub mod deserialize;
pub mod env;
pub mod events;
pub mod extensions;
pub mod extract;
pub mod heavy;
pub mod jwt;
pub mod mail;
pub mod models;
pub mod ntp;
pub mod payload;
pub mod permissions;
pub mod prelude;
pub mod response;
pub mod settings;
pub mod storage;
pub mod telemetry;
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
}

#[derive(Debug, ToSchema, Deserialize, Serialize, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum AppContainerType {
    Official,
    OfficialAIO,
    OfficialHeavy,
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

        let jwt = Arc::new(jwt::Jwt::new(&env));
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

pub const FRONTEND_ASSETS: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/../frontend/dist");

pub static FRONTEND_LANGUAGES: LazyLock<Vec<compact_str::CompactString>> = LazyLock::new(|| {
    let mut languages = Vec::new();

    let Some(translations) = FRONTEND_ASSETS.get_dir("translations") else {
        return languages;
    };

    for translation in translations.files() {
        let Some(file_name) = translation.path().file_name() else {
            continue;
        };

        languages.push(file_name.to_string_lossy().trim_end_matches(".json").into());
    }

    languages
});
