use clap::{Args, FromArgMatches};
use colored::Colorize;
use compact_str::ToCompactString;
use dialoguer::{Input, theme::ColorfulTheme};
use shared::models::ByUuid;
use std::io::IsTerminal;

#[derive(Args)]
pub struct ResetTokenArgs {
    #[arg(long = "json", help = "output the new token in JSON format")]
    json: bool,

    #[arg(
        long = "node",
        help = "the name or UUID of the node to reset the token for"
    )]
    node: Option<String>,
}

pub struct ResetTokenCommand;

impl shared::extensions::commands::CliCommand<ResetTokenArgs> for ResetTokenCommand {
    fn get_command(&self, command: clap::Command) -> clap::Command {
        command
    }

    fn get_executor(self) -> Box<shared::extensions::commands::ExecutorFunc> {
        Box::new(|env, arg_matches| {
            Box::pin(async move {
                let args = ResetTokenArgs::from_arg_matches(&arg_matches)?;
                let state = shared::AppState::new_cli(env).await?;

                let node = match args.node {
                    Some(node) => node,
                    None => {
                        if std::io::stdout().is_terminal() {
                            let node: String = Input::with_theme(&ColorfulTheme::default())
                                .with_prompt("Node UUID")
                                .interact_text()?;
                            node
                        } else {
                            eprintln!(
                                "{}",
                                "node arg is required when not running in an interactive terminal"
                                    .red()
                            );
                            return Ok(1);
                        }
                    }
                };

                let node = if let Ok(uuid) = node.parse() {
                    shared::models::node::Node::by_uuid_optional(&state.database, uuid).await
                } else {
                    shared::models::node::Node::by_name(&state.database, &node).await
                }?;

                let Some(node) = node else {
                    eprintln!("{}", "node not found".red());
                    return Ok(1);
                };

                let (token_id, token) = node.reset_token(&state).await?;

                if args.json {
                    eprintln!(
                        "{}",
                        serde_json::to_string_pretty(&serde_json::json!({
                            "uuid": node.uuid,
                            "token_id": token_id,
                            "token": token,
                        }))?
                    );
                } else {
                    eprintln!(
                        "token has been reset for node {}",
                        node.uuid.to_compact_string().cyan()
                    );
                    eprintln!("  Token ID: {}", token_id.cyan());
                    eprintln!("  Token:    {}", token.cyan());
                }

                Ok(0)
            })
        })
    }
}
