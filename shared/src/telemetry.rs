use compact_str::ToCompactString;
use serde::Serialize;
use std::collections::{BTreeMap, HashMap};
use utoipa::ToSchema;

nestify::nest! {
    #[derive(ToSchema, Serialize)] pub struct TelemetryData {
        pub uuid: uuid::Uuid,

        #[schema(inline)]
        pub panel: #[derive(ToSchema, Serialize)] pub struct TelemetryDataPanel {
            pub version: compact_str::CompactString,
            pub container_type: crate::AppContainerType,

            pub database_version: compact_str::CompactString,
            pub cache_version: compact_str::CompactString,

            pub architecture: &'static str,
            pub kernel_version: compact_str::CompactString,
        },

        #[schema(inline)]
        pub resources: #[derive(ToSchema, Serialize)] pub struct TelemetryDataResources {
            #[schema(inline)]
            pub users: #[derive(ToSchema, Serialize)] pub struct TelemetryDataResourcesUsers {
                pub total: u64,
                pub languages: BTreeMap<compact_str::CompactString, u64>,
            },

            #[schema(inline)]
            pub backups: #[derive(ToSchema, Serialize)] pub struct TelemetryDataResourcesBackups {
                pub total: u64,
                pub disks: HashMap<crate::models::server_backup::BackupDisk, u64>,
            },

            #[schema(inline)]
            pub servers: #[derive(ToSchema, Serialize)] pub struct TelemetryDataResourcesServers {
                pub total: u64,
            },
        },

        pub extensions: Vec<crate::extensions::ConstructedExtension>,

        #[schema(inline)]
        pub nodes: Vec<#[derive(ToSchema, Serialize)] pub struct TelemetryDataNode {
            pub version: compact_str::CompactString,
            pub container_type: wings_api::AppContainerType,

            #[schema(inline)]
            pub memory: wings_api::system_overview::get::Response200Memory,
            #[schema(inline)]
            pub servers: wings_api::system_overview::get::Response200Servers,

            pub architecture: compact_str::CompactString,
            pub kernel_version: compact_str::CompactString,
        }>,

        #[schema(inline)]
        pub database_agent_hosts: Vec<#[derive(ToSchema, Serialize)] pub struct TelemetryDataDatabaseAgentHost {
            pub version: compact_str::CompactString,
            pub container_type: db_agent_api::AppContainerType,

            #[schema(inline)]
            pub memory: db_agent_api::system_overview::get::Response200Memory,
            #[schema(inline)]
            pub instances: db_agent_api::system_overview::get::Response200Instances,

            pub architecture: compact_str::CompactString,
            pub kernel_version: compact_str::CompactString,
        }>,
    }
}

impl TelemetryData {
    pub async fn collect(state: &crate::State) -> Result<Self, anyhow::Error> {
        let settings = state.settings.get().await?;
        let uuid = settings.telemetry_uuid.unwrap_or_else(uuid::Uuid::new_v4);

        if settings.telemetry_uuid.is_none() {
            drop(settings);
            let mut new_settings = state.settings.get_mut().await?;
            new_settings.telemetry_uuid = Some(uuid);
            new_settings.save().await?;
        } else {
            drop(settings);
        }

        let mut node_results = Vec::new();
        let mut node_page = 1;
        loop {
            let nodes = crate::models::node::Node::all_with_pagination(
                &state.database,
                node_page,
                50,
                None,
            )
            .await?;
            if nodes.data.is_empty() {
                break;
            }

            for node in nodes.data {
                let overview = match node
                    .api_client(&state.database)
                    .await?
                    .get_system_overview()
                    .await
                {
                    Ok(overview) => overview,
                    Err(_) => continue,
                };

                node_results.push(TelemetryDataNode {
                    version: overview.version,
                    container_type: overview.container_type,
                    memory: overview.memory,
                    servers: overview.servers,
                    architecture: overview.architecture,
                    kernel_version: overview.kernel_version,
                });
            }

            node_page += 1;
        }

        let mut database_agent_host_results = Vec::new();
        let mut database_agent_host_page = 1;
        loop {
            let database_agent_hosts =
                crate::models::database_agent_host::DatabaseAgentHost::all_with_pagination(
                    &state.database,
                    database_agent_host_page,
                    50,
                    None,
                )
                .await?;
            if database_agent_hosts.data.is_empty() {
                break;
            }

            for database_agent_host in database_agent_hosts.data {
                let overview = match database_agent_host
                    .api_client(&state.database)
                    .await?
                    .get_system_overview()
                    .await
                {
                    Ok(overview) => overview,
                    Err(_) => continue,
                };

                database_agent_host_results.push(TelemetryDataDatabaseAgentHost {
                    version: overview.version,
                    container_type: overview.container_type,
                    memory: overview.memory,
                    instances: overview.instances,
                    architecture: overview.architecture,
                    kernel_version: overview.kernel_version,
                });
            }

            database_agent_host_page += 1;
        }

        let user_languages = sqlx::query!(
            "SELECT users.language, COUNT(*) as count
            FROM users
            GROUP BY users.language"
        )
        .fetch_all(state.database.read())
        .await?;
        let backup_disks = sqlx::query!(
            r#"SELECT server_backups.disk as "disk: crate::models::server_backup::BackupDisk", COUNT(*) as count
            FROM server_backups
            WHERE server_backups.completed IS NOT NULL AND server_backups.deleted IS NULL
            GROUP BY server_backups.disk"#
        )
        .fetch_all(state.database.read())
        .await?;
        let servers = sqlx::query!(
            "SELECT COUNT(*) as count
            FROM servers"
        )
        .fetch_one(state.database.read())
        .await?;

        Ok(Self {
            uuid,
            panel: TelemetryDataPanel {
                version: state.version.to_compact_string(),
                container_type: state.container_type,
                database_version: state.database.version().await?,
                cache_version: state.cache.version().await?,
                architecture: std::env::consts::ARCH,
                kernel_version: sysinfo::System::kernel_long_version().into(),
            },
            resources: TelemetryDataResources {
                users: TelemetryDataResourcesUsers {
                    total: user_languages
                        .iter()
                        .map(|r| r.count.unwrap_or(0) as u64)
                        .sum(),
                    languages: user_languages
                        .into_iter()
                        .map(|r| (r.language.into(), r.count.unwrap_or(0) as u64))
                        .collect(),
                },
                backups: TelemetryDataResourcesBackups {
                    total: backup_disks
                        .iter()
                        .map(|r| r.count.unwrap_or(0) as u64)
                        .sum(),
                    disks: backup_disks
                        .into_iter()
                        .map(|r| (r.disk, r.count.unwrap_or(0) as u64))
                        .collect(),
                },
                servers: TelemetryDataResourcesServers {
                    total: servers.count.unwrap_or(0) as u64,
                },
            },
            extensions: state.extensions.extensions().await.clone(),
            nodes: node_results,
            database_agent_hosts: database_agent_host_results,
        })
    }
}
