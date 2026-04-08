use shared::extensions::commands::CliCommandGroupBuilder;

mod create;
mod reset_token;

pub fn commands(cli: CliCommandGroupBuilder) -> CliCommandGroupBuilder {
    cli.add_command(
        "create",
        "Creates a new node for the Panel.",
        create::CreateCommand,
    )
    .add_command(
        "reset-token",
        "Resets the token for a node.",
        reset_token::ResetTokenCommand,
    )
}
