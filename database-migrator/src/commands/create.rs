use std::path::Path;

use clap::{Args, FromArgMatches};
use colored::Colorize;
use dialoguer::{Input, theme::ColorfulTheme};
use shared::extensions::distr::MetadataToml;

#[derive(Args)]
pub struct CreateArgs {
    #[arg(help = "the package name to add the new migration to")]
    package_name: String,
}

pub struct CreateCommand;

impl shared::extensions::commands::CliCommand<CreateArgs> for CreateCommand {
    fn get_command(&self, command: clap::Command) -> clap::Command {
        command
    }

    fn get_executor(self) -> Box<shared::extensions::commands::ExecutorFunc> {
        Box::new(|_env, arg_matches| {
            Box::pin(async move {
                let args = CreateArgs::from_arg_matches(&arg_matches)?;

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

                let name = Input::with_theme(&ColorfulTheme::default())
                    .with_prompt(
                        "How would you like to name the new migration? (use snake_case, e.g. `add_users_table`)"
                    )
                    .validate_with(|input: &String| -> Result<(), &str> {
                        if input
                            .chars()
                            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
                            && !input.is_empty()
                        {
                            Ok(())
                        } else {
                            Err("migration name must be in snake_case and can only contain lowercase letters, digits, and underscores")
                        }
                    })
                    .interact()
                    .unwrap();

                let migration_name =
                    format!("{}_{}", chrono::Utc::now().format("%Y%m%d%H%M%S"), name);
                tokio::fs::create_dir_all(migrations_path.join(&migration_name)).await?;

                tokio::fs::write(
                    migrations_path.join(&migration_name).join("up.sql"),
                    "-- write your migration here\n",
                )
                .await?;
                tokio::fs::write(
                    migrations_path.join(&migration_name).join("down.sql"),
                    "-- write your rollback migration here\n",
                )
                .await?;

                println!(
                    "{} {} {}",
                    "created new migration".green(),
                    migration_name.bright_blue(),
                    "successfully.".green()
                );
                println!(
                    "{} {}",
                    "view the new migration at".green(),
                    format!(
                        "database/extension-migrations/{}/{}/",
                        MetadataToml::convert_package_name_to_identifier(&args.package_name),
                        migration_name
                    )
                    .bright_blue()
                );

                Ok(0)
            })
        })
    }
}
