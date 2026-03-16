use clap::{Args, FromArgMatches};
use colored::Colorize;
use shared::extensions::distr::{ExtensionDistrFile, ExtensionDistrFileBuilder, MetadataToml};
use std::{io::Write, path::Path};

#[derive(Args)]
pub struct ExportArgs {
    #[arg(help = "the extension package name to export")]
    package_name: String,
}

pub struct ExportCommand;

impl shared::extensions::commands::CliCommand<ExportArgs> for ExportCommand {
    fn get_command(&self, command: clap::Command) -> clap::Command {
        command
    }

    fn get_executor(self) -> Box<shared::extensions::commands::ExecutorFunc> {
        Box::new(|_env, arg_matches| {
            Box::pin(async move {
                let args = ExportArgs::from_arg_matches(&arg_matches)?;

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
                            MetadataToml::convert_package_name_to_identifier(&args.package_name)
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
                            MetadataToml::convert_package_name_to_identifier(&args.package_name)
                        )
                        .bright_red(),
                        "directory, make sure you are in the panel root.".red()
                    );
                    return Ok(1);
                }

                let migrations_path = Path::new("database/extension-migrations").join(
                    MetadataToml::convert_package_name_to_identifier(&args.package_name),
                );

                tokio::fs::create_dir_all("exported-extensions").await?;

                let output_path = Path::new("exported-extensions").join(format!(
                    "{}.c7s.zip",
                    MetadataToml::convert_package_name_to_identifier(&args.package_name)
                ));
                let file = std::fs::OpenOptions::new()
                    .create(true)
                    .write(true)
                    .truncate(true)
                    .read(true)
                    .open(&output_path)?;
                let mut file =
                    tokio::task::spawn_blocking(move || -> Result<std::fs::File, anyhow::Error> {
                        let mut builder = ExtensionDistrFileBuilder::new(file)
                            .add_frontend(frontend_path)?
                            .add_backend(backend_path)?;

                        if migrations_path.exists() {
                            builder = builder.add_migrations(migrations_path)?;
                        }

                        Ok(builder.write()?)
                    })
                    .await??;
                file.flush()?;
                file.sync_all()?;

                let extension_distr = match ExtensionDistrFile::parse_from_reader(file) {
                    Ok(extension_distr) => extension_distr,
                    Err(err) => {
                        std::fs::remove_file(output_path)?;
                        return Err(err);
                    }
                };

                println!(
                    "sucessfully exported {} to {}",
                    extension_distr.metadata_toml.name.cyan(),
                    output_path.to_string_lossy().cyan()
                );

                Ok(0)
            })
        })
    }
}
