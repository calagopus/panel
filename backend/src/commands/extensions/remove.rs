use super::apply::which;
use anyhow::Context;
use clap::{Args, FromArgMatches};
use colored::Colorize;
use serde::Deserialize;
use shared::extensions::distr::MetadataToml;
use std::{collections::HashMap, path::Path};
use tokio::process::Command;

#[derive(Args)]
pub struct RemoveArgs {
    #[arg(help = "the extension package name to remove")]
    package_name: String,
    #[arg(
        long = "remove-migrations",
        help = "whether to remove the database migrations and run their down.sql code of this extension (usually not recommended)",
        default_value = "false"
    )]
    remove_migrations: bool,
}

pub struct RemoveCommand;

impl shared::extensions::commands::CliCommand<RemoveArgs> for RemoveCommand {
    fn get_command(&self, command: clap::Command) -> clap::Command {
        command
    }

    fn get_executor(self) -> Box<shared::extensions::commands::ExecutorFunc> {
        Box::new(|env, arg_matches| {
            Box::pin(async move {
                let args = RemoveArgs::from_arg_matches(&arg_matches)?;

                if tokio::fs::metadata(".sqlx")
                    .await
                    .ok()
                    .is_none_or(|e| !e.is_dir())
                {
                    eprintln!(
                        "{} {} {}",
                        "failed to find".red(),
                        ".sqlx".bright_red(),
                        "directory, make sure you are in the panel root.".red()
                    );
                    return Ok(1);
                }

                let frontend_path = Path::new("frontend/extensions").join(
                    MetadataToml::convert_package_name_to_identifier(&args.package_name),
                );
                if tokio::fs::metadata(&frontend_path)
                    .await
                    .ok()
                    .is_none_or(|e| !e.is_dir())
                {
                    eprintln!(
                        "{} {} {}",
                        "failed to find".red(),
                        format!(
                            "frontend/extensions/{}",
                            MetadataToml::convert_package_name_to_identifier(&args.package_name),
                        )
                        .bright_red(),
                        "directory, make sure you are in the panel root.".red()
                    );
                    return Ok(1);
                }

                let backend_path = Path::new("backend-extensions").join(
                    MetadataToml::convert_package_name_to_identifier(&args.package_name),
                );
                if tokio::fs::metadata(&backend_path)
                    .await
                    .ok()
                    .is_none_or(|e| !e.is_dir())
                {
                    eprintln!(
                        "{} {} {}",
                        "failed to find".red(),
                        format!(
                            "backend-extensions/{}",
                            MetadataToml::convert_package_name_to_identifier(&args.package_name),
                        )
                        .bright_red(),
                        "directory, make sure you are in the panel root.".red()
                    );
                    return Ok(1);
                }

                let frontend_translations_path = Path::new("frontend/public/translations/en")
                    .join(format!("{}.json", &args.package_name));
                let migrations_path = Path::new("database/extension-migrations").join(
                    MetadataToml::convert_package_name_to_identifier(&args.package_name),
                );

                let cargo_bin = which("cargo")
                    .await
                    .context("unable to find `cargo` binary")?;
                let cargo_version = Command::new(&cargo_bin).arg("--version").output().await?;
                let cargo_version = String::from_utf8(cargo_version.stdout)?;

                println!("detected cargo: {}", cargo_version.trim().bright_black());

                let package_json = tokio::fs::read_to_string("frontend/package.json")
                    .await
                    .context("unable to read `frontend/package.json`")?;
                #[derive(Deserialize)]
                struct PackageJson {
                    engines: HashMap<String, semver::VersionReq>,
                }
                let package_json: PackageJson = serde_json::from_str(&package_json)?;

                let node_bin = which("node")
                    .await
                    .context("unable to find `node` binary")?;
                let node_version = Command::new(&node_bin).arg("--version").output().await?;
                let node_version: semver::Version = String::from_utf8(node_version.stdout)?
                    .trim_start_matches('v')
                    .trim()
                    .parse()
                    .context("unable to parse node version as semver")?;

                println!(
                    "detected node:  {}",
                    node_version.to_string().bright_black()
                );
                if let Some(node_req) = package_json.engines.get("node")
                    && !node_req.matches(&node_version)
                {
                    eprintln!(
                        "{} {} {} {}",
                        "node version".red(),
                        node_version.to_string().bright_red(),
                        "does not match requirement".red(),
                        node_req.to_string().bright_red()
                    );
                    return Ok(1);
                }

                let pnpm_bin = which("pnpm")
                    .await
                    .context("unable to find `pnpm` binary, this can usually be installed using `npm i -g pnpm`")?;
                let pnpm_version = Command::new(&pnpm_bin).arg("--version").output().await?;
                let pnpm_version: semver::Version = String::from_utf8(pnpm_version.stdout)?
                    .trim()
                    .parse()
                    .context("unable to parse pnpm version as semver")?;

                println!(
                    "detected pnpm:  {}",
                    pnpm_version.to_string().bright_black()
                );
                if let Some(pnpm_req) = package_json.engines.get("pnpm")
                    && !pnpm_req.matches(&pnpm_version)
                {
                    eprintln!(
                        "{} {} {} {}",
                        "pnpm version".red(),
                        pnpm_version.to_string().bright_red(),
                        "does not match requirement".red(),
                        pnpm_req.to_string().bright_red()
                    );
                    return Ok(1);
                }

                tokio::fs::remove_dir_all(frontend_path).await?;
                if tokio::fs::metadata(&frontend_translations_path)
                    .await
                    .is_ok()
                {
                    tokio::fs::remove_file(frontend_translations_path).await?;
                }
                tokio::fs::remove_dir_all(backend_path).await?;
                tokio::fs::copy(
                    Path::new("backend-extensions/internal-list/Cargo.template.toml"),
                    Path::new("backend-extensions/internal-list/Cargo.toml"),
                )
                .await?;

                if let Err(err) = tokio::task::spawn_blocking(|| {
                    shared::extensions::distr::resync_extension_list()
                })
                .await?
                {
                    eprintln!(
                        "{} {}",
                        "failed to resync internal extension list:".red(),
                        err.to_string().red()
                    );
                    return Ok(1);
                }

                println!(
                    "{}",
                    "successfully resynced internal extension list.".green()
                );

                println!("recalculating dependencies...");
                let status = Command::new(&pnpm_bin)
                    .arg("install")
                    .current_dir("frontend")
                    .status()
                    .await?;
                if !status.success() {
                    eprintln!(
                        "{} {}",
                        "pnpm install".bright_red(),
                        "did not run successfully, ignoring".red()
                    );
                }

                if args.remove_migrations && tokio::fs::metadata(&migrations_path).await.is_ok() {
                    let state = match shared::AppState::new_cli(env).await {
                        Ok(state) => state,
                        Err(err) => {
                            eprintln!(
                                "{} {}: {}",
                                "failed to initialize application state".red(),
                                "(required to remove migrations)".bright_red(),
                                err.to_string().red()
                            );
                            eprintln!(
                                "{} {}",
                                "if your sole purpose is to remove the extension migrations, you can safely delete the directory".red(),
                                migrations_path.to_string_lossy().bright_red()
                            );
                            println!(
                                "besides this, {} has been removed successfully.",
                                args.package_name.cyan()
                            );
                            return Ok(1);
                        }
                    };

                    let extension_migrations = database_migrator::collect_extension_migrations(
                        &migrations_path,
                        &args.package_name,
                    )
                    .await?;

                    for migration in extension_migrations.iter().rev() {
                        println!("running down migration: {}", migration.name.bright_blue());
                        if let Err(err) = database_migrator::rollback_extension_migration(
                            state.database.write(),
                            migration,
                        )
                        .await
                        {
                            eprintln!(
                                "{} {}: {}",
                                "failed to run down migration".red(),
                                migration.name.bright_red(),
                                err.to_string().red()
                            );
                            return Ok(1);
                        }
                    }

                    tokio::fs::remove_dir_all(migrations_path).await?;

                    println!("removed and rolled back database migrations for this extension");
                }

                println!("sucessfully removed {}", args.package_name.cyan());

                Ok(0)
            })
        })
    }
}
