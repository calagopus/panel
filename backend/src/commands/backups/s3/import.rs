use clap::{Args, FromArgMatches};
use colored::Colorize;
use compact_str::ToCompactString;
use dialoguer::{Input, theme::ColorfulTheme};
use shared::models::{
    BaseModel, ByUuid, backup_configuration::BackupConfiguration, server::Server,
    server_backup::ServerBackup,
};
use std::io::IsTerminal;

#[derive(Args)]
pub struct ImportArgs {
    #[arg(long = "json", help = "output the imported backups in JSON format")]
    json: bool,

    #[arg(
        long = "backup-configuration",
        help = "the uuid of the backup configuration to use for the import"
    )]
    backup_configuration: Option<String>,
}

pub struct ImportCommand;

impl shared::extensions::commands::CliCommand<ImportArgs> for ImportCommand {
    fn get_command(&self, command: clap::Command) -> clap::Command {
        command
    }

    fn get_executor(self) -> Box<shared::extensions::commands::ExecutorFunc> {
        Box::new(|env, arg_matches| {
            Box::pin(async move {
                let args = ImportArgs::from_arg_matches(&arg_matches)?;
                let state = shared::AppState::new_cli(env).await?;

                let backup_configuration = match args.backup_configuration {
                    Some(backup_configuration) => backup_configuration,
                    None => {
                        if std::io::stdout().is_terminal() {
                            let backup_configuration: String =
                                Input::with_theme(&ColorfulTheme::default())
                                    .with_prompt("Backup Configuration")
                                    .interact_text()?;
                            backup_configuration
                        } else {
                            eprintln!("{}", "backup-configuration arg is required when not running in an interactive terminal".red());
                            return Ok(1);
                        }
                    }
                };

                let backup_configuration = if let Ok(backup_configuration) =
                    backup_configuration.parse()
                {
                    match BackupConfiguration::by_uuid(&state.database, backup_configuration).await
                    {
                        Ok(backup_configuration) => backup_configuration,
                        Err(err) => {
                            eprintln!(
                                "{}",
                                format!("failed to find backup configuration: {}", err).red()
                            );
                            return Ok(1);
                        }
                    }
                } else {
                    eprintln!("{}", "invalid backup configuration uuid".red());
                    return Ok(1);
                };

                let Some(mut s3) = backup_configuration.backup_configs.s3 else {
                    eprintln!("{}", "backup configuration does not have S3 config".red());
                    return Ok(1);
                };

                s3.decrypt(&state.database).await?;

                let s3_client = s3.into_client()?;
                let storage_url_retriever = state.storage.retrieve_urls().await?;

                let mut imported_count = 0;
                let mut skipped_count = 0;
                let mut imported_backups = Vec::new();
                let mut continuation_token = None;

                loop {
                    let (objects, _) = s3_client
                        .list_page("".into(), None, continuation_token, None, Some(1000))
                        .await?;

                    for object in objects.contents {
                        let parts: Vec<&str> = object.key.split('/').collect();
                        if parts.len() != 2 {
                            println!(
                                "{} {}",
                                "skipping object with invalid key:".red(),
                                object.key.cyan()
                            );
                            skipped_count += 1;
                            continue;
                        }

                        let server_uuid: uuid::Uuid = match parts[0].parse() {
                            Ok(uuid) => uuid,
                            Err(_) => {
                                println!(
                                    "{} {}",
                                    "skipping object with invalid server uuid:".red(),
                                    object.key.cyan()
                                );
                                skipped_count += 1;
                                continue;
                            }
                        };

                        let backup_uuid_str = parts[1].split('.').next().unwrap_or("");
                        let backup_uuid: uuid::Uuid = match backup_uuid_str.parse() {
                            Ok(uuid) => uuid,
                            Err(_) => {
                                println!(
                                    "{} {}",
                                    "skipping object with invalid backup uuid:".red(),
                                    object.key.cyan()
                                );
                                skipped_count += 1;
                                continue;
                            }
                        };

                        let backup_exists: bool = sqlx::query_scalar(
                            "SELECT EXISTS(SELECT 1 FROM server_backups WHERE server_backups.uuid = $1)",
                        )
                        .bind(backup_uuid)
                        .fetch_one(state.database.read())
                        .await?;

                        if backup_exists {
                            println!(
                                "{} {}",
                                "skipping backup with uuid that already exists:".red(),
                                backup_uuid.to_compact_string().cyan()
                            );
                            skipped_count += 1;
                            continue;
                        }

                        println!(
                            "importing backup {} for server {}...",
                            backup_uuid.to_compact_string().cyan(),
                            server_uuid.to_compact_string().cyan()
                        );

                        let server =
                            match Server::by_uuid_optional_cached(&state.database, server_uuid)
                                .await?
                            {
                                Some(server) => server,
                                None => {
                                    println!(
                                        "{} {}",
                                        "skipping backup for non-existent server uuid:".red(),
                                        server_uuid.to_compact_string().cyan()
                                    );
                                    skipped_count += 1;
                                    continue;
                                }
                            };

                        let row = sqlx::query(&format!(
                            r#"
                            INSERT INTO server_backups (uuid, server_uuid, node_uuid, backup_configuration_uuid, name, ignored_files, checksum, successful, bytes, disk, upload_path, completed)
                            VALUES ($1, $2, $3, $4, $5, $6, 'sha1:unknown', true, $7, $8, $9, NOW())
                            RETURNING {}
                            "#,
                            ServerBackup::columns_sql(None)
                        ))
                        .bind(backup_uuid)
                        .bind(server.uuid)
                        .bind(server.node.uuid)
                        .bind(backup_configuration.uuid)
                        .bind(compact_str::format_compact!("Imported Backup {}", backup_uuid.to_compact_string()))
                        .bind(&[] as &[&str])
                        .bind(object.size as i64)
                        .bind(backup_configuration.backup_disk)
                        .bind(&object.key)
                        .fetch_one(state.database.write())
                        .await?;

                        let backup = ServerBackup::map(None, &row)?;

                        println!(
                            "backup {} imported successfully",
                            backup.uuid.to_compact_string().cyan()
                        );

                        if args.json {
                            imported_backups.push(
                                backup
                                    .into_admin_node_api_object(
                                        &state.database,
                                        &storage_url_retriever,
                                    )
                                    .await?,
                            );
                        }

                        imported_count += 1;
                    }

                    if objects.next_continuation_token.is_none() {
                        break;
                    }

                    continuation_token = objects.next_continuation_token;
                }

                if args.json {
                    eprintln!("{}", serde_json::to_string_pretty(&imported_backups)?);
                } else {
                    println!(
                        "imported {} backups successfully, skipped {} backups",
                        imported_count.to_string().cyan(),
                        skipped_count.to_string().cyan()
                    );
                }

                Ok(0)
            })
        })
    }
}
