use clap::{Args, FromArgMatches};
use colored::Colorize;
use compact_str::ToCompactString;
use dialoguer::{Confirm, Input, theme::ColorfulTheme};
use shared::models::CreatableModel;
use shared::models::IntoAdminApiObject;
use std::io::IsTerminal;

#[derive(Args)]
pub struct CreateArgs {
    #[arg(long = "json", help = "output the created node in JSON format")]
    json: bool,

    #[arg(
        long = "location-uuid",
        help = "the UUID of the location for this node"
    )]
    location_uuid: Option<String>,
    #[arg(
        long = "backup-configuration-uuid",
        help = "the UUID of the backup configuration (optional)"
    )]
    backup_configuration_uuid: Option<String>,
    #[arg(long = "name", help = "the name of the new node")]
    name: Option<String>,
    #[arg(long = "description", help = "a description for the new node")]
    description: Option<String>,
    #[arg(long = "url", help = "the URL of the node daemon")]
    url: Option<String>,
    #[arg(long = "public-url", help = "the public URL of the node (optional)")]
    public_url: Option<String>,
    #[arg(long = "sftp-host", help = "the SFTP host for the node (optional)")]
    sftp_host: Option<String>,
    #[arg(
        long = "sftp-port",
        help = "the SFTP port for the node",
        default_value = "2022"
    )]
    sftp_port: Option<u16>,
    #[arg(
        long = "memory",
        help = "the total memory available on this node in bytes"
    )]
    memory: Option<i64>,
    #[arg(
        long = "disk",
        help = "the total disk space available on this node in bytes"
    )]
    disk: Option<i64>,
    #[arg(
        long = "deployment-enabled",
        help = "whether deployment is enabled on this node"
    )]
    deployment_enabled: Option<bool>,
    #[arg(
        long = "maintenance-enabled",
        help = "whether maintenance mode is enabled on this node"
    )]
    maintenance_enabled: Option<bool>,
}

pub struct CreateCommand;

impl shared::extensions::commands::CliCommand<CreateArgs> for CreateCommand {
    fn get_command(&self, command: clap::Command) -> clap::Command {
        command
    }

