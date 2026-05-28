use colored::Colorize;
use shared::extensions::commands::CliCommandGroupBuilder;

#[tokio::main]
async fn main() {
    let env = shared::env::Env::parse();

    let cli = CliCommandGroupBuilder::new(
        "database-migrator",
        "A dedicated tool for applying database migrations for the panel.",
    );
    let mut cli = database_migrator::commands::commands(cli);

    let mut matches = cli.get_matches();
    let debug = *matches.get_one::<bool>("debug").unwrap();

    if debug && let Ok((env, _)) = &env {
        env.set_debug(true)
            .expect("failed to set debug mode from cli argument");
    }

    match matches.remove_subcommand() {
        Some((command, arg_matches)) => {
            if let Some((func, arg_matches)) = cli.match_command(command, arg_matches) {
                match func(env.as_ref().ok().map(|e| e.0.clone()), arg_matches).await {
                    Ok(exit_code) => {
                        drop(env);
                        std::process::exit(exit_code);
                    }
                    Err(err) => {
                        drop(env);
                        eprintln!(
                            "{}: {:?}",
                            "an error occurred while running cli command".red(),
                            err
                        );
                        std::process::exit(1);
                    }
                }
            } else {
                cli.print_help();
                std::process::exit(0);
            }
        }
        None => {
            cli.print_help();
            std::process::exit(0);
        }
    }
}
