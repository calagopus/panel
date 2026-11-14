use shared::extensions::commands::CliCommandGroupBuilder;

mod migrate_s3;

pub fn commands(cli: CliCommandGroupBuilder) -> CliCommandGroupBuilder {
    cli.add_command(
        "migrate-s3",
        "Uploads local storage assets to the S3 storage configured in the Panel settings.",
        migrate_s3::MigrateS3Command,
    )
}
