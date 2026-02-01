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
use rand::Rng;
use sentry_tower::SentryHttpLayer;
use sha2::Digest;
use shared::{
    ApiError, FRONTEND_ASSETS, GetState, extensions::commands::CliCommandGroupBuilder,
    response::ApiResponse,
};
use std::{net::SocketAddr, path::PathBuf, sync::Arc, time::Instant};
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
        "http {} {}{}",
        req.method().to_string().to_lowercase(),
        req.uri().path().cyan(),
        if let Some(query) = req.uri().query() {
            format!("?{query}")
        } else {
            "".to_string()
        }
        .bright_cyan()
    );

    Ok(shared::response::ACCEPT_HEADER
        .scope(
            shared::response::accept_from_headers(req.headers()),
            async { next.run(req).await },
        )
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
        (etag.to_str().unwrap().to_string(), response)
    } else {
        let (mut parts, body) = response.into_parts();
        let body_bytes = axum::body::to_bytes(body, usize::MAX).await.unwrap();

        let mut hash = sha2::Sha256::new();
        hash.update(body_bytes.as_ref());
        let hash = format!("{:x}", hash.finalize());

        parts.headers.insert("ETag", hash.parse().unwrap());

        (hash, Response::from_parts(parts, Body::from(body_bytes)))
    };

    if if_none_match == Some(etag) {
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

    match cli.get_matches().remove_subcommand() {
        Some((command, arg_matches)) => {
            if let Some((func, arg_matches)) = cli.match_command(command, arg_matches) {
                match func(env.as_ref().ok().map(|e| e.0.clone()), arg_matches).await {
                    Ok(()) => {
                        std::process::exit(0);
                    }
                    Err(err) => {
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
            tracing::info!(
                "{: >21} |_|  |___/",
                format!("{} (git-{})", shared::VERSION, shared::GIT_COMMIT)
            );
            tracing::info!("github.com/calagopus/panel\n");
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
            release: Some(
                format!(
                    "{}:{}@{}",
                    shared::VERSION,
                    shared::GIT_COMMIT,
                    shared::GIT_BRANCH
                )
                .into(),
            ),
            traces_sample_rate: 1.0,
            ..Default::default()
        },
    ));

    let jwt = Arc::new(shared::jwt::Jwt::new(&env));
    let cache = Arc::new(shared::cache::Cache::new(&env).await);
    let database = Arc::new(shared::database::Database::new(&env, cache.clone()).await);

    if env.database_migrate {
        tracing::info!("running database migrations...");
        match database.migrate().await {
            Ok(_) => tracing::info!("database migrations completed successfully"),
            Err(err) => {
                tracing::error!("failed to run database migrations: {:?}", err);
                std::process::exit(1);
            }
        }
    }

    let background_tasks =
        Arc::new(shared::extensions::background_tasks::BackgroundTaskManager::default());
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
        version: format!(
            "{}:{}@{}",
            shared::VERSION,
            shared::GIT_COMMIT,
            shared::GIT_BRANCH
        ),

        client: reqwest::ClientBuilder::new()
            .user_agent(format!("github.com/calagopus/panel {}", shared::VERSION))
            .build()
            .unwrap(),

        extensions: extensions.clone(),
        background_tasks: background_tasks.clone(),
        settings: settings.clone(),
        jwt,
        storage,
        captcha,
        mail,
        database: database.clone(),
        cache: cache.clone(),
        env,
    });

    let (routes, background_task_builder) = extensions.init(state.clone()).await;
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

    background_task_builder
        .add_task(
            "collect_telemetry",
            Box::new(|state| {
                Box::pin(async move {
                    fn generate_randomized_cron_schedule() -> cron::Schedule {
                        let mut rng = rand::rng();
                        let seconds: u8 = rng.random_range(0..60);
                        let minutes: u8 = rng.random_range(0..60);
                        let hours: u8 = rng.random_range(0..24);

                        format!("{} {} {} * * *", seconds, minutes, hours)
                            .parse()
                            .unwrap()
                    }

                    let settings = state.settings.get().await?;
                    if !settings.app.telemetry_enabled {
                        drop(settings);
                        tokio::time::sleep(std::time::Duration::from_mins(60)).await;

                        return Ok(());
                    }
                    let cron_schedule = settings
                        .telemetry_cron_schedule
                        .clone()
                        .unwrap_or_else(generate_randomized_cron_schedule);
                    if settings.telemetry_cron_schedule.is_none() {
                        drop(settings);
                        let mut new_settings = state.settings.get_mut().await?;
                        new_settings.telemetry_cron_schedule = Some(cron_schedule.clone());
                        new_settings.save().await?;
                    } else {
                        drop(settings);
                    }

                    let schedule_iter = cron_schedule.upcoming(chrono::Utc);

                    for target_datetime in schedule_iter {
                        let target_timestamp = target_datetime.timestamp();
                        let now_timestamp = chrono::Utc::now().timestamp();
                        let sleep_duration = target_timestamp - now_timestamp;
                        if sleep_duration <= 0 {
                            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                            continue;
                        }

                        tokio::time::sleep(std::time::Duration::from_secs(sleep_duration as u64))
                            .await;

                        let telemetry_data =
                            match shared::telemetry::TelemetryData::collect(&state).await {
                                Ok(data) => data,
                                Err(err) => {
                                    tracing::error!("failed to collect telemetry data: {:#?}", err);
                                    continue;
                                }
                            };

                        if let Err(err) = state
                            .client
                            .post("https://calagopus.com/api/telemetry")
                            .json(&telemetry_data)
                            .send()
                            .await
                        {
                            tracing::error!("failed to send telemetry data: {:#?}", err);
                        } else {
                            tracing::info!("successfully sent telemetry data");
                        }
                    }

                    Ok(())
                })
            }),
        )
        .await;
    background_task_builder
        .add_task(
            "delete_expired_sessions",
            Box::new(|state| {
                Box::pin(async move {
                    let deleted_sessions =
                        shared::models::user_session::UserSession::delete_unused(&state.database)
                            .await?;
                    if deleted_sessions > 0 {
                        tracing::info!("deleted {} expired user sessions", deleted_sessions);
                    }

                    tokio::time::sleep(std::time::Duration::from_mins(5)).await;

                    Ok(())
                })
            }),
        )
        .await;
    background_task_builder
        .add_task(
            "delete_expired_api_keys",
            Box::new(|state| {
                Box::pin(async move {
                    let deleted_api_keys =
                        shared::models::user_api_key::UserApiKey::delete_expired(&state.database)
                            .await?;
                    if deleted_api_keys > 0 {
                        tracing::info!("deleted {} expired user api keys", deleted_api_keys);
                    }

                    tokio::time::sleep(std::time::Duration::from_mins(30)).await;

                    Ok(())
                })
            }),
        )
        .await;
    background_task_builder
        .add_task(
            "delete_old_activity",
            Box::new(|state| {
                Box::pin(async move {
                    let settings = state.settings.get().await?;
                    let admin_retention_days = settings.activity.admin_log_retention_days;
                    let user_retention_days = settings.activity.user_log_retention_days;
                    let server_retention_days = settings.activity.server_log_retention_days;
                    drop(settings);

                    let deleted_admin_activity =
                        shared::models::admin_activity::AdminActivity::delete_older_than(
                            &state.database,
                            chrono::Utc::now()
                                - chrono::Duration::days(admin_retention_days as i64),
                        )
                        .await?;
                    if deleted_admin_activity > 0 {
                        tracing::info!(
                            "deleted {} old admin activity logs",
                            deleted_admin_activity
                        );
                    }

                    let deleted_user_activity =
                        shared::models::user_activity::UserActivity::delete_older_than(
                            &state.database,
                            chrono::Utc::now() - chrono::Duration::days(user_retention_days as i64),
                        )
                        .await?;
                    if deleted_user_activity > 0 {
                        tracing::info!("deleted {} old user activity logs", deleted_user_activity);
                    }

                    let deleted_server_activity =
                        shared::models::server_activity::ServerActivity::delete_older_than(
                            &state.database,
                            chrono::Utc::now()
                                - chrono::Duration::days(server_retention_days as i64),
                        )
                        .await?;
                    if deleted_server_activity > 0 {
                        tracing::info!(
                            "deleted {} old server activity logs",
                            deleted_server_activity
                        );
                    }

                    tokio::time::sleep(std::time::Duration::from_hours(1)).await;

                    Ok(())
                })
            }),
        )
        .await;

    background_tasks
        .merge_builder(background_task_builder)
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
        .fallback(|state: GetState, req: Request<Body>| async move {
            if !req.uri().path().starts_with("/api") {
                let path = &req.uri().path()[1.min(req.uri().path().len())..];

                let (is_index, entry) = match FRONTEND_ASSETS.get_entry(path) {
                    Some(entry) => (false, entry),
                    None => (true, FRONTEND_ASSETS.get_entry("index.html").unwrap()),
                };

                if entry.as_file().is_none() && path.starts_with("assets") {
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

                    let metadata = match base_filesystem.async_metadata(path).await {
                        Ok(metadata) => metadata,
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

                    return ApiResponse::new(Body::from_stream(tokio_util::io::ReaderStream::new(
                        tokio_file,
                    )))
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
                                script-src 'self' {script_csp}; \
                                frame-src 'self' {frame_csp}; \
                                style-src 'self' 'unsafe-inline' {style_csp}; \
                                connect-src *; \
                                font-src 'self'; \
                                img-src *; \
                                media-src 'self'; \
                                object-src 'none'; \
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
        })
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            handle_request,
        ))
        .layer(CookieManagerLayer::new())
        .layer(axum::middleware::from_fn(handle_postprocessing))
        .route_layer(SentryHttpLayer::new().enable_transaction())
        .with_state(state.clone());

    let listener = tokio::net::TcpListener::bind(format!("{}:{}", &state.env.bind, state.env.port))
        .await
        .unwrap();

    tracing::info!(
        "{} listening on {} {}",
        "http server".bright_red(),
        state.env.bind.cyan(),
        format!(
            "(app@{}, {}ms)",
            shared::VERSION,
            state.start_time.elapsed().as_millis()
        )
        .bright_black()
    );

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

    for (path, item) in openapi.paths.paths.iter_mut() {
        let operations = [
            ("get", &mut item.get),
            ("post", &mut item.post),
            ("put", &mut item.put),
            ("patch", &mut item.patch),
            ("delete", &mut item.delete),
        ];

        let path = path
            .replace('/', "_")
            .replace(|c| ['{', '}'].contains(&c), "");

        for (method, operation) in operations {
            if let Some(operation) = operation {
                operation.operation_id = Some(format!("{method}{path}"))
            }
        }
    }

    let openapi = Arc::new(openapi);
    let router = router.route("/openapi.json", get(|| async move { axum::Json(openapi) }));

    let http_server = async {
        axum::serve(
            listener,
            ServiceExt::<Request>::into_make_service_with_connect_info::<SocketAddr>(
                NormalizePathLayer::trim_trailing_slash().layer(router),
            ),
        )
        .await
        .unwrap();
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
        },
        _ = sigterm_fut => {
            tracing::info!("SIGTERM received, shutting down...");
        }
    }
}
