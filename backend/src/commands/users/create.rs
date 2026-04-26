use clap::{Args, FromArgMatches};
use colored::Colorize;
use compact_str::ToCompactString;
use dialoguer::{Confirm, Input, Password, theme::ColorfulTheme};
use shared::models::CreatableModel;
use std::io::IsTerminal;

#[derive(Args)]
pub struct CreateArgs {
    #[arg(long = "json", help = "output the created user in JSON format")]
    json: bool,

    #[arg(long = "username", help = "the username for the new user")]
    username: Option<String>,
    #[arg(long = "email", help = "the email address for the new user")]
    email: Option<String>,
    #[arg(long = "name-first", help = "the first name of the new user")]
    name_first: Option<String>,
    #[arg(long = "name-last", help = "the last name of the new user")]
    name_last: Option<String>,
    #[arg(long = "password", help = "the password for the new user")]
    password: Option<String>,
    #[arg(
        long = "admin",
        help = "whether the new user should have admin privileges"
    )]
    admin: Option<bool>,
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

                let username = match args.username {
                    Some(username) => username,
                    None => {
                        if std::io::stdout().is_terminal() {
                            let username: String = Input::with_theme(&ColorfulTheme::default())
                                .with_prompt("Username")
                                .interact_text()?;
                            username
                        } else {
                            eprintln!("{}", "username arg is required when not running in an interactive terminal".red());
                            return Ok(1);
                        }
                    }
                };

                let email = match args.email {
                    Some(email) => email,
                    None => {
                        if std::io::stdout().is_terminal() {
                            let email: String = Input::with_theme(&ColorfulTheme::default())
                                .with_prompt("Email")
                                .interact_text()?;
                            email
                        } else {
                            eprintln!(
                                "{}",
                                "email arg is required when not running in an interactive terminal"
                                    .red()
                            );
                            return Ok(1);
                        }
                    }
                };

                let name_first = match args.name_first {
                    Some(name_first) => name_first,
                    None => {
                        if std::io::stdout().is_terminal() {
                            let name_first: String = Input::with_theme(&ColorfulTheme::default())
                                .with_prompt("First Name")
                                .interact_text()?;
                            name_first
                        } else {
                            eprintln!("{}", "name-first arg is required when not running in an interactive terminal".red());
                            return Ok(1);
                        }
                    }
                };

                let name_last = match args.name_last {
                    Some(name_last) => name_last,
                    None => {
                        if std::io::stdout().is_terminal() {
                            let name_last: String = Input::with_theme(&ColorfulTheme::default())
                                .with_prompt("Last Name")
                                .interact_text()?;
                            name_last
                        } else {
                            eprintln!("{}", "name-last arg is required when not running in an interactive terminal".red());
                            return Ok(1);
                        }
                    }
                };

                let password = match args.password {
                    Some(password) => password,
                    None => {
                        if std::io::stdout().is_terminal() {
                            let password: String = Password::with_theme(&ColorfulTheme::default())
                                .with_prompt("Password")
                                .interact()?;
                            password
                        } else {
                            eprintln!("{}", "password arg is required when not running in an interactive terminal".red());
                            return Ok(1);
                        }
                    }
                };

                let admin = match args.admin {
                    Some(admin) => admin,
                    None => {
                        if std::io::stdout().is_terminal() {
                            let admin: bool = Confirm::with_theme(&ColorfulTheme::default())
                                .with_prompt("Is Admin?")
                                .interact()?;
                            admin
                        } else {
                            false
                        }
                    }
                };

                let settings = state.settings.get().await?;
                let options = shared::models::user::CreateUserOptions {
                    role_uuid: None,
                    external_id: None,
                    username: username.into(),
                    email: email.into(),
                    name_first: name_first.into(),
                    name_last: name_last.into(),
                    password: Some(password),
                    admin,
                    language: settings.app.language.clone(),
                };
                drop(settings);
                let user = shared::models::user::User::create(&state, options).await?;

                if args.json {
                    eprintln!(
                        "{}",
                        serde_json::to_string_pretty(
                            &user
                                .into_api_full_object(&state, &state.storage.retrieve_urls().await?)
                                .await?
                        )?
                    );
                } else {
                    eprintln!(
                        "user {} created successfully",
                        user.uuid.to_compact_string().cyan()
                    );
                }

                Ok(0)
            })
        })
    }
}