    fn get_executor(self) -> Box<shared::extensions::commands::ExecutorFunc> {
        Box::new(|env, arg_matches| {
            Box::pin(async move {
                let args = CreateArgs::from_arg_matches(&arg_matches)?;
                let state = shared::AppState::new_cli(env).await?;

                let location_uuid = match args.location_uuid {
                    Some(location_uuid) => location_uuid,
                    None => {
                        if std::io::stdout().is_terminal() {
                            let location_uuid: String =
                                Input::with_theme(&ColorfulTheme::default())
                                    .with_prompt("Location UUID")
                                    .interact_text()?;
                            location_uuid
                        } else {
                            eprintln!(
                                "{}",
                                "location-uuid arg is required when not running in an interactive terminal"
                                    .red()
                            );
                            return Ok(1);
                        }
                    }
                };
                let location_uuid: uuid::Uuid = location_uuid
                    .parse()
                    .map_err(|e| anyhow::anyhow!("invalid location UUID: {e}"))?;

                let backup_configuration_uuid = match args.backup_configuration_uuid {
                    Some(uuid_str) => {
                        let uuid: uuid::Uuid = uuid_str.parse().map_err(|e| {
                            anyhow::anyhow!("invalid backup configuration UUID: {e}")
                        })?;
                        Some(uuid)
                    }
                    None => {
                        if std::io::stdout().is_terminal() {
                            let input: String = Input::with_theme(&ColorfulTheme::default())
                                .with_prompt("Backup Configuration UUID (leave empty to skip)")
                                .allow_empty(true)
                                .interact_text()?;
                            if input.is_empty() {
                                None
                            } else {
                                Some(input.parse().map_err(|e| {
                                    anyhow::anyhow!("invalid backup configuration UUID: {e}")
                                })?)
                            }
                        } else {
                            None
                        }
                    }
                };

                let name = match args.name {
                    Some(name) => name,
                    None => {
                        if std::io::stdout().is_terminal() {
                            let name: String = Input::with_theme(&ColorfulTheme::default())
                                .with_prompt("Name")
                                .interact_text()?;
                            name
                        } else {
                            eprintln!(
                                "{}",
                                "name arg is required when not running in an interactive terminal"
                                    .red()
                            );
                            return Ok(1);
                        }
                    }
                };

                let description = match args.description {
                    Some(description) => Some(description),
                    None => {
                        if std::io::stdout().is_terminal() {
                            let description: String = Input::with_theme(&ColorfulTheme::default())
                                .with_prompt("Description (leave empty to skip)")
                                .allow_empty(true)
                                .interact_text()?;
                            if description.is_empty() {
                                None
                            } else {
                                Some(description)
                            }
                        } else {
                            None
                        }
                    }
                };

                let url = match args.url {
                    Some(url) => url,
                    None => {
                        if std::io::stdout().is_terminal() {
                            let url: String = Input::with_theme(&ColorfulTheme::default())
                                .with_prompt("URL")
                                .interact_text()?;
                            url
                        } else {
                            eprintln!(
                                "{}",
                                "url arg is required when not running in an interactive terminal"
                                    .red()
                            );
                            return Ok(1);
                        }
                    }
                };

                let public_url = match args.public_url {
                    Some(public_url) => Some(public_url),
                    None => {
                        if std::io::stdout().is_terminal() {
                            let public_url: String = Input::with_theme(&ColorfulTheme::default())
                                .with_prompt("Public URL (leave empty to skip)")
                                .allow_empty(true)
                                .interact_text()?;
                            if public_url.is_empty() {
                                None
                            } else {
                                Some(public_url)
                            }
                        } else {
                            None
                        }
                    }
                };

                let sftp_host = match args.sftp_host {
                    Some(sftp_host) => Some(sftp_host),
                    None => {
                        if std::io::stdout().is_terminal() {
                            let sftp_host: String = Input::with_theme(&ColorfulTheme::default())
                                .with_prompt("SFTP Host (leave empty to skip)")
                                .allow_empty(true)
                                .interact_text()?;
                            if sftp_host.is_empty() {
                                None
                            } else {
                                Some(sftp_host)
                            }
                        } else {
                            None
                        }
                    }
                };

                let sftp_port = match args.sftp_port {
                    Some(sftp_port) => sftp_port,
                    None => {
                        if std::io::stdout().is_terminal() {
                            let sftp_port: u16 = Input::with_theme(&ColorfulTheme::default())
                                .with_prompt("SFTP Port")
                                .default(2022)
                                .interact_text()?;
                            sftp_port
                        } else {
                            2022
                        }
                    }
                };

                let memory = match args.memory {
                    Some(memory) => memory,
                    None => {
                        if std::io::stdout().is_terminal() {
                            let memory: i64 = Input::with_theme(&ColorfulTheme::default())
                                .with_prompt("Memory (bytes)")
                                .interact_text()?;
                            memory
                        } else {
                            eprintln!(
                                "{}",
                                "memory arg is required when not running in an interactive terminal"
                                    .red()
                            );
                            return Ok(1);
                        }
                    }
                };

                let disk = match args.disk {
                    Some(disk) => disk,
                    None => {
                        if std::io::stdout().is_terminal() {
                            let disk: i64 = Input::with_theme(&ColorfulTheme::default())
                                .with_prompt("Disk (bytes)")
                                .interact_text()?;
                            disk
                        } else {
                            eprintln!(
                                "{}",
                                "disk arg is required when not running in an interactive terminal"
                                    .red()
                            );
                            return Ok(1);
                        }
                    }
                };

                let deployment_enabled = match args.deployment_enabled {
                    Some(deployment_enabled) => deployment_enabled,
                    None => {
                        if std::io::stdout().is_terminal() {
                            let deployment_enabled: bool =
                                Confirm::with_theme(&ColorfulTheme::default())
                                    .with_prompt("Deployment Enabled?")
                                    .default(true)
                                    .interact()?;
                            deployment_enabled
                        } else {
                            true
                        }
                    }
                };

                let maintenance_enabled = match args.maintenance_enabled {
                    Some(maintenance_enabled) => maintenance_enabled,
                    None => {
                        if std::io::stdout().is_terminal() {
                            let maintenance_enabled: bool =
                                Confirm::with_theme(&ColorfulTheme::default())
                                    .with_prompt("Maintenance Enabled?")
                                    .default(false)
                                    .interact()?;
                            maintenance_enabled
                        } else {
                            false
                        }
                    }
                };

                let options = shared::models::node::CreateNodeOptions {
                    location_uuid,
                    backup_configuration_uuid,
                    name: name.into(),
                    description: description.map(|d| d.into()),
                    deployment_enabled,
                    maintenance_enabled,
                    public_url: public_url.map(|u| u.into()),
                    url: url.into(),
                    sftp_host: sftp_host.map(|h| h.into()),
                    sftp_port,
                    memory,
                    disk,
                };
                let node = shared::models::node::Node::create(&state, options).await?;

                if args.json {
                    eprintln!(
                        "{}",
                        serde_json::to_string_pretty(
                            &node.into_admin_api_object(&state, ()).await?
                        )?
                    );
                } else {
                    eprintln!(
                        "node {} created successfully",
                        node.uuid.to_compact_string().cyan()
                    );
                }

                Ok(0)
            })
        })
    }
}
