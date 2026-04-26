use anyhow::Context;
use axum::{
    body::Body,
    extract::{ConnectInfo, Path, Request},
    http::{HeaderValue, StatusCode},
    middleware::Next,
    response::Response,
};
use colored::Colorize;
use compact_str::ToCompactString;
use sentry_tower::SentryHttpLayer;
use sha2::Digest;
use shared::{
    ApiError, FRONTEND_ASSETS, GetIp, GetState,
    extensions::commands::CliCommandGroupBuilder,
    models::{ByUuid, node::Node},
    response::ApiResponse,
};
use std::{net::SocketAddr, path::PathBuf, sync::Arc};
use tokio::sync::RwLock;
use tower_cookies::CookieManagerLayer;
use utoipa::openapi::security::{ApiKey, ApiKeyValue, SecurityScheme};
use utoipa_axum::router::OpenApiRouter;

pub mod commands;
pub mod routes;
pub mod tasks;

pub async fn handle_request(
    state: GetState,
    connect_info: ConnectInfo<SocketAddr>,
    mut req: Request<Body>,
    next: Next,
) -> Result<Response<Body>, StatusCode> {
    let ip = state.env.find_ip(req.headers(), connect_info);

    req.extensions_mut().insert(ip);

    tracing::info!(
        path = req.uri().path(),
        query = req.uri().query().unwrap_or_default(),
        "http {}",
        req.method().to_string().to_lowercase(),
    );

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

pub async fn handle_postprocessing(req: Request, next: Next) -> Result<Response, StatusCode> {
    let if_none_match = req
        .headers()
        .get("If-None-Match")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    let mut response = next.run(req).await;

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

        parts.headers.insert("ETag", hash.parse().unwrap());

        (
            Some(hash),
            Response::from_parts(parts, Body::from(body_bytes)),
        )
    } else {
        (None, response)
    };

    // we cant directly compare because if both are None, It'd return NOT_MODIFIED
    if let Some(etag) = etag
        && if_none_match == Some(etag)
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

pub async fn handle_startup() -> (
    sentry::ClientInitGuard,
    shared::env::EnvGuard,
    shared::State,
) {
    let env = shared::env::Env::parse();
    let extensions = Arc::new(shared::extensions::manager::ExtensionManager::new(
        extension_internal_list::list(),
    ));

    let cli = CliCommandGroupBuilder::new(
        "panel-rs",
        "The panel server allowing control of game servers.",
    );

    let mut cli = commands::commands(cli);
    cli = extensions
        .init_cli(env.as_ref().ok().map(|e| &e.0), cli)
        .await;

    let mut matches = cli.get_matches();
    let debug = *matches.get_one::<bool>("debug").unwrap();

    if debug && let Ok((env, _)) = &env {
        env.app_debug
            .store(true, std::sync::atomic::Ordering::Relaxed);
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

    let (env, _env_guard) = match env {
        Ok((env, env_guard)) => (env, env_guard),
        Err(err) => {
            eprintln!("{}: {err:#?}", "failed to parse environment".red());
            std::process::exit(1);
        }
    };

    let _guard = sentry::init((
        env.sentry_url.clone(),
        sentry::ClientOptions {
            server_name: env.server_name.clone().map(|s| s.into()),
            release: Some(shared::full_version().into()),
            traces_sample_rate: 1.0,
            ..Default::default()
        },
    ));

    let jwt = Arc::new(shared::jwt::Jwt::new(&env));
    let ntp = shared::ntp::Ntp::new();
    let cache = shared::cache::Cache::new(&env).await;
    let database = Arc::new(shared::database::Database::new(&env, cache.clone()).await);

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
                tracing::info!(
                    tables = ?migration.snapshot.tables().len(),
                    enums = ?migration.snapshot.enums().len(),
                    columns = ?migration.snapshot.columns(None).len(),
                    indexes = ?migration.snapshot.indexes(None).len(),
                    foreign_keys = ?migration.snapshot.foreign_keys(None).len(),
                    primary_keys = ?migration.snapshot.primary_keys(None).len(),
                    name = %migration.name,
                    "applying migration"
                );

                if let Err(err) =
                    database_migrator::run_migration(database.write(), &migration).await
                {
                    eprintln!("{}: {}", "failed to apply migration".red(), err);
                    std::process::exit(1);
                }

                tracing::info!(name = %migration.name, "successfully applied migration");
                tracing::info!("");

                ran_migrations += 1;
            }

            tracing::info!("applied {} new migrations.", ran_migrations);

            tracing::info!("collecting extension migrations...");
            for extension in extensions.extensions().await.iter() {
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

                    if let Err(err) =
                        database_migrator::run_extension_migration(database.write(), &migration)
                            .await
                    {
                        eprintln!(
                            "{}: {} (extension: {})",
                            "failed to apply extension migration".red(),
                            err,
                            extension.package_name
                        );
                        std::process::exit(1);
                    }

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

        match run().await {
            Ok(()) => {
                tracing::info!("database migrations complete.");
            }
            Err(err) => {
                eprintln!(
                    "{}: {:#?}",
                    "an error occurred while running database migrations".red(),
                    err
                );
                std::process::exit(1);
            }
        }
    }

    let background_tasks =
        Arc::new(shared::extensions::background_tasks::BackgroundTaskManager::default());
    let shutdown_handlers =
        Arc::new(shared::extensions::shutdown_handlers::ShutdownHandlerManager::default());
    let settings = Arc::new(
        shared::settings::Settings::new(database.clone())
            .await
            .context("failed to load settings")
            .unwrap(),
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
            .build()
            .unwrap(),
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

    let (routes, background_task_builder, shutdown_handler_builder) =
        extensions.init(state.clone()).await;
    let mut extension_router = OpenApiRouter::new().with_state(state.clone());

    if let Some(global) = routes.global {
        extension_router = extension_router.merge(*global);
    }
    if let Some(api_admin) = routes.api_admin {
        extension_router = extension_router.nest(
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
        extension_router = extension_router.nest("/api/auth", *api_auth);
    }
    if let Some(api_client) = routes.api_client {
        extension_router = extension_router.nest(
            "/api/client",
            api_client.route_layer(axum::middleware::from_fn_with_state(
                state.clone(),
                routes::api::client::auth,
            )),
        );
    }
    if let Some(api_client_servers_server) = routes.api_client_servers_server {
        extension_router = extension_router.nest(
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
    if let Some(api_remote) = routes.api_remote {
        extension_router = extension_router.nest(
            "/api/remote",
            api_remote.route_layer(axum::middleware::from_fn_with_state(
                state.clone(),
                routes::api::remote::auth,
            )),
        );
    }
    if let Some(api_remote_servers_server) = routes.api_remote_servers_server {
        extension_router = extension_router.nest(
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

    let app = OpenApiRouter::new()
        .merge(routes::router(&state))
        .merge(extension_router)
        .route(
            "/avatars/{user}/{file}",
            axum::routing::get(
                |state: GetState, Path::<(uuid::Uuid, String)>((user, file))| async move {
                    if file.len() != 13 || file.contains("..") || !file.ends_with(".webp") {
                        return ApiResponse::error("file not found")
                            .with_status(StatusCode::NOT_FOUND)
                            .ok();
                    }

                    let settings = state.settings.get().await?;

                    let base_filesystem = match settings.storage_driver.get_cap_filesystem().await {
                        Some(filesystem) => filesystem?,
                        None => {
                            return ApiResponse::error("file not found")
                                .with_status(StatusCode::NOT_FOUND)
                                .ok();
                        }
                    };

                    drop(settings);

                    let path = PathBuf::from(format!("avatars/{user}/{file}"));
                    let size = match base_filesystem.async_metadata(&path).await {
                        Ok(metadata) => metadata.len(),
                        Err(_) => {
                            return ApiResponse::error("file not found")
                                .with_status(StatusCode::NOT_FOUND)
                                .ok();
                        }
                    };

                    let tokio_file = match base_filesystem.async_open(path).await {
                        Ok(file) => file,
                        Err(_) => {
                            return ApiResponse::error("file not found")
                                .with_status(StatusCode::NOT_FOUND)
                                .ok();
                        }
                    };

                    ApiResponse::new(Body::from_stream(tokio_util::io::ReaderStream::new(
                        tokio_file,
                    )))
                    .with_header("Content-Type", "image/webp")
                    .with_header("Content-Length", size.to_compact_string())
                    .with_header("ETag", file.trim_end_matches(".webp"))
                    .ok()
                },
            ),
        )
        .fallback(
            |state: GetState, ip: GetIp, mut req: Request<Body>| async move {
                let is_upgrade = req
                    .headers()
                    .get(axum::http::header::UPGRADE)
                    .is_some_and(|v| v.as_bytes().eq_ignore_ascii_case(b"websocket"));

                let on_upgrade = if is_upgrade {
                    Some(hyper::upgrade::on(&mut req))
                } else {
                    None
                };

                let (parts, body) = req.into_parts();
                let path = parts.uri.path();

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

                        let mut request = reqwest::Request::new(parts.method, url);
                        *request.headers_mut() = parts.headers;
                        *request.body_mut() =
                            Some(reqwest::Body::wrap_stream(body.into_data_stream()));

                        request.headers_mut().remove(axum::http::header::HOST);
                        request.headers_mut().remove("X-Forwarded-For");
                        request
                            .headers_mut()
                            .insert("X-Real-Ip", ip.to_string().parse()?);

                        let response = match tokio::time::timeout(
                            std::time::Duration::from_secs(30),
                            state.client.execute(request),
                        )
                        .await
                        {
                            Ok(Ok(response)) => response,
                            Ok(Err(_)) => {
                                return ApiResponse::error("failed to connect to upstream")
                                    .with_status(StatusCode::BAD_GATEWAY)
                                    .ok();
                            }
                            Err(_) => {
                                return ApiResponse::error("upstream request timed out")
                                    .with_status(StatusCode::GATEWAY_TIMEOUT)
                                    .ok();
                            }
                        };

                        let status = response.status();
                        let headers = response.headers().clone();

                        if status == axum::http::StatusCode::SWITCHING_PROTOCOLS
                            && is_upgrade
                            && let Some(on_upgrade) = on_upgrade
                        {
                            tokio::spawn(async move {
                                let (client_stream_raw, mut upstream_stream) =
                                    match tokio::join!(on_upgrade, response.upgrade()) {
                                        (Ok(c), Ok(u)) => (c, u),
                                        _ => return,
                                    };

                                let mut client_stream =
                                    hyper_util::rt::TokioIo::new(client_stream_raw);

                                let _ = tokio::io::copy_bidirectional(
                                    &mut client_stream,
                                    &mut upstream_stream,
                                )
                                .await;
                            });

                            return ApiResponse::new(Body::empty())
                                .with_status(status)
                                .with_headers(&headers)
                                .ok();
                        }

                        return ApiResponse::new(Body::from_stream(response.bytes_stream()))
                            .with_status(status)
                            .with_headers(&headers)
                            .ok();
                    }
                }

                if !path.starts_with("/api") {
                    let path = &path[1.min(path.len())..];

                    let (is_index, entry) = match FRONTEND_ASSETS.get_entry(path) {
                        Some(entry) => (false, entry),
                        None => (true, FRONTEND_ASSETS.get_entry("index.html").unwrap()),
                    };

                    if (entry.as_file().is_none() || is_index) && path.starts_with("assets") {
                        // technically not needed (cap filesystem) but never hurts
                        if path.contains("..") {
                            return ApiResponse::error("file not found")
                                .with_status(StatusCode::NOT_FOUND)
                                .ok();
                        }

                        let settings = state.settings.get().await?;

                        let base_filesystem =
                            match settings.storage_driver.get_cap_filesystem().await {
                                Some(filesystem) => filesystem?,
                                None => {
                                    return ApiResponse::error("file not found")
                                        .with_status(StatusCode::NOT_FOUND)
                                        .ok();
                                }
                            };
                        drop(settings);

                        let path = urlencoding::decode(path)?;

                        let metadata = match base_filesystem.async_metadata(&*path).await {
                            Ok(metadata) => metadata,
                            Err(_) => {
                                return ApiResponse::error("file not found")
                                    .with_status(StatusCode::NOT_FOUND)
                                    .ok();
                            }
                        };

                        let tokio_file = match base_filesystem.async_open(&*path).await {
                            Ok(file) => file,
                            Err(_) => {
                                return ApiResponse::error("file not found")
                                    .with_status(StatusCode::NOT_FOUND)
                                    .ok();
                            }
                        };

                        let modified = if let Ok(modified) = metadata.modified() {
                            let modified = chrono::DateTime::from_timestamp(
                                modified
                                    .into_std()
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .unwrap_or_default()
                                    .as_secs() as i64,
                                0,
                            )
                            .unwrap_or_default();

                            Some(modified.to_rfc2822())
                        } else {
                            None
                        };

                        return ApiResponse::new(Body::from_stream(
                            tokio_util::io::ReaderStream::new(tokio_file),
                        ))
                        .with_header("Content-Length", metadata.len().to_compact_string())
                        .with_optional_header("Last-Modified", modified.as_deref())
                        .ok();
                    }

                    let (is_index, file) = match entry {
                        include_dir::DirEntry::File(file) => (is_index, file),
                        include_dir::DirEntry::Dir(dir) => match dir.get_file("index.html") {
                            Some(index_file) => (true, index_file),
                            None => (true, FRONTEND_ASSETS.get_file("index.html").unwrap()),
                        },
                    };

                    return ApiResponse::new(Body::from(file.contents()))
                        .with_header(
                            "Content-Type",
                            match infer::get(file.contents()) {
                                Some(kind) => kind.mime_type(),
                                _ => match file.path().extension() {
                                    Some(ext) => match ext.to_str() {
                                        Some("html") => "text/html",
                                        Some("js") => "application/javascript",
                                        Some("css") => "text/css",
                                        Some("json") => "application/json",
                                        Some("svg") => "image/svg+xml",
                                        _ => "application/octet-stream",
                                    },
                                    None => "application/octet-stream",
                                },
                            },
                        )
                        .with_optional_header(
                            "Content-Security-Policy",
                            if is_index {
                                let settings = state.settings.get().await?;
                                let script_csp = settings.captcha_provider.to_csp_script_src();
                                let style_csp = settings.captcha_provider.to_csp_style_src();
                                drop(settings);

                                Some(format!(
                                    "default-src 'self'; \
                                    script-src 'self' blob: {script_csp}; \
                                    frame-src *; \
                                    style-src 'self' 'unsafe-inline' {style_csp}; \
                                    connect-src *; \
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
                            },
                        )
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
        .layer(axum::middleware::from_fn(handle_postprocessing))
        .route_layer(SentryHttpLayer::new().enable_transaction())
        .with_state(state.clone());

    let settings = match settings.get().await {
        Ok(settings) => settings,
        Err(err) => {
            tracing::error!("failed to load settings: {:#?}", err);
            std::process::exit(1);
        }
    };

    let (router, mut openapi) = app.split_for_parts();
    openapi.info.version = "1.0.0".into();
    openapi.info.description = None;
    openapi.info.title = format!("{} API", settings.app.name);
    openapi.info.contact = None;
    openapi.info.license = None;
    openapi.servers = Some(vec![
        utoipa::openapi::Server::new("/"),
        utoipa::openapi::Server::new(settings.app.url.clone()),
    ]);
    drop(settings);

    let components = openapi.components.as_mut().unwrap();
    components.add_security_scheme(
        "cookie",
        SecurityScheme::ApiKey(ApiKey::Cookie(ApiKeyValue::new("session"))),
    );
    components.add_security_scheme(
        "api_key",
        SecurityScheme::ApiKey(ApiKey::Header(ApiKeyValue::new("Authorization"))),
    );

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

    (_guard, _env_guard, state)
}
