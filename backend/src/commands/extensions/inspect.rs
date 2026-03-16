use anyhow::Context;
use clap::{Args, FromArgMatches};
use colored::Colorize;
use shared::extensions::distr::ExtensionDistrFile;

#[derive(Args)]
pub struct InspectArgs {
    #[arg(help = "the file to inspect", value_hint = clap::ValueHint::FilePath)]
    file: String,
}

pub struct InspectCommand;

impl shared::extensions::commands::CliCommand<InspectArgs> for InspectCommand {
    fn get_command(&self, command: clap::Command) -> clap::Command {
        command
    }

    fn get_executor(self) -> Box<shared::extensions::commands::ExecutorFunc> {
        Box::new(|_env, arg_matches| {
            Box::pin(async move {
                let args = InspectArgs::from_arg_matches(&arg_matches)?;

                let file = tokio::fs::File::open(&args.file).await?.into_std().await;
                let metadata = tokio::fs::metadata(args.file).await?;
                let mut extension_distr = tokio::task::spawn_blocking(move || {
                    ExtensionDistrFile::parse_from_reader(file)
                        .context("failed to parse calagopus extension archive")
                })
                .await??;

                println!(
                    "{}",
                    extension_distr
                        .metadata_toml
                        .package_name
                        .cyan()
                        .underline()
                );
                println!(
                    "  status:        {}",
                    if let Some(ext) = extension_internal_list::list()
                        .into_iter()
                        .find(|e| e.metadata_toml.package_name
                            == extension_distr.metadata_toml.package_name)
                    {
                        if ext.version == extension_distr.cargo_toml.package.version {
                            "installed".green()
                        } else {
                            "installed - different version".yellow()
                        }
                    } else {
                        "not installed".red()
                    }
                );
                println!(
                    "  name:          {}",
                    extension_distr.metadata_toml.name.cyan()
                );
                println!(
                    "  description:   {}",
                    extension_distr.cargo_toml.package.description.cyan()
                );
                if let Some(first) = extension_distr.cargo_toml.package.authors.first() {
                    let spaces = (extension_distr.cargo_toml.package.authors.len() as f64)
                        .log10()
                        .floor() as usize
                        + 1;

                    println!(
                        "  authors ({}): {}{}",
                        extension_distr.cargo_toml.package.authors.len(),
                        " ".repeat(3 - spaces),
                        first.cyan()
                    );
                    for author in extension_distr.cargo_toml.package.authors.iter().skip(1) {
                        println!("                 {}", author.cyan());
                    }
                }
                println!(
                    "  version:       {}",
                    extension_distr
                        .cargo_toml
                        .package
                        .version
                        .to_string()
                        .cyan()
                );
                println!(
                    "  packed size:   {}",
                    human_bytes::human_bytes(metadata.len() as f64).cyan()
                );
                println!(
                    "  unpacked size: {} ({:.2}%)",
                    human_bytes::human_bytes(extension_distr.total_size() as f64).cyan(),
                    ((extension_distr.total_size() as f64 / metadata.len() as f64) - 1.0) * 100.0
                );

                println!("  frontend:");
                if let Some((dep, version)) =
                    extension_distr.package_json.dependencies.first_key_value()
                {
                    let spaces = (extension_distr.package_json.dependencies.len() as f64)
                        .log10()
                        .floor() as usize
                        + 1;

                    println!(
                        "    dependencies ({}): {} = {}",
                        extension_distr.package_json.dependencies.len(),
                        dep.cyan(),
                        version.bright_black()
                    );
                    for (dep, version) in extension_distr.package_json.dependencies.iter().skip(1) {
                        println!(
                            "{}                     {} = {}",
                            " ".repeat(spaces),
                            dep.cyan(),
                            version.bright_black()
                        );
                    }
                } else {
                    println!("    dependencies (0)");
                }

                println!("  backend:");
                if let Some((dep, version)) =
                    extension_distr.cargo_toml.dependencies.first_key_value()
                {
                    let spaces = (extension_distr.cargo_toml.dependencies.len() as f64)
                        .log10()
                        .floor() as usize
                        + 1;

                    println!(
                        "    dependencies ({}): {} = {}",
                        extension_distr.cargo_toml.dependencies.len(),
                        dep.cyan(),
                        version.to_string().bright_black()
                    );
                    for (dep, version) in extension_distr.cargo_toml.dependencies.iter().skip(1) {
                        println!(
                            "{}                     {} = {}",
                            " ".repeat(spaces),
                            dep.cyan(),
                            version.to_string().bright_black()
                        );
                    }
                } else {
                    println!("    dependencies (0)");
                }

                if extension_distr.has_migrations() {
                    println!("  database migrations:");

                    let migrations =
                        tokio::task::spawn_blocking(move || extension_distr.get_migrations())
                            .await??;
                    for migration in migrations {
                        println!("    - {}", migration.name.bright_cyan());
                    }
                }

                Ok(0)
            })
        })
    }
}
