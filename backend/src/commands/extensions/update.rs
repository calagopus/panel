use anyhow::Context;
use clap::{Args, FromArgMatches};
use colored::Colorize;
use shared::extensions::distr::{ExtensionDistrFile, SlimExtensionDistrFile};
use std::path::Path;

#[derive(Args)]
pub struct UpdateArgs {
    #[arg(help = "the file to update an extension with")]
    file: String,
    #[arg(
        long = "skip-version-check",
        help = "whether to skip the panel version compatibility check (usually not recommended)",
        default_value = "false"
    )]
    skip_version_check: bool,
}

pub struct UpdateCommand;

impl shared::extensions::commands::CliCommand<UpdateArgs> for UpdateCommand {
    fn get_command(&self, command: clap::Command) -> clap::Command {
        command
    }

    fn get_executor(self) -> Box<shared::extensions::commands::ExecutorFunc> {
        Box::new(|_env, arg_matches| {
            Box::pin(async move {
                let args = UpdateArgs::from_arg_matches(&arg_matches)?;

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

                if !installed_extensions.into_iter().any(|e| {
                    e.metadata_toml.package_name == extension_distr.metadata_toml.package_name
                }) {
                    eprintln!(
                        "{} {} {} {} {}",
                        "extension".red(),
                        extension_distr.metadata_toml.name.bright_red(),
                        "not installed - please use".red(),
                        format!("panel-rs extensions add {}", args.file).bright_red(),
                        "instead.".red()
                    );
                    return Ok(1);
                }

                let frontend_path = Path::new("frontend/extensions")
                    .join(extension_distr.metadata_toml.get_package_identifier());
                tokio::fs::remove_dir_all(&frontend_path).await?;
                tokio::fs::create_dir_all(&frontend_path).await?;
                let backend_path = Path::new("backend-extensions")
                    .join(extension_distr.metadata_toml.get_package_identifier());
                tokio::fs::remove_dir_all(&backend_path).await?;
                tokio::fs::create_dir_all(&backend_path).await?;
                let migrations_path = Path::new("database/extension-migrations")
                    .join(extension_distr.metadata_toml.get_package_identifier());

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
                    "sucessfully updated {}",
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
