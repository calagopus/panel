use clap::{Arg, ArgMatches, Args, Command};
use std::{collections::HashMap, pin::Pin, sync::Arc};

pub type ExecutorFunc = dyn Fn(
        Option<Arc<crate::env::Env>>,
        ArgMatches,
    ) -> Pin<Box<dyn Future<Output = Result<i32, anyhow::Error>>>>
    + Send;

pub enum CommandMapEntry {
    Command(Box<ExecutorFunc>),
    Group(HashMap<&'static str, CommandMapEntry>),
}

pub struct CliCommandGroupBuilder {
    command: Command,
    map: HashMap<&'static str, CommandMapEntry>,
}

impl CliCommandGroupBuilder {
    pub fn new(name: &'static str, about: &'static str) -> Self {
        Self {
            command: Command::new(name)
                .version(crate::full_version())
                .arg(
                    Arg::new("debug")
                        .help("pass in order to run in debug mode")
                        .num_args(0)
                        .short('d')
                        .long("debug")
                        .default_value("false")
                        .value_parser(clap::value_parser!(bool))
                        .global(true)
                        .required(false),
                )
                .about(about),
            map: HashMap::new(),
        }
    }

    pub fn get_matches(&mut self) -> ArgMatches {
        self.command.get_matches_mut()
    }

    pub fn print_help(&mut self) {
        let _ = self.command.print_long_help();
    }

    pub fn match_command(
        &self,
        command: String,
        arg_matches: ArgMatches,
    ) -> Option<(&ExecutorFunc, ArgMatches)> {
        let mut current_map = &self.map;
        let mut current_matches = arg_matches;
        let mut current_command = command;

        loop {
            let entry = current_map.get(current_command.as_str())?;

            match entry {
                CommandMapEntry::Command(executor) => {
                    return Some((executor, current_matches));
                }
                CommandMapEntry::Group(submap) => {
                    let (subcommand_name, subcommand_matches) =
                        current_matches.remove_subcommand()?;

                    current_map = submap;
                    current_matches = subcommand_matches;
                    current_command = subcommand_name;
                }
            }
        }
    }

    pub fn add_group<F: FnOnce(CliCommandGroupBuilder) -> CliCommandGroupBuilder>(
        mut self,
        name: &'static str,
        about: &'static str,
        callback: F,
    ) -> Self {
        let subgroup = CliCommandGroupBuilder::new(name, about);
        let subgroup = callback(subgroup);

        self.command = self.command.subcommand(subgroup.command);
        self.map.insert(name, CommandMapEntry::Group(subgroup.map));

        self
    }

    pub fn add_command<A: Args>(
        mut self,
        name: &'static str,
        about: &'static str,
        cli_command: impl CliCommand<A>,
    ) -> Self {
        let command = cli_command.get_command(Command::new(name).about(about));
        let command = A::augment_args(command);

        self.command = self.command.subcommand(command);
        self.map
            .insert(name, CommandMapEntry::Command(cli_command.get_executor()));

        self
    }
}

pub trait CliCommand<A: Args> {
    fn get_command(&self, command: Command) -> Command;
    fn get_executor(self) -> Box<ExecutorFunc>;
}
