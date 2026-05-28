use super::apply::which;
use anyhow::Context;
use clap::{Args, FromArgMatches};
use colored::Colorize;
use compact_str::ToCompactString;
use serde::Deserialize;
use shared::extensions::distr::SlimExtensionDistrFile;
use std::{collections::HashMap, path::Path};
use tokio::process::Command;

#[derive(Args)]
pub struct ClearArgs {
    #[arg(
        long = "remove-migrations",
        help = "whether to remove the database migrations of the extensions (usually not recommended)",
        default_value = "false"
    )]
    remove_migrations: bool,
}

pub struct ClearCommand;

impl shared::extensions::commands::CliCommand<ClearArgs> for ClearCommand {
    fn get_command(&self, command: clap::Command) -> clap::Command {
        command
    }

    fn get_executor(self) -> Box<shared::extensions::commands::ExecutorFunc> {
        Box::new(|_env, arg_matches| {
            Box::pin(async move {
                let args = ClearArgs::from_arg_matches(&arg_matches)?;

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

                let installed_extensions = tokio::task::spawn_blocking(move || {
                    SlimExtensionDistrFile::parse_from_directory(".")
                })
                .await??;

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

                for extension in &installed_extensions {
                    let frontend_path = Path::new("frontend/extensions")
                        .join(extension.metadata_toml.get_package_identifier());
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
                                extension.metadata_toml.get_package_identifier(),
                            )
                            .bright_red(),
                            "directory, make sure you are in the panel root - ignoring this extension.".red()
                        );
                        continue;
                    }

                    let backend_path = Path::new("backend-extensions")
                        .join(extension.metadata_toml.get_package_identifier());
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
                                extension.metadata_toml.get_package_identifier(),
                            )
                            .bright_red(),
                            "directory, make sure you are in the panel root - ignoring this extension.".red()
                        );
                        continue;
                    }

                    let migrations_path = Path::new("database/extension-migrations")
                        .join(extension.metadata_toml.get_package_identifier());

                    tokio::fs::remove_dir_all(frontend_path).await?;
                    tokio::fs::remove_dir_all(backend_path).await?;
                    tokio::fs::copy(
                        Path::new("backend-extensions/internal-list/Cargo.template.toml"),
                        Path::new("backend-extensions/internal-list/Cargo.toml"),
                    )
                    .await?;

                    if args.remove_migrations && tokio::fs::metadata(&migrations_path).await.is_ok()
                    {
                        tokio::fs::remove_dir_all(migrations_path).await?;

                        println!("removed database migrations for this extension");
                        println!(
                            "this did NOT run any down migrations, it only removed the migration files from the filesystem, use with caution as this can lead to an inconsistent state if the migrations have already been applied to the database"
                        );
                    }

                    println!(
                        "successfully removed {}",
                        extension.metadata_toml.package_name.cyan()
                    );
                }

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

                println!(
                    "successfully removed {} extensions.",
                    installed_extensions.len().to_compact_string().cyan()
                );

                Ok(0)
            })
        })
    }
}
