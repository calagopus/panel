use shared::extensions::commands::CliCommandGroupBuilder;

mod add;
mod apply;
mod export;
mod init;
mod inspect;
mod list;
mod remove;
mod resync;
mod update;

pub fn commands(cli: CliCommandGroupBuilder) -> CliCommandGroupBuilder {
    cli.add_command(
        "list",
        "Lists the currently installed and pending extensions for the Panel.",
        list::ListCommand,
    )
    .add_command(
        "inspect",
        "Inspects a .c7s.zip extension file for the Panel.",
        inspect::InspectCommand,
    )
    .add_command(
        "init",
        "Initializes a new extension using a template.",
        init::InitCommand,
    )
    .add_command(
        "export",
        "Exports an extension using its identifier.",
        export::ExportCommand,
    )
    .add_command(
        "apply",
        "Applies (builds) all extensions and panel sourcecode to the current bin location.",
        apply::ApplyCommand,
    )
    .add_command(
        "resync",
        "Resyncs the internal extension list used for building the Panel.",
        resync::ResyncCommand,
    )
    .add_command(
        "add",
        "Adds an extension using a calagopus extension archive.",
        add::AddCommand,
    )
    .add_command(
        "remove",
        "Removes an extension using its identifier.",
        remove::RemoveCommand,
    )
    .add_command(
        "update",
        "Updates an extension using its identifier.",
        update::UpdateCommand,
    )
}
