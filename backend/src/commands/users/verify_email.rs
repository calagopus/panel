use clap::{Args, FromArgMatches};
use colored::Colorize;
use compact_str::ToCompactString;
use dialoguer::{Input, theme::ColorfulTheme};
use shared::models::{ByUuid, user::User};
use std::io::IsTerminal;

#[derive(Args)]
pub struct VerifyEmailArgs {
    #[arg(
        long = "user",
        help = "the username, email or uuid of the user to mark as verified"
    )]
    user: Option<String>,
}

pub struct VerifyEmailCommand;

impl shared::extensions::commands::CliCommand<VerifyEmailArgs> for VerifyEmailCommand {
    fn get_command(&self, command: clap::Command) -> clap::Command {
        command
    }

    fn get_executor(self) -> Box<shared::extensions::commands::ExecutorFunc> {
        Box::new(|env, arg_matches| {
            Box::pin(async move {
                let args = VerifyEmailArgs::from_arg_matches(&arg_matches)?;
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
                    User::by_uuid_optional(&state.database, uuid).await
                } else if user.contains('@') {
                    User::by_email(&state.database, &user).await
                } else {
                    User::by_username(&state.database, &user).await
                }?;

                let Some(user) = user else {
                    eprintln!("{}", "user not found".red());
                    return Ok(1);
                };

                if user.email_verified {
                    eprintln!("{}", "email is already verified for this user".red());
                    return Ok(1);
                }

                shared::models::user_email_verification::UserEmailVerification::delete_by_user_uuid(
                    &state.database,
                    user.uuid,
                )
                .await?;

                sqlx::query!(
                    "UPDATE users
                    SET email_verified = true
                    WHERE users.uuid = $1",
                    user.uuid
                )
                .execute(state.database.write())
                .await?;

                User::invalidate_cached(&state.database, user.uuid).await;

                eprintln!(
                    "email {} has been marked as verified for the user {}",
                    user.email.cyan(),
                    user.uuid.to_compact_string().cyan()
                );

                Ok(0)
            })
        })
    }
}
