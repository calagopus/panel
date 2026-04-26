use anyhow::Context;
use clap::{Args, FromArgMatches};
use colored::Colorize;
use dialoguer::{Select, theme::ColorfulTheme};
use shared::extensions::distr::{ExtensionDistrFile, MetadataToml};
use std::path::Path;

#[derive(Args)]
pub struct InitArgs {
    #[arg(help = "the package name to use for the new extension")]
    package_name: String,
}

pub struct InitCommand;

impl shared::extensions::commands::CliCommand<InitArgs> for InitCommand {
    fn get_command(&self, command: clap::Command) -> clap::Command {
        command
    }

    fn get_executor(self) -> Box<shared::extensions::commands::ExecutorFunc> {
        Box::new(|_env, arg_matches| {
            Box::pin(async move {
                let args = InitArgs::from_arg_matches(&arg_matches)?;

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
                if tokio::fs::metadata(&frontend_path).await.is_ok() {
                    eprintln!(
                        "{} {}{}",
                        "found existing directory at".red(),
                        format!(
                            "frontend/extensions/{}",
                            MetadataToml::convert_package_name_to_identifier(&args.package_name)
                        )
                        .bright_red(),
                        ", try another package name.".red()
                    );
                    return Ok(1);
                }

                let backend_path = Path::new("backend-extensions").join(
                    MetadataToml::convert_package_name_to_identifier(&args.package_name),
                );
                if tokio::fs::metadata(&backend_path).await.is_ok() {
                    eprintln!(
                        "{} {}{}",
                        "found existing directory at".red(),
                        format!(
                            "backend-extensions/{}",
                            MetadataToml::convert_package_name_to_identifier(&args.package_name)
                        )
                        .bright_red(),
                        ", try another package name.".red()
                    );
                    return Ok(1);
                }

                let migrations_path = Path::new("database/extension-migrations").join(
                    MetadataToml::convert_package_name_to_identifier(&args.package_name),
                );
                if tokio::fs::metadata(&migrations_path).await.is_ok() {
                    eprintln!(
                        "{} {}{}",
                        "found existing directory at".red(),
                        format!(
                            "database/extension-migrations/{}",
                            MetadataToml::convert_package_name_to_identifier(&args.package_name)
                        )
                        .bright_red(),
                        ", try another package name.".red()
                    );
                    return Ok(1);
                }

                let mut templates_dir = tokio::fs::read_dir(".extension-templates").await?;
                let mut templates = Vec::new();
                while let Some(entry) = templates_dir.next_entry().await? {
                    let file_type = entry.file_type().await?;
                    if file_type.is_file() {
                        let file = tokio::fs::File::open(entry.path()).await?.into_std().await;
                        let extension_distr = tokio::task::spawn_blocking(move || {
                            ExtensionDistrFile::parse_from_reader(file)
                                .context("failed to parse calagopus extension archive")
                        })
                        .await??;

                        templates.push(extension_distr);
                    }
                }

                let template = Select::with_theme(&ColorfulTheme::default())
                    .with_prompt(
                        "What template would you like to use for the new extension? (you can always change the files later)",
                    )
                    .items(
                        templates
                            .iter()
                            .map(|t| t.cargo_toml.package.description.as_str())
                    )
                    .default(0)
                    .interact()
                    .unwrap();
                let mut extension_distr = templates.remove(template);

                println!(
                    "initializing new extension {} using template {}...",
                    args.package_name.cyan(),
                    extension_distr.metadata_toml.name.cyan()
                );

                let old_package_name = std::mem::replace(
                    &mut extension_distr.metadata_toml.package_name,
                    args.package_name.clone(),
                );
                extension_distr.validate()?;
                extension_distr.metadata_toml.package_name = old_package_name;

                tokio::fs::create_dir_all(&frontend_path).await?;
                tokio::fs::create_dir_all(&backend_path).await?;
                tokio::fs::create_dir_all(&migrations_path).await?;

                let extension_distr = tokio::task::spawn_blocking({
                    let frontend_path = frontend_path.clone();
                    let backend_path = backend_path.clone();
                    let migrations_path = migrations_path.clone();

                    move || {
                        extension_distr.extract_frontend(frontend_path)?;
                        extension_distr.extract_backend(backend_path)?;

                        if extension_distr.has_migrations() {
                            extension_distr.extract_migrations(migrations_path)?;
                        }

                        Ok::<_, anyhow::Error>(extension_distr)
                    }
                })
                .await??;

                let cargo_toml_path = backend_path.join("Cargo.toml");
                let mut cargo_toml = tokio::fs::read_to_string(&cargo_toml_path).await?;
                cargo_toml = cargo_toml.replace(
                    &extension_distr.metadata_toml.get_package_identifier(),
                    &MetadataToml::convert_package_name_to_identifier(&args.package_name),
                );
                tokio::fs::write(&cargo_toml_path, cargo_toml).await?;
                let metadata_toml_path = backend_path.join("Metadata.toml");
                let mut metadata_toml = tokio::fs::read_to_string(&metadata_toml_path).await?;
                metadata_toml = metadata_toml.replace(
                    &extension_distr.metadata_toml.package_name,
                    &args.package_name,
                );
                metadata_toml = metadata_toml.replace(">=1.0.0", &format!(">={}", shared::VERSION));
                tokio::fs::write(&metadata_toml_path, metadata_toml).await?;

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
                    "sucessfully initialized extension {} using template {}",
                    args.package_name.cyan(),
                    extension_distr.metadata_toml.name.cyan()
                );
                println!("you can now find the extension template files at:");
                println!(
                    "  frontend: {}",
                    frontend_path.to_string_lossy().bright_cyan()
                );
                println!(
                    "  backend: {}",
                    backend_path.to_string_lossy().bright_cyan()
                );
                println!(
                    "  database migrations: {}",
                    migrations_path.to_string_lossy().bright_cyan()
                );

                Ok(0)
            })
        })
    }
}
