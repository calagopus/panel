use anyhow::Context;
use axum::{
    ServiceExt,
    body::Body,
    extract::{ConnectInfo, Path, Request},
    http::{HeaderValue, StatusCode},
    middleware::Next,
    response::Response,
    routing::get,
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
use std::{
    net::{IpAddr, SocketAddr},
    path::PathBuf,
    sync::Arc,
    time::Instant,
};
use tower::Layer;
use tower_cookies::CookieManagerLayer;
use tower_http::normalize_path::NormalizePathLayer;
use utoipa::openapi::security::{ApiKey, ApiKeyValue, SecurityScheme};
use utoipa_axum::router::OpenApiRouter;

#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
#[global_allocator]
static ALLOC: tikv_jemallocator::Jemalloc = tikv_jemallocator::Jemalloc;

async fn handle_request(
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

async fn handle_postprocessing(req: Request, next: Next) -> Result<Response, StatusCode> {
    let if_none_match = req
        .headers()
        .get("If-None-Match")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    let mut response = next.run(req).await;

    if let Some(content_type) = response.headers().get("Content-Type")
        && content_type
            .to_str()
            .map(|c| c.starts_with("text/plain"))
            .unwrap_or(false)
        && response.status().is_client_error()
        && response.status() != StatusCode::NOT_FOUND
    {
        let (mut parts, body) = response.into_parts();

        let bytes_body = axum::body::to_bytes(body, usize::MAX)
            .await
            .unwrap()
            .into_iter()
            .collect::<Vec<u8>>();

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
        let body_bytes = axum::body::to_bytes(body, usize::MAX).await.unwrap();

        let mut hash = sha2::Sha256::new();
        hash.update(body_bytes.as_ref());
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

#[tokio::main]
async fn main() {
    let env = shared::env::Env::parse();
    let extensions = Arc::new(shared::extensions::manager::ExtensionManager::new(
        extension_internal_list::list(),
    ));

    let cli = CliCommandGroupBuilder::new(
        "panel-rs",
        "The panel server allowing control of game servers.",
    );

    let mut cli = panel_rs::commands::commands(cli);
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

    let (env, _tracing_guard) = match env {
        Ok((env, tracing_guard)) => (env, tracing_guard),
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
        start_time: Instant::now(),
        container_type: match std::env::var("OCI_CONTAINER").as_deref() {
            Ok("official") => shared::AppContainerType::Official,
            Ok("official-heavy") => shared::AppContainerType::OfficialHeavy,
            Ok(_) => shared::AppContainerType::Unknown,
            Err(_) => shared::AppContainerType::None,
        },
        version: shared::full_version(),

        client: reqwest::ClientBuilder::new()
            .user_agent(format!("github.com/calagopus/panel {}", shared::VERSION))
            .build()
            .unwrap(),

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
                    panel_rs::routes::api::admin::auth,
                ))
                .route_layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    panel_rs::routes::api::client::auth,
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
                panel_rs::routes::api::client::auth,
            )),
        );
    }
    if let Some(api_client_servers_server) = routes.api_client_servers_server {
        extension_router = extension_router.nest(
            "/api/client/servers/{server}",
            api_client_servers_server
                .route_layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    panel_rs::routes::api::client::servers::_server_::auth,
                ))
                .route_layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    panel_rs::routes::api::client::auth,
                )),
        );
    }
    if let Some(api_remote) = routes.api_remote {
        extension_router = extension_router.nest(
            "/api/remote",
            api_remote.route_layer(axum::middleware::from_fn_with_state(
                state.clone(),
                panel_rs::routes::api::remote::auth,
            )),
        );
    }
    if let Some(api_remote_servers_server) = routes.api_remote_servers_server {
        extension_router = extension_router.nest(
            "/api/remote/servers/{server}",
            api_remote_servers_server
                .route_layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    panel_rs::routes::api::remote::servers::_server_::auth,
                ))
                .route_layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    panel_rs::routes::api::remote::auth,
                )),
        );
    }

    panel_rs::tasks::define_background_tasks(&background_task_builder).await;

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
        .merge(panel_rs::routes::router(&state))
        .merge(extension_router)
        .route(
            "/avatars/{user}/{file}",
            get(
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
                    if !state.env.app_enable_wings_proxy {
                        break 'proxy;
                    }

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
                            Ok(Err(_)) => break 'proxy,
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
                                let frame_csp = settings.captcha_provider.to_csp_frame_src();
                                let style_csp = settings.captcha_provider.to_csp_style_src();
                                drop(settings);

                                Some(format!(
                                    "default-src 'self'; \
                                    script-src 'self' blob: {script_csp}; \
                                    frame-src 'self' {frame_csp}; \
                                    style-src 'self' 'unsafe-inline' {style_csp}; \
                                    connect-src *; \
                                    font-src 'self' blob: data:; \
                                    img-src * blob: data:; \
                                    media-src 'self' blob: data:; \
                                    object-src 'none' blob: data:; \
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
    openapi.info.version = state.version.clone();
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
                operation.tags = if let Some(group) = OPERATION_GROUPS
                    .iter()
                    .find(|g| original_path.starts_with(**g))
                {
                    Some(vec![group.to_string()])
                } else {
                    None
                };
            }
        }
    }

    let openapi = Arc::new(openapi);
    let router = router.route("/openapi.json", get(|| async move { axum::Json(openapi) }));

    let router = if state.env.bind.parse::<IpAddr>().is_ok() {
        router
    } else {
        #[cfg(unix)]
        {
            router.layer(axum::middleware::from_fn(
                |mut req: Request<Body>, next: Next| async move {
                    req.extensions_mut()
                        .insert(ConnectInfo(SocketAddr::from(([127, 0, 0, 1], 0))));
                    next.run(req).await
                },
            ))
        }
        #[cfg(not(unix))]
        {
            eprintln!("{}", "invalid bind address".red());
            std::process::exit(1);
        }
    };

    tracing::info!(
        "http server listening on {} (app@{}, {}ms)",
        state.env.bind,
        shared::VERSION,
        state.start_time.elapsed().as_millis()
    );

    let http_server = async {
        if let Ok(ip_addr) = state.env.bind.parse::<IpAddr>() {
            let listener = tokio::net::TcpListener::bind(SocketAddr::new(ip_addr, state.env.port))
                .await
                .unwrap();
            axum::serve(
                listener,
                ServiceExt::<Request>::into_make_service_with_connect_info::<SocketAddr>(
                    NormalizePathLayer::trim_trailing_slash().layer(router),
                ),
            )
            .await
            .unwrap();
        } else {
            #[cfg(unix)]
            {
                let _ = tokio::fs::remove_file(&state.env.bind).await;
                let listener = tokio::net::UnixListener::bind(&state.env.bind).unwrap();
                axum::serve(
                    listener,
                    ServiceExt::<Request>::into_make_service(
                        NormalizePathLayer::trim_trailing_slash().layer(router),
                    ),
                )
                .await
                .unwrap();
            }
            #[cfg(not(unix))]
            unreachable!()
        }
    };

    #[cfg(not(unix))]
    let sigterm_fut = futures_util::future::pending();
    #[cfg(unix)]
    let sigterm_fut = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .unwrap()
            .recv()
            .await;
    };

    tokio::select! {
        _ = http_server => {},
        _ = tokio::signal::ctrl_c() => {
            tracing::info!("CTRL-C received, shutting down...");
            shutdown_handlers.handle_shutdown().await;
        },
        _ = sigterm_fut => {
            tracing::info!("SIGTERM received, shutting down...");
            shutdown_handlers.handle_shutdown().await;
        }
    }
}
