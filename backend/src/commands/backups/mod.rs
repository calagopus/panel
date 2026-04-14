use shared::extensions::commands::CliCommandGroupBuilder;

mod s3;

pub fn commands(cli: CliCommandGroupBuilder) -> CliCommandGroupBuilder {
    cli.add_group("s3", "Manage S3 backups within the Panel.", s3::commands)
}
