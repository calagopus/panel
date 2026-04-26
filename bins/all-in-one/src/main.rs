use anyhow::Context;
use axum::{
    ServiceExt,
    body::Body,
    extract::{ConnectInfo, Request},
    middleware::Next,
};
use colored::Colorize;
use shared::models::{
    ByUuid, CreatableModel, UpdatableModel, backup_configuration::BackupConfiguration,
    location::Location, node::Node,
};
use std::{
    net::{IpAddr, SocketAddr},
    path::PathBuf,
};
use tokio::io::AsyncBufReadExt;
use tower::Layer;
use tower_http::normalize_path::NormalizePathLayer;

mod bins;

#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
#[global_allocator]
static ALLOC: tikv_jemallocator::Jemalloc = tikv_jemallocator::Jemalloc;

async fn handle_aio_wings(state: &shared::State) -> Result<(), anyhow::Error> {
    let node = match Node::by_uuid_optional(&state.database, Node::AIO_NODE_UUID).await? {
        Some(mut node) => {
            node.update(
                state,
                shared::models::node::UpdateNodeOptions {
                    url: Some("http://localhost:64332".into()),
                    public_url: Some(None),
                    ..Default::default()
                },
            )
            .await?;

            node
        }
        None => {
            let location = match Location::all_with_pagination(&state.database, 1, 1, None)
                .await?
                .data
                .pop()
            {
                Some(location) => location,
                None => {
                    tracing::info!("creating aio wings location...");

                    let backup_configuration = match BackupConfiguration::all_with_pagination(
                        &state.database,
                        1,
                        1,
                        None,
                    )
                    .await?
                    .data
                    .pop()
                    {
                        Some(backup_configuration) => backup_configuration,
                        None => {
                            tracing::info!("creating aio wings backup configuration...");
                            BackupConfiguration::create(state,shared::models::backup_configuration::CreateBackupConfigurationOptions {
                                name: "Integrated Backup Configuration".into(),
                                description: None,
                                maintenance_enabled: false,
                                backup_disk: shared::models::server_backup::BackupDisk::Local,
                                backup_configs: Default::default(),
                            }).await?
                        }
                    };

                    Location::create(
                        state,
                        shared::models::location::CreateLocationOptions {
                            backup_configuration_uuid: Some(backup_configuration.uuid),
                            name: "Integrated Location".into(),
                            description: None,
                        },
                    )
                    .await?
                }
            };

            let mut system = sysinfo::System::new();
            system.refresh_memory();
            let mut disks = sysinfo::Disks::new();
            disks.refresh(true);

            let disk = disks
                .iter()
                .find(|d| d.mount_point() == std::path::Path::new("/"))
                .unwrap_or(&disks[0]);

            tracing::info!("creating aio wings node...");
            let node = Node::create(
                state,
                shared::models::node::CreateNodeOptions {
                    location_uuid: location.uuid,
                    backup_configuration_uuid: None,
                    name: "Integrated Node".into(),
                    description: None,
                    deployment_enabled: true,
                    maintenance_enabled: false,
                    public_url: None,
                    url: "http://localhost:64332".into(),
                    sftp_host: None,
                    sftp_port: 2022,
                    memory: system.total_memory() as i64 / 1024 / 1024,
                    disk: disk.total_space() as i64 / 1024 / 1024,
                },
            )
            .await?;

            sqlx::query!(
                "UPDATE nodes SET uuid = $2 WHERE nodes.uuid = $1",
                node.uuid,
                Node::AIO_NODE_UUID
            )
            .execute(state.database.write())
            .await?;

            node
        }
    };

    let (token_id, token) = node.reset_token(state).await?;

    let (mut wings_configuration, path) =
        if let Some(config_path) = &state.env.aio_base_wings_configuration {
            tracing::info!("using aio base wings configuration from environment variable");
            (
                serde_norway::from_str(
                    &tokio::fs::read_to_string(config_path)
                        .await
                        .context("failed to read aio base wings configuration file")?,
                )
                .unwrap_or_else(|_| serde_norway::Value::Mapping(serde_norway::Mapping::new())),
                PathBuf::from(config_path),
            )
        } else {
            (
                serde_norway::Value::Mapping(serde_norway::Mapping::new()),
                std::env::temp_dir().join("aio-wings-config.yml"),
            )
        };

    let Some(mapping) = wings_configuration.as_mapping_mut() else {
        return Err(anyhow::anyhow!(
            "invalid aio base wings configuration: expected a mapping at the root"
        ));
    };

    mapping.insert(
        serde_norway::Value::String("uuid".into()),
        serde_norway::Value::String(node.uuid.to_string()),
    );
    mapping.insert(
        serde_norway::Value::String("token_id".into()),
        serde_norway::Value::String(token_id.to_string()),
    );
    mapping.insert(
        serde_norway::Value::String("token".into()),
        serde_norway::Value::String(token.clone()),
    );
    mapping.insert(
        serde_norway::Value::String("remote".into()),
        serde_norway::Value::String(format!("http://localhost:{}", state.env.port)),
    );
    {
        let api_mapping = match mapping.get_mut(serde_norway::Value::String("api".into())) {
            Some(serde_norway::Value::Mapping(api_mapping)) => api_mapping,
            _ => {
                let api_mapping = serde_norway::Mapping::new();
                mapping.insert(
                    serde_norway::Value::String("api".into()),
                    serde_norway::Value::Mapping(api_mapping),
                );
                match mapping.get_mut(serde_norway::Value::String("api".into())) {
                    Some(serde_norway::Value::Mapping(api_mapping)) => api_mapping,
                    _ => unreachable!(),
                }
            }
        };

        api_mapping.insert(
            serde_norway::Value::String("host".into()),
            serde_norway::Value::String("127.0.0.1".into()),
        );
        api_mapping.insert(
            serde_norway::Value::String("port".into()),
            serde_norway::Value::Number(64332.into()),
        );
        api_mapping.insert(
            serde_norway::Value::String("upload_limit".into()),
            serde_norway::Value::Number(10240.into()),
        );
        api_mapping.insert(
            serde_norway::Value::String("trusted_proxies".into()),
            serde_norway::Value::Sequence(vec![
                serde_norway::Value::String("127.0.0.1".into()),
                serde_norway::Value::String("::1".into()),
            ]),
        );
    }

    tokio::fs::write(&path, serde_norway::to_string(&wings_configuration)?).await?;

    let wings_bin = bins::get_wings_bin_path().await?;

    tokio::spawn(async move {
        let mut cmd = tokio::process::Command::new(wings_bin);
        cmd.arg("--config").arg(&path);
        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::piped());

        let mut child = cmd.spawn().expect("failed to spawn aio wings process");

        let stdout = child.stdout.take().unwrap();
        let stderr = child.stderr.take().unwrap();

        let stdout_task = async {
            let reader = tokio::io::BufReader::new(stdout);
            let mut lines = reader.lines();

            while let Ok(Some(line)) = lines.next_line().await {
                println!("[wings] {}", line);
            }
        };

        let stderr_task = async {
            let reader = tokio::io::BufReader::new(stderr);
            let mut lines = reader.lines();

            while let Ok(Some(line)) = lines.next_line().await {
                eprintln!("[wings] {}", line);
            }
        };

        tokio::join!(stdout_task, stderr_task);
    });

    Ok(())
}

#[tokio::main]
async fn main() {
    let (_guard, _env_guard, state) = backend::handle_startup().await;

    let router = state
        .app_router
        .read()
        .await
        .clone()
        .expect("router not initialized");

    if let Err(err) = handle_aio_wings(&state).await {
        eprintln!("{} {}", "error handling aio wings:".red(), err);
        std::process::exit(1);
    }

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
            state.shutdown_handlers.handle_shutdown().await;
        },
        _ = sigterm_fut => {
            tracing::info!("SIGTERM received, shutting down...");
            state.shutdown_handlers.handle_shutdown().await;
        }
    }
}
