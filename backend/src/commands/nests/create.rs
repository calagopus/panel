use clap::{Args, FromArgMatches};
use colored::Colorize;
use compact_str::ToCompactString;
use dialoguer::{Input, theme::ColorfulTheme};
use shared::models::CreatableModel;
use shared::models::IntoAdminApiObject;
use std::io::IsTerminal;

#[derive(Args)]
pub struct CreateArgs {
    #[arg(long = "json", help = "output the created nest in JSON format")]
    json: bool,

    #[arg(long = "author", help = "the author for the new nest")]
    author: Option<String>,
    #[arg(long = "name", help = "the name for the new nest")]
    name: Option<String>,
}

pub struct CreateCommand;

impl shared::extensions::commands::CliCommand<CreateArgs> for CreateCommand {
    fn get_command(&self, command: clap::Command) -> clap::Command {
        command
    }

    fn get_executor(self) -> Box<shared::extensions::commands::ExecutorFunc> {
        Box::new(|env, arg_matches| {
            Box::pin(async move {
                let args = CreateArgs::from_arg_matches(&arg_matches)?;
                let state = shared::AppState::new_cli(env).await?;

                let author = match args.author {
                    Some(author) => author,
                    None => {
                        if std::io::stdout().is_terminal() {
                            let author: String = Input::with_theme(&ColorfulTheme::default())
                                .with_prompt("Author")
                                .interact_text()?;
                            author
                        } else {
                            eprintln!("{}", "author arg is required when not running in an interactive terminal".red());
                            return Ok(1);
                        }
                    }
                };

                let name = match args.name {
                    Some(name) => name,
                    None => {
                        if std::io::stdout().is_terminal() {
                            let name: String = Input::with_theme(&ColorfulTheme::default())
                                .with_prompt("Name")
                                .interact_text()?;
                            name
                        } else {
                            eprintln!(
                                "{}",
                                "name arg is required when not running in an interactive terminal"
                                    .red()
                            );
                            return Ok(1);
                        }
                    }
                };

                let settings = state.settings.get().await?;
                let options = shared::models::nest::CreateNestOptions {
                    author: author.into(),
                    name: name.into(),
                    description: None,
                };
                drop(settings);
                let nest = shared::models::nest::Nest::create(&state, options).await?;

                if args.json {
                    eprintln!(
                        "{}",
                        serde_json::to_string_pretty(
                            &nest.into_admin_api_object(&state, ()).await?
                        )?
                    );
                } else {
                    eprintln!(
                        "nest {} created successfully",
                        nest.uuid.to_compact_string().cyan()
                    );
                }

                Ok(0)
            })
        })
    }
}
