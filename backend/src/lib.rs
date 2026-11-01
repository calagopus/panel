use anyhow::Context;
use axum::{
    body::Body,
    extract::{ConnectInfo, FromRequestParts, Request, ws::WebSocketUpgrade},
    http::{HeaderValue, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use colored::Colorize;
use compact_str::ToCompactString;
use hyper::body::Body as _;
use sentry_tower::{NewSentryLayer, SentryHttpLayer};
use sha2::Digest;
use shared::{
    ApiError, GetIp, GetState,
    extensions::commands::CliCommandGroupBuilder,
    models::{ByUuid, node::Node},
    response::ApiResponse,
};
use std::{
    borrow::Cow,
    net::SocketAddr,
    sync::{
        Arc, LazyLock, OnceLock,
        atomic::{AtomicU64, AtomicUsize, Ordering},
    },
    time::Instant,
};
use tokio::sync::RwLock;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tower_cookies::CookieManagerLayer;
use utoipa::openapi::security::{ApiKey, ApiKeyValue, SecurityScheme};
use utoipa_axum::router::OpenApiRouter;

pub static EXTENSIONS: OnceLock<Arc<shared::extensions::manager::ExtensionManager>> =
    OnceLock::new();
pub static CLAP_COMMAND: OnceLock<clap::Command> = OnceLock::new();

pub mod commands;
pub mod routes;
pub mod tasks;

struct RequestLogBudget {
    second: AtomicU64,
    logged: AtomicUsize,
    suppressed: AtomicU64,
}

impl RequestLogBudget {
    fn take(&self, limit: usize) -> (bool, u64) {
        static START: LazyLock<Instant> = LazyLock::new(Instant::now);

        let now = START.elapsed().as_secs();
        let second = self.second.load(Ordering::Relaxed);
        let suppressed = if second != now
            && self
                .second
                .compare_exchange(second, now, Ordering::AcqRel, Ordering::Relaxed)
                .is_ok()
        {
            self.logged.store(0, Ordering::Relaxed);
            self.suppressed.swap(0, Ordering::Relaxed)
        } else {
            0
        };

        if self.logged.fetch_add(1, Ordering::Relaxed) < limit {
            (true, suppressed)
        } else {
            self.suppressed.fetch_add(1, Ordering::Relaxed);
            (false, suppressed)
        }
    }
}

static REQUEST_LOG_BUDGET: RequestLogBudget = RequestLogBudget {
    second: AtomicU64::new(0),
    logged: AtomicUsize::new(0),
    suppressed: AtomicU64::new(0),
};

pub async fn handle_request(
    state: GetState,
    connect_info: ConnectInfo<SocketAddr>,
    mut req: Request<Body>,
    next: Next,
) -> Result<Response<Body>, StatusCode> {
    let ip = state.env.find_ip(req.headers(), connect_info);
    let host = state.env.find_host(req.headers(), req.uri(), connect_info);

    req.extensions_mut().insert(ip);
    req.extensions_mut().insert(shared::RequestHost(host));

    let limit = state.env.app_request_log_limit;
    let (log, suppressed) = if limit == 0 {
        (true, 0)
    } else {
        REQUEST_LOG_BUDGET.take(limit)
    };

    if suppressed > 0 {
        tracing::info!(
            "suppressed {} http request log lines (APP_REQUEST_LOG_LIMIT = {})",
            suppressed,
            limit
        );
    }

    if log {
        tracing::info!(
            path = req.uri().path(),
            query = %shared::utils::redact_query(req.uri().query().unwrap_or_default()),
            "http {}",
            req.method().to_string().to_lowercase(),
        );
    }

    Ok(shared::response::APP_DEBUG
        .scope(state.env.is_debug(), async {
            shared::response::ACCEPT_HEADER
                .scope(
                    shared::response::accept_from_headers(req.headers()),
                    async { next.run(req).await },
                )
                .await
        })
        .await)
}

// authorization is deliberately absent: browsers never auto-attach it, and the node token
// checks in the admin/oobe UI send it through the proxy on purpose. cookie must stay stripped:
// browsers do auto-attach the panel session to this origin.
const STRIPPED_PROXY_REQUEST_HEADERS: &[&str] = &[
    "calagopus-user",
    "cf-connecting-ip",
    "connection",
    "content-length",
    "cookie",
    "forwarded",
    "host",
    "keep-alive",
    "proxy-authorization",
    "proxy-connection",
    "sec-websocket-accept",
    "sec-websocket-extensions",
    "sec-websocket-key",
    "sec-websocket-version",
    "te",
    "trailer",
    "transfer-encoding",
    "true-client-ip",
    "upgrade",
    "x-client-ip",
    "x-forwarded-for",
    "x-forwarded-host",
    "x-forwarded-port",
    "x-forwarded-proto",
    "x-real-ip",
    "x-real-ip-token",
];

#[inline]
fn is_stripped_proxy_request_header(name: &axum::http::HeaderName) -> bool {
    STRIPPED_PROXY_REQUEST_HEADERS.contains(&name.as_str())
}

fn frontend_asset_content_type(asset: &shared::FrontendAsset) -> &'static str {
    match std::path::Path::new(asset.path)
        .extension()
        .and_then(|ext| ext.to_str())
    {
        Some("html") => "text/html",
        Some("js") => "application/javascript",
        Some("css") => "text/css",
        Some("json") => "application/json",
        Some("webmanifest") => "application/manifest+json",
        _ => match shared::storage::content_type(asset.path) {
            "application/octet-stream" if !asset.gzipped => infer::get(asset.contents)
                .map_or("application/octet-stream", |kind| kind.mime_type()),
            content_type => content_type,
        },
    }
}

#[derive(Clone, Copy)]
struct CompressionPredicate;

impl CompressionPredicate {
    const MIN_SIZE: u64 = 1024;
    const CONTENT_TYPES: &[&str] = &[
        "application/json",
        "application/javascript",
        "application/manifest+json",
        "application/msgpack",
        "application/xml",
        "application/yaml",
        "image/svg+xml",
        "text/",
    ];
}

impl tower_http::compression::Predicate for CompressionPredicate {
    fn should_compress<B: hyper::body::Body>(&self, response: &Response<B>) -> bool {
        response
            .body()
            .size_hint()
            .exact()
            .is_some_and(|size| size >= Self::MIN_SIZE)
            && response
                .headers()
                .get(axum::http::header::CONTENT_TYPE)
                .and_then(|value| value.to_str().ok())
                .is_some_and(|content_type| {
                    content_type != "text/event-stream"
                        && Self::CONTENT_TYPES
                            .iter()
                            .any(|prefix| content_type.starts_with(prefix))
                })
    }
}

async fn weaken_encoded_etag(mut response: Response) -> Response {
    if response
        .headers()
        .contains_key(axum::http::header::CONTENT_ENCODING)
        && let Some(etag) = response.headers().get(axum::http::header::ETAG)
        && let Ok(etag) = etag.to_str()
        && !etag.starts_with("W/")
        && let Ok(weak) = format!("W/{etag}").parse()
    {
        response
            .headers_mut()
            .insert(axum::http::header::ETAG, weak);
    }

    response
}

fn handle_panic(err: Box<dyn std::any::Any + Send + 'static>) -> Response<Body> {
    let details = if let Some(s) = err.downcast_ref::<String>() {
        s.as_str()
    } else if let Some(s) = err.downcast_ref::<&str>() {
        s
    } else {
        "unknown panic"
    };

    tracing::error!("a panic occurred while handling a request: {}", details);

    ApiResponse::error("internal server error")
        .with_status(StatusCode::INTERNAL_SERVER_ERROR)
        .into_response()
}

fn etag_matches(if_none_match: &str, etag: &str) -> bool {
    fn opaque(tag: &str) -> &str {
        tag.trim().trim_start_matches("W/").trim_matches('"')
    }

    let etag = opaque(etag);

    if_none_match
        .split(',')
        .any(|candidate| candidate.trim() == "*" || opaque(candidate) == etag)
}

pub async fn handle_postprocessing(
    state: GetState,
    req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let if_none_match = req
        .headers()
        .get("If-None-Match")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    let mut response = next.run(req).await;

    if let Some(server_name) = &state.env.server_name
        && let Ok(header_value) = server_name.parse()
    {
        response.headers_mut().insert("X-Server-Name", header_value);
    }

    if response
        .headers()
        .get("Content-Type")
        .and_then(|v| v.to_str().ok())
        == Some("text/event-stream")
        || response
            .headers()
            .get("X-Accel-Buffering")
            .and_then(|v| v.to_str().ok())
            == Some("no")
        || response
            .body()
            .size_hint()
            .upper()
            .is_none_or(|len| len > 8 * 1024 * 1024)
    {
        return Ok(response);
    }

    if let Some(content_type) = response.headers().get("Content-Type")
        && content_type
            .to_str()
            .map(|c| c.starts_with("text/plain"))
            .unwrap_or(false)
        && response.status().is_client_error()
        && response.status() != StatusCode::NOT_FOUND
    {
        let (mut parts, body) = response.into_parts();

        let bytes_body = match axum::body::to_bytes(body, usize::MAX).await {
            Ok(bytes) => bytes.into_iter().collect::<Vec<u8>>(),
            Err(_) => return Ok(Response::from_parts(parts, Body::empty())),
        };

        match String::from_utf8(bytes_body) {
            Ok(text_body) => {
                parts
                    .headers
                    .insert("Content-Type", HeaderValue::from_static("application/json"));

                response = Response::from_parts(
                    parts,
                    Body::from(ApiError::new_value(&[&text_body]).to_string()),
                );
            }
            Err(err) => {
                response = Response::from_parts(parts, Body::from(err.into_bytes()));
            }
        }
    }

    let (etag, mut response) = if let Some(etag) = response.headers().get("ETag") {
        (etag.to_str().map(|e| e.to_string()).ok(), response)
    } else if response
        .headers()
        .get("Content-Type")
        .is_some_and(|c| c.to_str().is_ok_and(|c| c != "text/plain"))
    {
        let (mut parts, body) = response.into_parts();
        let body_bytes = match axum::body::to_bytes(body, usize::MAX).await {
            Ok(bytes) => bytes.into_iter().collect::<Vec<u8>>(),
            Err(_) => return Ok(Response::from_parts(parts, Body::empty())),
        };

        let mut hash = sha2::Sha256::new();
        hash.update(&body_bytes);
        let hash = hex::encode(hash.finalize());

        let etag = format!("\"{hash}\"");
        parts.headers.insert("ETag", etag.parse().unwrap());

        (
            Some(etag),
            Response::from_parts(parts, Body::from(body_bytes)),
        )
    } else {
        (None, response)
    };

    // we cant directly compare because if both are None, It'd return NOT_MODIFIED
    if let Some(etag) = etag
        && if_none_match.is_some_and(|if_none_match| etag_matches(&if_none_match, &etag))
    {
        let mut cached_response = Response::builder()
            .status(StatusCode::NOT_MODIFIED)
            .body(Body::empty())
            .unwrap();

        cached_response
            .headers_mut()
            .extend(response.headers_mut().drain());

        return Ok(cached_response);
    }

    Ok(response)
}

fn mount_extension_routes(
    state: &shared::State,
    routes: shared::extensions::ExtensionRouteBuilder,
) -> OpenApiRouter<shared::State> {
    // route_layer panics on a router without routes
    fn non_empty(
        router: Option<Box<OpenApiRouter<shared::State>>>,
    ) -> Option<OpenApiRouter<shared::State>> {
        router
            .map(|router| *router)
            .filter(|router| axum::Router::from(router.clone()).has_routes())
    }

    let mut router = OpenApiRouter::new().with_state(state.clone());

    if let Some(global) = routes.global {
        router = router.merge(*global);
    }
    if let Some(api_admin) = non_empty(routes.api_admin) {
        router = router.nest(
            "/api/admin",
            api_admin
                .route_layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    routes::api::admin::auth,
                ))
                .route_layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    routes::api::client::auth,
                )),
        );
    }
    if let Some(api_auth) = routes.api_auth {
        router = router.nest("/api/auth", *api_auth);
    }
    if let Some(api_client) = non_empty(routes.api_client) {
        router = router.nest(
            "/api/client",
            api_client.route_layer(axum::middleware::from_fn_with_state(
                state.clone(),
                routes::api::client::auth,
            )),
        );
    }
    if let Some(api_client_servers_server) = non_empty(routes.api_client_servers_server) {
        router = router.nest(
            "/api/client/servers/{server}",
            api_client_servers_server
                .route_layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    routes::api::client::servers::_server_::auth,
                ))
                .route_layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    routes::api::client::auth,
                )),
        );
    }
    if let Some(api_remote) = non_empty(routes.api_remote) {
        router = router.nest(
            "/api/remote",
            api_remote.route_layer(axum::middleware::from_fn_with_state(
                state.clone(),
                routes::api::remote::auth,
            )),
        );
    }
    if let Some(api_remote_servers_server) = non_empty(routes.api_remote_servers_server) {
        router = router.nest(
            "/api/remote/servers/{server}",
            api_remote_servers_server
                .route_layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    routes::api::remote::servers::_server_::auth,
                ))
                .route_layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    routes::api::remote::auth,
                )),
        );
    }

    router
}

