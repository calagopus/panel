use shared::extensions::commands::CliCommandGroupBuilder;

mod import;

pub fn commands(cli: CliCommandGroupBuilder) -> CliCommandGroupBuilder {
    cli.add_command(
        "import",
        "Imports missing S3 backups into the Panel.",
        import::ImportCommand,
    )
}
