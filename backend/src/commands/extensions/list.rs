use clap::{Args, FromArgMatches};
use colored::Colorize;
use serde::Serialize;
use shared::extensions::distr::{CargoToml, MetadataToml, PackageJson, SlimExtensionDistrFile};

#[derive(Args)]
pub struct ListArgs {
    #[arg(
        long = "json",
        help = "whether to output the list in JSON format",
        default_value = "false"
    )]
    json: bool,
}

pub struct ListCommand;

impl shared::extensions::commands::CliCommand<ListArgs> for ListCommand {
    fn get_command(&self, command: clap::Command) -> clap::Command {
        command
    }

    fn get_executor(self) -> Box<shared::extensions::commands::ExecutorFunc> {
        Box::new(|_env, arg_matches| {
            Box::pin(async move {
                let args = ListArgs::from_arg_matches(&arg_matches)?;

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
                let applied_extensions = crate::EXTENSIONS
                    .get()
                    .expect("Extensions not initialized")
                    .extensions()
                    .await;

                if args.json {
                    let mut extensions_json = Vec::new();
                    extensions_json.reserve_exact(installed_extensions.len());

                    #[derive(Serialize)]
                    struct ExtensionJson {
                        status: &'static str,
                        metadata_toml: MetadataToml,
                        cargo_toml: CargoToml,
                        package_json: PackageJson,
                    }

                    for extension in installed_extensions {
                        extensions_json.push(ExtensionJson {
                            status: if let Some(ext) = applied_extensions.iter().find(|e| {
                                e.metadata_toml.package_name == extension.metadata_toml.package_name
                            }) {
                                if ext.version == extension.cargo_toml.package.version {
                                    "applied"
                                } else {
                                    "applied - different version"
                                }
                            } else {
                                "not applied"
                            },
                            metadata_toml: extension.metadata_toml,
                            cargo_toml: extension.cargo_toml,
                            package_json: extension.package_json,
                        });
                    }

                    println!("{}", serde_json::to_string_pretty(&extensions_json)?);
                } else {
                    for extension in installed_extensions {
                        println!(
                            "{}",
                            extension.metadata_toml.package_name.cyan().underline()
                        );
                        println!(
                            "  status:        {}",
                            if let Some(ext) = applied_extensions
                                .iter()
                                .find(|e| e.metadata_toml.package_name
                                    == extension.metadata_toml.package_name)
                            {
                                if ext.version == extension.cargo_toml.package.version {
                                    "applied".green()
                                } else {
                                    "applied - different version".yellow()
                                }
                            } else {
                                "not applied".red()
                            }
                        );
                        println!("  name:          {}", extension.metadata_toml.name.cyan());
                        println!(
                            "  description:   {}",
                            extension.cargo_toml.package.description.cyan()
                        );
                        if let Some(first) = extension.cargo_toml.package.authors.first() {
                            let spaces = (extension.cargo_toml.package.authors.len() as f64)
                                .log10()
                                .floor() as usize
                                + 1;

                            println!(
                                "  authors ({}): {}{}",
                                extension.cargo_toml.package.authors.len(),
                                " ".repeat(3 - spaces),
                                first.cyan()
                            );
                            for author in extension.cargo_toml.package.authors.iter().skip(1) {
                                println!("                 {}", author.cyan());
                            }
                        }
                        println!(
                            "  version:       {}",
                            extension.cargo_toml.package.version.to_string().cyan()
                        );
                    }
                }

                Ok(0)
            })
        })
    }
}
