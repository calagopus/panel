use shared::extensions::commands::CliCommandGroupBuilder;

mod backups;
mod diagnostics;
mod extensions;
mod import;
mod nests;
mod nodes;
mod service_install;
mod users;
mod version;

pub fn commands(cli: CliCommandGroupBuilder) -> CliCommandGroupBuilder {
    cli.add_command(
        "version",
        "Prints the current executable version and exits.",
        version::VersionCommand,
    )
    .add_command(
        "service-install",
        "Installs the Panel service on the system.",
        service_install::ServiceInstallCommand,
    )
    .add_command(
        "diagnostics",
        "Gets Diagnostic Data for the Panel.",
        diagnostics::DiagnosticsCommand,
    )
    .add_group("users", "Manage users within the Panel.", users::commands)
    .add_group("nests", "Manage nests within the Panel.", nests::commands)
    .add_group("nodes", "Manage nodes within the Panel.", nodes::commands)
    .add_group(
        "backups",
        "Manage backups within the Panel.",
        backups::commands,
    )
    .add_group(
        "import",
        "Import data from other panel software into Calagopus.",
        import::commands,
    )
    .add_group(
        "extensions",
        "Manage Extensions for the Panel.",
        extensions::commands,
    )
    .add_group(
        "database-migrator",
        "Manage Database Migrations.",
        database_migrator::commands::commands,
    )
}