pub async fn handle_startup() -> Result<
    (
        sentry::ClientInitGuard,
        shared::env::EnvGuard,
        shared::State,
    ),
    anyhow::Error,
> {
    rustls::crypto::aws_lc_rs::default_provider()
        .install_default()
        .map_err(|_| anyhow::anyhow!("failed to install default crypto provider"))?;

    let env = shared::env::Env::parse();
    let extensions = Arc::clone(EXTENSIONS.get().context("extensions not initialized")?);

    let cli = CliCommandGroupBuilder::new(
        "calagopus-panel",
        "The panel server allowing control of game servers.",
    );

    let mut cli = commands::commands(cli);
    cli = extensions
        .init_cli(env.as_ref().ok().map(|e| &e.0), cli)
        .await;

    CLAP_COMMAND
        .set(cli.get_command())
        .map_err(|_| anyhow::anyhow!("failed to set CLI"))?;

    let mut matches = cli.get_matches();
    let debug = *matches.get_one::<bool>("debug").unwrap();

    if debug && let Ok((env, _)) = &env {
        env.set_debug(true)
            .context("failed to set debug mode from cli argument")?;
    }

    match matches.remove_subcommand() {
        Some((command, arg_matches)) => {
            if let Some((func, arg_matches)) = cli.match_command(command, arg_matches) {
                match func(env.as_ref().ok().map(|e| e.0.clone()), arg_matches).await {
                    Ok(exit_code) => {
                        drop(env);
                        std::process::exit(exit_code);
                    }
                    Err(err) => {
                        drop(env);
                        if let Some(shared::database::DatabaseError::Validation(error)) =
                            err.downcast_ref::<shared::database::DatabaseError>()
                        {
                            let error_messages = shared::utils::flatten_validation_errors(error);

                            eprintln!("{}", "validation error(s) occurred:".red());
                            for message in error_messages {
                                eprintln!("  {}", message.red());
                            }

                            std::process::exit(1);
                        }

                        eprintln!(
                            "{}: {:#?}",
                            "an error occurred while running cli command".red(),
                            err
                        );
                        std::process::exit(1);
                    }
                }
            } else {
                cli.print_help();
                std::process::exit(0);
            }
        }
        None => {
            tracing::info!("                         _");
            tracing::info!("  _ __   __ _ _ __   ___| |");
            tracing::info!(" | '_ \\ / _` | '_ \\ / _ \\ |");
            tracing::info!(" | |_) | (_| | | | |  __/ |");
            tracing::info!(" | .__/ \\__,_|_| |_|\\___|_|____");
            tracing::info!(" | |                  | '__/ __|");
            tracing::info!(" |_|                  | |  \\__ \\");
            tracing::info!("{: >21} |_|  |___/", shared::VERSION);
            tracing::info!("github.com/calagopus/panel#{}\n", shared::GIT_COMMIT);
        }
    }

    let (env, _env_guard) = env.context("failed to parse environment")?;

    let _guard = sentry::init((
        env.sentry_url.clone(),
        sentry::ClientOptions::default()
            .server_name(
                env.server_name
                    .clone()
                    .map_or(Cow::Borrowed("calagopus"), |s| s.into()),
            )
            .traces_sampler({
                let sample_rate = env.sentry_tracing_sample_rate;

                move |context| {
                    if context.operation().starts_with("shared::cache::") {
                        0.0
                    } else {
                        sample_rate
                    }
                }
            })
            .release(shared::full_version())
            .before_send(|mut event| {
                if let Some(request) = event.request.as_mut() {
                    if let Some(url) = request.url.as_mut() {
                        let redacted = url
                            .query()
                            .map(|query| shared::utils::redact_query(query).into_owned());
                        if let Some(redacted) = redacted {
                            url.set_query(Some(&redacted));
                        }
                    }

                    if let Some(query_string) = request.query_string.as_mut() {
                        *query_string = shared::utils::redact_query(query_string).into_owned();
                    }
                }

                Some(event)
            }),
    ));

    let jwt = Arc::new(shared::jwt::Jwt::new(&env));
    let ntp = shared::ntp::Ntp::new();
    let cache = shared::cache::Cache::new(&env).await;
    let database = Arc::new(shared::database::Database::new(&env, cache.clone()).await);

    extensions.set_disabled(shared::settings::fetch_disabled_extensions(&database).await);

    if env.database_migrate {
        tracing::info!("running database migrations...");

        let run = async || -> Result<(), anyhow::Error> {
            database_migrator::ensure_migrations_table(database.write()).await?;

            tracing::info!("fetching applied migrations...");
            let applied_migrations =
                database_migrator::fetch_applied_migrations(database.write()).await?;

            tracing::info!("collecting embedded migrations...");
            let migrations = database_migrator::collect_embedded_migrations()?;

            tracing::info!("found {} migrations.", migrations.len());

            let mut ran_migrations = 0;
            for migration in migrations
                .into_iter()
                .filter(|m| !applied_migrations.iter().any(|am| am.id == m.snapshot.id))
            {
                let summary = migration.snapshot.summary();
                tracing::info!(
                    tables = summary.tables,
                    sequences = summary.sequences,
                    enums = summary.enums,
                    columns = summary.columns,
                    indexes = summary.indexes,
                    foreign_keys = summary.foreign_keys,
                    primary_keys = summary.primary_keys,
                    name = %migration.name,
                    "applying migration"
                );

                database_migrator::run_migration(database.write(), &migration)
                    .await
                    .with_context(|| format!("failed to apply migration {}", migration.name))?;

                tracing::info!(name = %migration.name, "successfully applied migration");
                tracing::info!("");

                ran_migrations += 1;
            }

            tracing::info!("applied {} new migrations.", ran_migrations);

            tracing::info!("collecting extension migrations...");
            for extension in extensions.extensions().await.iter() {
                if extensions.is_disabled(extension.package_name)
                    || extensions.is_failed(extension.package_name)
                {
                    continue;
                }

                let migrations = match database_migrator::collect_embedded_extension_migrations(
                    &extension.metadata_toml.get_package_identifier(),
                ) {
                    Ok(migrations) => migrations,
                    Err(err) => {
                        tracing::warn!(
                            extension = %extension.package_name,
                            "failed to collect migrations for extension: {:#?}",
                            err
                        );
                        continue;
                    }
                };

                tracing::info!(
                    count = migrations.len(),
                    extension = %extension.package_name,
                    "found extension migrations"
                );

                let mut ran_migrations = 0;
                for migration in migrations
                    .into_iter()
                    .filter(|m| !applied_migrations.iter().any(|am| am.id == m.id))
                {
                    tracing::info!(
                        name = %migration.name,
                        extension = %extension.package_name,
                        "applying extension migration"
                    );

                    database_migrator::run_extension_migration(database.write(), &migration)
                        .await
                        .with_context(|| {
                            format!(
                                "failed to apply extension migration {} (extension: {})",
                                migration.name, extension.package_name
                            )
                        })?;

                    tracing::info!(
                        name = %migration.name,
                        extension = %extension.package_name,
                        "successfully applied extension migration"
                    );

                    ran_migrations += 1;
                }

                tracing::info!(
                    count = ran_migrations,
                    extension = %extension.package_name,
                    "applied extension migrations"
                );
            }

            Ok(())
        };

        run()
            .await
            .context("an error occurred while running database migrations")?;
        tracing::info!("database migrations complete.");
    }

    let background_tasks =
        Arc::new(shared::extensions::background_tasks::BackgroundTaskManager::default());
    let shutdown_handlers =
        Arc::new(shared::extensions::shutdown_handlers::ShutdownHandlerManager::default());
    let settings = Arc::new(
        shared::settings::Settings::new(database.clone())
            .await
            .context("failed to load settings")?,
    );
    let storage = Arc::new(shared::storage::Storage::new(settings.clone()));
    let captcha = Arc::new(shared::captcha::Captcha::new(settings.clone()));
    let mail = Arc::new(shared::mail::Mail::new(settings.clone()));

    let state = Arc::new(shared::AppState {
        start_time: std::time::Instant::now(),
        container_type: shared::AppContainerType::detect(),
        version: shared::full_version(),

        client: reqwest::ClientBuilder::new()
            .user_agent(format!("github.com/calagopus/panel {}", shared::VERSION))
            .connect_timeout(std::time::Duration::from_secs(10))
            .build()
            .context("failed to build http client")?,
        app_router: RwLock::new(None),

        extensions: extensions.clone(),
        updates: Arc::new(shared::updates::UpdateManager::default()),
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
        env,
    });

    state.updates.init(state.clone());

    let (app, background_task_builder, shutdown_handler_builder) = extensions
        .init(
            state.clone(),
            OpenApiRouter::new().merge(routes::router(&state)),
            |routes| mount_extension_routes(&state, routes),
        )
        .await;

    settings
        .set_inactive_extensions(&extensions.inactive())
        .await
        .context("failed to render index.html")?;

    tasks::define_background_tasks(&background_task_builder).await;

    background_tasks
        .merge_builder(background_task_builder)
        .await;

    shutdown_handler_builder
        .add_handler("flush_database_batch_actions", async |state| {
            state.database.flush_batch_actions().await;
            Ok(())
        })
        .await;

    shutdown_handlers
        .merge_builder(shutdown_handler_builder)
        .await;

    let app = app
        .fallback(
            |state: GetState, ip: GetIp, req: Request<Body>| async move {
                let is_upgrade = req
                    .headers()
                    .get(axum::http::header::UPGRADE)
                    .is_some_and(|v| v.as_bytes().eq_ignore_ascii_case(b"websocket"));

                let (mut parts, body) = req.into_parts();
                let path = parts.uri.path().to_string();

                'proxy: {
                    if path.starts_with("/wings-proxy") {
                        let node = match path.strip_prefix("/wings-proxy/") {
                            Some(node) => node,
                            None => break 'proxy,
                        };
                        let (node, path) = match node.split_once('/') {
                            Some((node, path)) => (node, path),
                            None => (node, ""),
                        };
                        let node = match uuid::Uuid::parse_str(node) {
                            Ok(node) => node,
                            Err(_) => break 'proxy,
                        };

                        if !state.env.app_enable_wings_proxy
                            && !state.container_type.is_all_in_one()
                            && node != Node::AIO_NODE_UUID
                        {
                            break 'proxy;
                        }

                        let node =
                            match Node::by_uuid_optional_cached(&state.database, node).await? {
                                Some(node) => node,
                                None => break 'proxy,
                            };

                        let mut url = node.url(path);
                        url.set_query(parts.uri.query());

                        let node_token = node.token.decrypt(&state.database).await?;

                        if is_upgrade {
                            let ws = match WebSocketUpgrade::from_request_parts(
                                &mut parts, &state,
                            )
                            .await
                            {
                                Ok(ws) => ws,
                                Err(_) => break 'proxy,
                            };

                            let url = match url.scheme() {
                                "https" => format!("wss://{}", &url.as_str()["https://".len()..]),
                                "http" => format!("ws://{}", &url.as_str()["http://".len()..]),
                                _ => url.to_string(),
                            };

                            let mut upstream_request = match url.into_client_request() {
                                Ok(request) => request,
                                Err(_) => break 'proxy,
                            };

                            for (name, value) in parts.headers.iter() {
                                if is_stripped_proxy_request_header(name) {
                                    continue;
                                }

                                upstream_request
                                    .headers_mut()
                                    .append(name.clone(), value.clone());
                            }

                            upstream_request
                                .headers_mut()
                                .insert("X-Real-Ip", ip.to_string().parse()?);
                            upstream_request
                                .headers_mut()
                                .insert("X-Real-Ip-Token", node_token.parse()?);

                            tracing::debug!(
                                "proxying websocket to wings-proxy upstream: {}",
                                shared::utils::redact_url(&upstream_request.uri().to_string())
                            );

                            let upstream =
                                match tokio_tungstenite::connect_async(upstream_request).await {
                                    Ok((upstream, _)) => upstream,
                                    Err(err) => {
                                        tracing::warn!(
                                            "failed to connect to wings-proxy websocket upstream: {:#?}",
                                            err
                                        );

                                        return ApiResponse::error("failed to connect to upstream")
                                            .with_status(StatusCode::BAD_GATEWAY)
                                            .ok();
                                    }
                                };

                            return ApiResponse::new_response(ws.on_upgrade(
                                move |client_ws| async move {
                                    use futures_util::{SinkExt, StreamExt};

                                    let (mut client_tx, mut client_rx) = client_ws.split();
                                    let (mut up_tx, mut up_rx) = upstream.split();

                                    let to_upstream = async {
                                        while let Some(Ok(msg)) = client_rx.next().await {
                                            let msg = shared::utils::axum_to_tungstenite(msg);
                                            if up_tx.send(msg).await.is_err() {
                                                break;
                                            }
                                        }
                                    };

                                    let to_client = async {
                                        while let Some(Ok(msg)) = up_rx.next().await {
                                            let Some(msg) = shared::utils::tungstenite_to_axum(msg)
                                            else {
                                                continue;
                                            };
                                            if client_tx.send(msg).await.is_err() {
                                                break;
                                            }
                                        }
                                    };

                                    tokio::select! {
                                        _ = to_upstream => {},
                                        _ = to_client => {},
                                    }
                                },
                            ))
                            .ok();
                        }

                        let mut headers =
                            axum::http::HeaderMap::with_capacity(parts.headers.len());
                        for (name, value) in parts.headers.iter() {
                            if is_stripped_proxy_request_header(name) {
                                continue;
                            }

                            headers.append(name.clone(), value.clone());
                        }

                        let mut request = reqwest::Request::new(parts.method, url);
                        *request.headers_mut() = headers;
                        *request.body_mut() =
                            Some(reqwest::Body::wrap_stream(body.into_data_stream()));

                        request
                            .headers_mut()
                            .insert("X-Real-Ip", ip.to_string().parse()?);
                        request
                            .headers_mut()
                            .insert("X-Real-Ip-Token", node_token.parse()?);

                        tracing::debug!(
                            "proxying request to wings-proxy upstream: {}",
                            shared::utils::redact_url(request.url().as_str())
                        );

                        let response = match state.client.execute(request).await {
                            Ok(response) => response,
                            Err(err) => {
                                let status = if err.is_connect() || err.is_timeout() {
                                    StatusCode::GATEWAY_TIMEOUT
                                } else {
                                    StatusCode::BAD_GATEWAY
                                };

                                tracing::warn!(
                                    "failed to connect to wings-proxy upstream: {:#?}",
                                    err.without_url()
                                );

                                return ApiResponse::error("failed to connect to upstream")
                                    .with_status(status)
                                    .ok();
                            }
                        };

                        let status = response.status();
                        let headers = response.headers().clone();

                        let mut headers = headers;
                        for header in [
                            axum::http::header::TRANSFER_ENCODING,
                            axum::http::header::CONNECTION,
                            axum::http::header::CONTENT_LENGTH,
                        ] {
                            headers.remove(header);
                        }

                        return ApiResponse::new(Body::from_stream(response.bytes_stream()))
                            .with_status(status)
                            .with_headers(&headers)
                            .ok();
                    }
                }

                if !path.starts_with("/api") {
                    if state.env.app_disable_frontend {
                        return ApiResponse::error("route not found")
                            .with_status(StatusCode::NOT_FOUND)
                            .ok();
                    }

                    let path = urlencoding::decode(&path[1.min(path.len())..])?;

                    let asset = shared::frontend_asset(&path);

                    if asset.is_none()
                        && (path.starts_with("assets")
                            || path.starts_with("avatars")
                            || path.starts_with("publicdata"))
                    {
                        // technically not needed (cap filesystem) but never hurts
                        if path.contains("..") {
                            return ApiResponse::error("file not found")
                                .with_status(StatusCode::NOT_FOUND)
                                .ok();
                        }

                        let settings = state.settings.get().await?;

                        let base_dir = if path.starts_with("assets") {
                            "assets"
                        } else if path.starts_with("avatars") {
                            "avatars"
                        } else if path.starts_with("publicdata") {
                            "publicdata"
                        } else {
                            return ApiResponse::error("file not found")
                                .with_status(StatusCode::NOT_FOUND)
                                .ok();
                        };

                        let base_filesystem =
                            match settings.storage_driver.get_cap_filesystem(base_dir).await {
                                Some(Ok(filesystem)) => filesystem,
                                Some(Err(err)) if err.kind() == std::io::ErrorKind::NotFound => {
                                    return ApiResponse::error("file not found")
                                        .with_status(StatusCode::NOT_FOUND)
                                        .ok();
                                }
                                Some(Err(err)) => return Err(err.into()),
                                None => {
                                    return ApiResponse::error("file not found")
                                        .with_status(StatusCode::NOT_FOUND)
                                        .ok();
                                }
                            };
                        drop(settings);

                        let path = path
                            .strip_prefix(&format!("{}/", base_dir))
                            .unwrap_or(&path);

                        let metadata = match base_filesystem.async_metadata(path).await {
                            Ok(metadata) => metadata,
                            Err(_) => {
                                return ApiResponse::error("file not found")
                                    .with_status(StatusCode::NOT_FOUND)
                                    .ok();
                            }
                        };

                        let modified = metadata.modified().ok().and_then(|modified| {
                            chrono::DateTime::from_timestamp(
                                modified
                                    .into_std()
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .ok()?
                                    .as_secs() as i64,
                                0,
                            )
                        });
                        let last_modified = modified.map(|modified| {
                            modified
                                .format("%a, %d %b %Y %H:%M:%S GMT")
                                .to_compact_string()
                        });

                        let cache_control = if base_dir == "avatars"
                            || (base_dir == "publicdata" && path.starts_with("egg-repositories/"))
                        {
                            "public, max-age=31536000, immutable"
                        } else {
                            "no-cache"
                        };

                        if let Some(modified) = modified
                            && parts
                                .headers
                                .get(axum::http::header::IF_MODIFIED_SINCE)
                                .and_then(|value| value.to_str().ok())
                                .and_then(|value| chrono::DateTime::parse_from_rfc2822(value).ok())
                                .is_some_and(|since| modified.timestamp() <= since.timestamp())
                        {
                            return ApiResponse::new(Body::empty())
                                .with_status(StatusCode::NOT_MODIFIED)
                                .with_header("Cache-Control", cache_control)
                                .with_optional_header("Last-Modified", last_modified.as_deref())
                                .ok();
                        }

                        let tokio_file = match base_filesystem.async_open(path).await {
                            Ok(file) => file,
                            Err(_) => {
                                return ApiResponse::error("file not found")
                                    .with_status(StatusCode::NOT_FOUND)
                                    .ok();
                            }
                        };

                        let content_type = shared::storage::content_type(path);

                        return ApiResponse::new(Body::from_stream(
                            tokio_util::io::ReaderStream::new(tokio_file),
                        ))
                        .with_header("Content-Length", metadata.len().to_compact_string())
                        .with_optional_header("Last-Modified", last_modified.as_deref())
                        .with_header("Cache-Control", cache_control)
                        .with_header("Content-Type", content_type)
                        .with_optional_header(
                            "Content-Disposition",
                            shared::storage::content_type_requires_attachment(content_type)
                                .then_some("attachment"),
                        )
                        .with_header("Content-Security-Policy", "sandbox")
                        .with_header("X-Content-Type-Options", "nosniff")
                        .with_header("X-Frame-Options", "SAMEORIGIN")
                        .ok();
                    }

                    let is_index = asset.is_none();
                    let mut script_nonce = None;
                    let content_security_policy = if is_index {
                        let settings = state.settings.get().await?;
                        let script_csp = settings.captcha_provider.to_csp_script_src();
                        let style_csp = settings.captcha_provider.to_csp_style_src();
                        if matches!(
                            settings.captcha_provider,
                            shared::settings::CaptchaProvider::Cap { .. }
                        ) {
                            script_nonce = Some(uuid::Uuid::new_v4().simple().to_string());
                        }
                        let nonce_csp = script_nonce
                            .as_ref()
                            .map(|nonce| format!(" 'nonce-{nonce}'"))
                            .unwrap_or_default();

                        Some(format!(
                            "default-src 'self'; \
                                script-src 'self' blob: {script_csp}{nonce_csp}; \
                                frame-src *; \
                                style-src 'self' 'unsafe-inline' {style_csp}; \
                                connect-src * blob:; \
                                font-src 'self' blob: data:; \
                                img-src * blob: data:; \
                                media-src 'self' blob: data:; \
                                object-src blob: data:; \
                                base-uri 'self'; \
                                form-action 'self'; \
                                frame-ancestors 'self';"
                        ))
                    } else {
                        None
                    };

                    let accepts_gzip = parts
                        .headers
                        .get(axum::http::header::ACCEPT_ENCODING)
                        .and_then(|value| value.to_str().ok())
                        .is_some_and(|value| {
                            value.split(',').any(|encoding| {
                                encoding
                                    .split(';')
                                    .next()
                                    .unwrap_or_default()
                                    .trim()
                                    .eq_ignore_ascii_case("gzip")
                            })
                        });

                    let cache_control = if asset
                        .as_ref()
                        .is_some_and(|asset| asset.path.starts_with("assets/"))
                    {
                        "public, max-age=31536000, immutable"
                    } else {
                        "no-cache"
                    };

                    let (body, content_type, content_encoding) = match asset {
                        None => {
                            let html = state.settings.get_rendered_index_html();
                            let body = if let Some(nonce) = script_nonce {
                                let html: &str = html.as_ref();
                                Body::from(html.replacen(
                                    "</head>",
                                    &format!("<meta name=\"cap-script-nonce\" content=\"{nonce}\"></head>"),
                                    1,
                                ))
                            } else {
                                Body::from(axum::body::Bytes::from_owner(html))
                            };

                            (body, "text/html", None)
                        }
                        Some(asset) => {
                            let content_type = frontend_asset_content_type(&asset);

                            if asset.gzipped && !accepts_gzip {
                                (
                                    Body::from(asset.decompressed()?.into_owned()),
                                    content_type,
                                    None,
                                )
                            } else {
                                (
                                    Body::from(asset.contents),
                                    content_type,
                                    asset.gzipped.then_some("gzip"),
                                )
                            }
                        }
                    };

                    return ApiResponse::new(body)
                        .with_header("Content-Type", content_type)
                        .with_optional_header("Content-Encoding", content_encoding)
                        .with_header("Vary", "Accept-Encoding")
                        .with_header("Cache-Control", cache_control)
                        .with_optional_header("Content-Security-Policy", content_security_policy)
                        .with_header("X-Content-Type-Options", "nosniff")
                        .with_header("X-Frame-Options", "SAMEORIGIN")
                        .ok();
                }

                ApiResponse::error("route not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok()
            },
        )
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            handle_request,
        ))
        .layer(CookieManagerLayer::new())
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            handle_postprocessing,
        ))
        .layer(
            tower_http::compression::CompressionLayer::new()
                .no_br()
                .no_deflate()
                .no_zstd()
                .compress_when(CompressionPredicate),
        )
        .layer(axum::middleware::map_response(weaken_encoded_etag))
        .layer(tower_http::catch_panic::CatchPanicLayer::custom(
            handle_panic,
        ))
        .route_layer(SentryHttpLayer::new().enable_transaction())
        .route_layer(NewSentryLayer::<Request>::new_from_top())
        .with_state(state.clone());

    let settings = settings.get().await.context("failed to load settings")?;

    let (router, mut openapi) = app.split_for_parts();
    openapi.info.version = "1.0.0".into();
    openapi.info.description = None;
    openapi.info.title = format!("{} API", settings.app.name);
    openapi.info.contact = None;
    openapi.info.license = None;
    openapi.servers = Some(
        std::iter::once(utoipa::openapi::Server::new("/"))
            .chain(settings.app.urls().map(utoipa::openapi::Server::new))
            .collect(),
    );

    let components = openapi
        .components
        .as_mut()
        .context("openapi components missing")?;
    components.add_security_scheme(
        "cookie",
        SecurityScheme::ApiKey(ApiKey::Cookie(ApiKeyValue::new(
            settings.app.session_cookie.clone(),
        ))),
    );
    components.add_security_scheme(
        "api_key",
        SecurityScheme::ApiKey(ApiKey::Header(ApiKeyValue::new("Authorization"))),
    );

    drop(settings);

    for (original_path, item) in openapi.paths.paths.iter_mut() {
        let operations = [
            ("get", &mut item.get),
            ("post", &mut item.post),
            ("put", &mut item.put),
            ("patch", &mut item.patch),
            ("delete", &mut item.delete),
        ];

        let path = original_path
            .replace('/', "_")
            .replace(|c| ['{', '}'].contains(&c), "");

        for (method, operation) in operations {
            const OPERATION_GROUPS: &[&str] =
                &["/api/admin", "/api/client", "/api/auth", "/api/remote"];

            if let Some(operation) = operation {
                operation.operation_id = Some(format!("{method}{path}"));
                operation.tags = OPERATION_GROUPS
                    .iter()
                    .find(|g| original_path.starts_with(**g))
                    .map(|group| vec![group.to_string()]);
            }
        }
    }

    let openapi = Arc::new(openapi);
    let router = router.route(
        "/openapi.json",
        axum::routing::get(|| async move { axum::Json(openapi) }),
    );

    *state.app_router.write().await = Some(router);

    Ok((_guard, _env_guard, state))
}
