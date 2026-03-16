use clap::{Args, FromArgMatches};
use colored::Colorize;
use std::{collections::BTreeMap, sync::Arc};

#[derive(Args)]
pub struct StatusArgs {
    #[arg(
        long = "live",
        help = "whether to use the on-disk migrations instead of the embedded migrations",
        default_value = "false"
    )]
    live: bool,
}

pub struct StatusCommand;

impl shared::extensions::commands::CliCommand<StatusArgs> for StatusCommand {
    fn get_command(&self, command: clap::Command) -> clap::Command {
        command
    }

    fn get_executor(self) -> Box<shared::extensions::commands::ExecutorFunc> {
        Box::new(|env, arg_matches| {
            Box::pin(async move {
                let args = StatusArgs::from_arg_matches(&arg_matches)?;

                let env = match env {
                    Some(env) => env,
                    None => {
                        eprintln!(
                            "{}",
                            "please setup the panel environment before using this tool.".red()
                        );

                        return Ok(1);
                    }
                };

                let cache = shared::cache::Cache::new(&env).await;
                let database = Arc::new(shared::database::Database::new(&env, cache.clone()).await);

                crate::ensure_migrations_table(database.write()).await?;

                tracing::info!("fetching applied migrations...");
                let applied_migrations = crate::fetch_applied_migrations(database.write()).await?;

                let migrations = if args.live {
                    let live_path = match () {
                        _ if tokio::fs::metadata("migrations").await.is_ok() => "migrations",
                        _ if tokio::fs::metadata("database/migrations").await.is_ok() => {
                            "database/migrations"
                        }
                        _ if tokio::fs::metadata("../database/migrations").await.is_ok() => {
                            "../database/migrations"
                        }
                        _ => {
                            tracing::error!(
                                "failed to find live migrations folder, expected one of: ./migrations, ./database/migrations, ../database/migrations"
                            );
                            return Ok(1);
                        }
                    };

                    tracing::info!("collecting migrations from filesystem...");
                    crate::collect_migrations(live_path).await?
                } else {
                    tracing::info!("collecting embedded migrations...");
                    crate::collect_embedded_migrations()?
                };

                tracing::info!("found {} migrations.", migrations.len());
                tracing::info!("migration status:");

                tokio::time::sleep(std::time::Duration::from_millis(100)).await;

                for migration in migrations {
                    let applied = applied_migrations
                        .iter()
                        .find(|m| m.id == migration.snapshot.id);

                    if let Some(applied) = applied {
                        println!(
                            "  {} {} (applied at {})",
                            "✔".green(),
                            migration.name.bright_green(),
                            applied.applied
                        );
                    } else {
                        println!("  {} {} (pending)", "✘".red(), migration.name.bright_red());
                    }
                }

                let mut extension_migrations = BTreeMap::new();
                if args.live {
                    let live_path = match () {
                        _ if tokio::fs::metadata("extension-migrations").await.is_ok() => {
                            "extension-migrations"
                        }
                        _ if tokio::fs::metadata("database/extension-migrations")
                            .await
                            .is_ok() =>
                        {
                            "database/extension-migrations"
                        }
                        _ if tokio::fs::metadata("../database/extension-migrations")
                            .await
                            .is_ok() =>
                        {
                            "../database/extension-migrations"
                        }
                        _ => {
                            tracing::error!(
                                "failed to find live migrations folder, expected one of: ./extension-migrations, ./database/extension-migrations, ../database/extension-migrations"
                            );
                            return Ok(1);
                        }
                    };

                    tracing::info!("collecting extension migrations from filesystem...");

                    let mut dir_entries = tokio::fs::read_dir(live_path).await?;
                    while let Some(entry) = dir_entries.next_entry().await? {
                        let file_type = entry.file_type().await?;
                        if file_type.is_dir() {
                            let extension_identifier =
                                entry.file_name().to_string_lossy().to_string();
                            let migrations = crate::collect_extension_migrations(
                                entry.path(),
                                &extension_identifier,
                            )
                            .await?;

                            extension_migrations.insert(extension_identifier, migrations);
                        }
                    }
                } else {
                    tracing::info!("collecting embedded migrations...");

                    for entry in crate::EXTENSION_MIGRATIONS.dirs() {
                        let extension_identifier = match entry.path().file_name() {
                            Some(name) => name.to_string_lossy().to_string(),
                            None => continue,
                        };
                        let migrations =
                            crate::collect_embedded_extension_migrations(&extension_identifier)?;

                        extension_migrations.insert(extension_identifier, migrations);
                    }
                }

                if !extension_migrations.is_empty() {
                    println!();
                    tracing::info!("extension migration status:");

                    for (extension_identifier, migrations) in extension_migrations {
                        println!("  {}", shared::extensions::distr::MetadataToml::convert_identifier_to_package_name(&extension_identifier).bright_blue());

                        for migration in migrations {
                            let applied = applied_migrations.iter().find(|m| m.id == migration.id);

                            if let Some(applied) = applied {
                                println!(
                                    "    {} {} (applied at {})",
                                    "✔".green(),
                                    migration.name.bright_green(),
                                    applied.applied
                                );
                            } else {
                                println!(
                                    "    {} {} (pending)",
                                    "✘".red(),
                                    migration.name.bright_red()
                                );
                            }
                        }
                    }
                }

                Ok(0)
            })
        })
    }
}
