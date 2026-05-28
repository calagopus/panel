use super::apply::which;
use anyhow::Context;
use clap::{Args, FromArgMatches};
use colored::Colorize;
use dialoguer::{Confirm, theme::ColorfulTheme};
use serde::Deserialize;
use shared::extensions::distr::{ExtensionDistrFile, SlimExtensionDistrFile};
use std::{collections::HashMap, io::IsTerminal, path::Path};
use tokio::process::Command;

#[derive(Args)]
pub struct AddArgs {
    #[arg(help = "the file to add as an extension", value_hint = clap::ValueHint::FilePath)]
    file: String,
    #[arg(
        long = "skip-version-check",
        help = "whether to skip the panel version compatibility check (usually not recommended)",
        default_value = "false"
    )]
    skip_version_check: bool,
    #[arg(
        long = "accept-license",
        help = "whether to automatically accept the extension's license (if it has one). This is required to add extensions that have a license, and can be used to skip the confirmation prompt when adding such extensions.",
        default_value = "false"
    )]
    accept_license: bool,
}

pub struct AddCommand;

impl shared::extensions::commands::CliCommand<AddArgs> for AddCommand {
    fn get_command(&self, command: clap::Command) -> clap::Command {
        command
    }

    fn get_executor(self) -> Box<shared::extensions::commands::ExecutorFunc> {
        Box::new(|_env, arg_matches| {
            Box::pin(async move {
                let args = AddArgs::from_arg_matches(&arg_matches)?;

                let file = tokio::fs::File::open(&args.file).await?.into_std().await;
                let mut extension_distr = tokio::task::spawn_blocking(move || {
                    ExtensionDistrFile::parse_from_reader(file)
                        .context("failed to parse calagopus extension archive")
                })
                .await??;

                if !args.skip_version_check
                    && !extension_distr
                        .metadata_toml
                        .panel_version
                        .matches(&shared::VERSION.parse()?)
                {
                    eprintln!(
                        "{} {} {} {} {}",
                        "extension".red(),
                        extension_distr.metadata_toml.name.bright_red(),
                        "requires panel version".red(),
                        extension_distr
                            .metadata_toml
                            .panel_version
                            .to_string()
                            .bright_red(),
                        "but the current panel version is incompatible.".red()
                    );
                    return Ok(1);
                }

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

                if let Some(ext) = installed_extensions.into_iter().find(|e| {
                    e.metadata_toml.package_name == extension_distr.metadata_toml.package_name
                }) {
                    eprintln!(
                        "{} {} {} {} {} {} {}",
                        "extension".red(),
                        ext.metadata_toml.name.bright_red(),
                        "already installed with version".red(),
                        ext.cargo_toml.package.version.to_string().bright_red(),
                        "- please use".red(),
                        format!("panel-rs extensions update {}", args.file).bright_red(),
                        "instead.".red()
                    );
                    return Ok(1);
                }

                let package_json = tokio::fs::read_to_string("frontend/package.json")
                    .await
                    .context("unable to read `frontend/package.json`")?;
                #[derive(Deserialize)]
                struct PackageJson {
                    engines: HashMap<String, semver::VersionReq>,
                }
                let package_json: PackageJson = serde_json::from_str(&package_json)?;

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

                let package_identifier = extension_distr.metadata_toml.get_package_identifier();
                if !shared::extensions::distr::MetadataToml::is_valid_package_identifier(
                    &package_identifier,
                ) {
                    eprintln!(
                        "{} {}",
                        "invalid package identifier:".red(),
                        package_identifier.bright_red()
                    );
                    return Ok(1);
                }

                if let Some(license_text) = &extension_distr.metadata_toml.license_text
                    && !args.accept_license
                {
                    println!(
                        "{} {} {}",
                        "extension has the following license:".yellow(),
                        extension_distr.metadata_toml.name.bright_yellow(),
                        "- you must accept the license to add this extension.".yellow()
                    );
                    println!();
                    println!("{}", license_text);
                    println!();

                    let accept = match args.accept_license {
                        true => true,
                        false => {
                            if std::io::stdout().is_terminal() {
                                let accept: bool = Confirm::with_theme(&ColorfulTheme::default())
                                    .with_prompt("Accept license?")
                                    .interact()?;
                                accept
                            } else {
                                false
                            }
                        }
                    };

                    if !accept {
                        println!("{}", "license not accepted, aborting.".yellow());
                        if !std::io::stdout().is_terminal() {
                            eprintln!("{}", "you can use the --accept-license flag to automatically accept the license when not running in an interactive terminal.".yellow());
                        }
                        return Ok(1);
                    }
                }

                let frontend_path = Path::new("frontend/extensions").join(&package_identifier);
                tokio::fs::create_dir_all(&frontend_path).await?;
                let backend_path = Path::new("backend-extensions").join(&package_identifier);
                tokio::fs::create_dir_all(&backend_path).await?;
                let migrations_path =
                    Path::new("database/extension-migrations").join(&package_identifier);
                tokio::fs::create_dir_all(&migrations_path).await?;

                let mut extension_distr = tokio::task::spawn_blocking(move || {
                    extension_distr.extract_frontend(frontend_path)?;
                    extension_distr.extract_backend(backend_path)?;

                    if extension_distr.has_migrations() {
                        extension_distr.extract_migrations(migrations_path)?;
                    }

                    Ok::<_, anyhow::Error>(extension_distr)
                })
                .await??;

                if extension_distr.has_migrations() {
                    println!("extension has database migrations...");

                    let (migrations, extension_distr_) = tokio::task::spawn_blocking(move || {
                        (extension_distr.get_migrations(), extension_distr)
                    })
                    .await?;
                    extension_distr = extension_distr_;
                    let migrations = migrations?;

                    println!("{} migrations found:", migrations.len());
                    for migration in migrations {
                        println!("- {}", migration.name.bright_cyan());
                    }

                    println!();
                    println!(
                        "extracted migrations to {}{}",
                        "database/extension-migrations/".bright_black(),
                        extension_distr
                            .metadata_toml
                            .get_package_identifier()
                            .bright_black()
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

                println!(
                    "successfully added {}",
                    extension_distr.metadata_toml.name.cyan(),
                );
                println!(
                    "make sure to run {} to apply its changes",
                    "panel-rs extensions apply".bright_black(),
                );

                Ok(0)
            })
        })
    }
}
