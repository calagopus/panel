use clap::{Args, FromArgMatches};
use colored::Colorize;
use compact_str::ToCompactString;
use dialoguer::{Input, Password, theme::ColorfulTheme};
use shared::models::ByUuid;
use std::io::IsTerminal;

#[derive(Args)]
pub struct ResetPasswordArgs {
    #[arg(
        long = "user",
        help = "the username, email or uuid of the user to reset the password for"
    )]
    user: Option<String>,

    #[arg(long = "password", help = "the new password for the user")]
    password: Option<String>,
}

pub struct ResetPasswordCommand;

impl shared::extensions::commands::CliCommand<ResetPasswordArgs> for ResetPasswordCommand {
    fn get_command(&self, command: clap::Command) -> clap::Command {
        command
    }

    fn get_executor(self) -> Box<shared::extensions::commands::ExecutorFunc> {
        Box::new(|env, arg_matches| {
            Box::pin(async move {
                let args = ResetPasswordArgs::from_arg_matches(&arg_matches)?;
                let state = shared::AppState::new_cli(env).await?;

                let user = match args.user {
                    Some(user) => user,
                    None => {
                        if std::io::stdout().is_terminal() {
                            let user: String = Input::with_theme(&ColorfulTheme::default())
                                .with_prompt("Username, Email or UUID")
                                .interact_text()?;
                            user
                        } else {
                            eprintln!(
                                "{}",
                                "user arg is required when not running in an interactive terminal"
                                    .red()
                            );
                            return Ok(1);
                        }
                    }
                };

                let user = if let Ok(uuid) = user.parse() {
                    shared::models::user::User::by_uuid_optional(&state.database, uuid).await
                } else if user.contains('@') {
                    shared::models::user::User::by_email(&state.database, &user).await
                } else {
                    shared::models::user::User::by_username(&state.database, &user).await
                }?;

                let Some(mut user) = user else {
                    eprintln!("{}", "user not found".red());
                    return Ok(1);
                };

                let password = match args.password {
                    Some(password) => password,
                    None => {
                        if std::io::stdout().is_terminal() {
                            let password: String = Password::with_theme(&ColorfulTheme::default())
                                .with_prompt("New Password")
                                .interact()?;
                            password
                        } else {
                            eprintln!("{}", "password arg is required when not running in an interactive terminal".red());
                            return Ok(1);
                        }
                    }
                };

                user.update_password(&state.database, Some(&password))
                    .await?;

                eprintln!(
                    "password has been reset for the user {}",
                    user.uuid.to_compact_string().cyan()
                );

                Ok(0)
            })
        })
    }
}
