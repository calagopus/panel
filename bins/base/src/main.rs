use axum::ServiceExt;
use std::net::{IpAddr, SocketAddr};
use tower::Layer;
use tower_http::normalize_path::NormalizePathLayer;

#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
#[global_allocator]
static ALLOC: tikv_jemallocator::Jemalloc = tikv_jemallocator::Jemalloc;

#[tokio::main]
async fn main() {
    let (_guard, _env_guard, state) = backend::handle_startup().await;

    let router = state
        .app_router
        .read()
        .await
        .clone()
        .expect("router not initialized");

    let router = if state.env.bind.parse::<IpAddr>().is_ok() {
        router
    } else {
        #[cfg(unix)]
        {
            router.layer(axum::middleware::from_fn(
                |mut req: axum::extract::Request<axum::body::Body>,
                 next: axum::middleware::Next| async move {
                    req.extensions_mut()
                        .insert(axum::extract::ConnectInfo(SocketAddr::from((
                            [127, 0, 0, 1],
                            0,
                        ))));
                    next.run(req).await
                },
            ))
        }
        #[cfg(not(unix))]
        {
            use colored::Colorize;

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
                ServiceExt::<axum::extract::Request>::into_make_service_with_connect_info::<
                    SocketAddr,
                >(NormalizePathLayer::trim_trailing_slash().layer(router)),
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
                    ServiceExt::<axum::extract::Request>::into_make_service(
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
            state.shutdown_handlers.handle_shutdown().await;
        },
        _ = sigterm_fut => {
            tracing::info!("SIGTERM received, shutting down...");
            state.shutdown_handlers.handle_shutdown().await;
        }
    }
}
