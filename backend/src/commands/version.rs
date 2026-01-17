use chrono::Datelike;
use clap::Args;

#[derive(Args)]
pub struct VersionArgs;

pub struct VersionCommand;

impl shared::extensions::commands::CliCommand<VersionArgs> for VersionCommand {
    fn get_command(&self, command: clap::Command) -> clap::Command {
        command
    }

    fn get_executor(self) -> Box<shared::extensions::commands::ExecutorFunc> {
        Box::new(|_env, _arg_matches| {
            Box::pin(async move {
                println!(
                    "github.com/calagopus/panel {}:{}@{} ({})",
                    shared::VERSION,
                    shared::GIT_COMMIT,
                    shared::GIT_BRANCH,
                    shared::TARGET
                );
                println!(
                    "copyright © 2025 - {} 0x7d8 & Contributors",
                    chrono::Local::now().year()
                );

                Ok(())
            })
        })
    }
}
