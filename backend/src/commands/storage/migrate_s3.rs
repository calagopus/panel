use clap::{Args, FromArgMatches};
use colored::Colorize;
use shared::settings::StorageDriver;
use std::path::Path;

#[derive(Args)]
pub struct MigrateS3Args {
    #[arg(
        help = "path to the local storage directory to migrate",
        value_hint = clap::ValueHint::DirPath
    )]
    path: String,
}

pub struct MigrateS3Command;

impl shared::extensions::commands::CliCommand<MigrateS3Args> for MigrateS3Command {
    fn get_command(&self, command: clap::Command) -> clap::Command {
        command
    }

    fn get_executor(self) -> Box<shared::extensions::commands::ExecutorFunc> {
        Box::new(|env, arg_matches| {
            Box::pin(async move {
                let args = MigrateS3Args::from_arg_matches(&arg_matches)?;
                let state = shared::AppState::new_cli(env).await?;

                let settings = state.settings.get().await?;
                if !matches!(settings.storage_driver, StorageDriver::S3 { .. }) {
                    eprintln!(
                        "{}",
                        "the storage driver in the panel settings must be S3 to migrate to it"
                            .red()
                    );
                    return Ok(1);
                }
                drop(settings);

                let source = match shared::cap::CapFilesystem::new(Path::new(&args.path)).await {
                    Ok(source) => source,
                    Err(err) => {
                        eprintln!(
                            "{}",
                            format!("failed to open source directory {}: {}", args.path, err).red()
                        );
                        return Ok(1);
                    }
                };

                let mut migrated_count = 0;
                let mut failed_count = 0;

                let mut walker = source.async_walk_dir("").await?;
                while let Some(entry) = walker.next_entry().await {
                    let path = match entry {
                        Ok(entry) if entry.file_type().is_dir() => continue,
                        Ok(entry) => entry.path,
                        Err(err) => {
                            eprintln!("{}", format!("failed to read directory: {}", err).red());
                            failed_count += 1;
                            continue;
                        }
                    };

                    let Some(key) = path.to_str().map(|key| key.replace('\\', "/")) else {
                        eprintln!(
                            "{} {}",
                            "skipping file with non-utf8 path:".red(),
                            path.display().to_string().cyan()
                        );
                        failed_count += 1;
                        continue;
                    };

                    let cache_control = if key.starts_with("avatars/")
                        || key.starts_with("publicdata/egg-repositories/")
                    {
                        Some("public, max-age=31536000, immutable")
                    } else {
                        None
                    };

                    let result = match source.async_open(&path).await {
                        Ok(file) => {
                            state
                                .storage
                                .store_with_cache_control(
                                    &key,
                                    file,
                                    shared::storage::content_type(&key),
                                    cache_control,
                                )
                                .await
                        }
                        Err(err) => Err(err.into()),
                    };

                    match result {
                        Ok(bytes) => {
                            println!("uploaded {} ({} bytes)", key.cyan(), bytes);
                            migrated_count += 1;
                        }
                        Err(err) => {
                            eprintln!("{} {}: {}", "failed to upload".red(), key.cyan(), err);
                            failed_count += 1;
                        }
                    }
                }

                println!(
                    "migrated {} files, {} failed",
                    migrated_count.to_string().cyan(),
                    failed_count.to_string().cyan()
                );

                Ok(if failed_count > 0 { 1 } else { 0 })
            })
        })
    }
}
