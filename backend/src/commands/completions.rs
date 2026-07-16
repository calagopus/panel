use clap::{Args, FromArgMatches};
use colored::Colorize;

#[derive(Args)]
pub struct CompletionsArgs {
    #[arg(
        short = 's',
        long = "shell",
        help = "the shell to generate completions for",
        default_value = "bash"
    )]
    shell: clap_complete::Shell,
}

pub struct CompletionsCommand;

impl shared::extensions::commands::CliCommand<CompletionsArgs> for CompletionsCommand {
    fn get_command(&self, command: clap::Command) -> clap::Command {
        command
    }

    fn get_executor(self) -> Box<shared::extensions::commands::ExecutorFunc> {
        Box::new(|_env, arg_matches| {
            Box::pin(async move {
                let args = CompletionsArgs::from_arg_matches(&arg_matches)?;

                let binary = match std::env::current_exe() {
                    Ok(path) => path,
                    Err(_) => {
                        eprintln!("{}", "failed to get current executable path".red());
                        return Ok(1);
                    }
                };

                let mut command = crate::CLAP_COMMAND
                    .get()
                    .ok_or_else(|| anyhow::anyhow!("CLAP_COMMAND not initialized"))?
                    .clone();
                clap_complete::generate(
                    args.shell,
                    &mut command,
                    binary
                        .file_name()
                        .and_then(|name| name.to_str())
                        .unwrap_or("calagopus-panel"),
                    &mut std::io::stdout(),
                );

                Ok(0)
            })
        })
    }
}
