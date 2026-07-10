use colored::Colorize;
use shared::extensions::commands::CliCommandGroupBuilder;
use std::path::{Path, PathBuf};

mod add;
mod apply;
mod clear;
mod export;
mod init;
mod inspect;
mod list;
mod remove;
mod resync;
mod update;

const FRONTEND_TSCONFIG: &str = r#"{
  "compilerOptions": {
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "module": "esnext",
    "target": "esnext",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "paths": {
      "@/*": ["../../../frontend/src/*"]
    },
    "types": ["../../../frontend/src/vite-env.d.ts"]
  },
  "include": ["src"]
}
"#;

#[cfg(unix)]
fn symlink_dir(original: &Path, link: &Path) -> std::io::Result<()> {
    std::os::unix::fs::symlink(original, link)
}

#[cfg(windows)]
fn symlink_dir(original: &Path, link: &Path) -> std::io::Result<()> {
    std::os::windows::fs::symlink_dir(original, link)
}

async fn remove_dir_or_symlink(path: &Path) -> std::io::Result<()> {
    let metadata = match tokio::fs::symlink_metadata(path).await {
        Ok(metadata) => metadata,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(err) => return Err(err),
    };

    if metadata.file_type().is_symlink() {
        match tokio::fs::remove_dir(path).await {
            Ok(()) => Ok(()),
            Err(_) => tokio::fs::remove_file(path).await,
        }
    } else if metadata.is_dir() {
        tokio::fs::remove_dir_all(path).await
    } else {
        tokio::fs::remove_file(path).await
    }
}

async fn remove_stale_migration_links() -> std::io::Result<()> {
    let mut entries = match tokio::fs::read_dir("database/extension-migrations").await {
        Ok(entries) => entries,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(err) => return Err(err),
    };

    while let Some(entry) = entries.next_entry().await? {
        if entry.file_type().await?.is_symlink() && tokio::fs::metadata(entry.path()).await.is_err()
        {
            tokio::fs::remove_file(entry.path()).await?;
            println!(
                "{} {}",
                "removed stale extension migrations symlink".yellow(),
                entry.path().to_string_lossy().bright_yellow()
            );
        }
    }

    Ok(())
}

async fn prepare_migrations_dir(identifier: &str) -> std::io::Result<PathBuf> {
    let migrations_dir = if shared::AppContainerType::detect().is_heavy() {
        Path::new("database/extension-migrations").join(identifier)
    } else {
        Path::new("backend-extensions")
            .join(identifier)
            .join("migrations")
    };

    if tokio::fs::symlink_metadata(&migrations_dir)
        .await
        .is_ok_and(|metadata| metadata.file_type().is_symlink())
    {
        remove_dir_or_symlink(&migrations_dir).await?;
    }
    tokio::fs::create_dir_all(&migrations_dir).await?;

    Ok(migrations_dir)
}

async fn create_compat_links(identifier: &str) -> Result<(), anyhow::Error> {
    let frontend_link = Path::new("frontend/extensions").join(identifier);
    let (migrations_link, migrations_target) = if shared::AppContainerType::detect().is_heavy() {
        (
            Path::new("backend-extensions")
                .join(identifier)
                .join("migrations"),
            Path::new("../../database/extension-migrations").join(identifier),
        )
    } else {
        (
            Path::new("database/extension-migrations").join(identifier),
            Path::new("../../backend-extensions")
                .join(identifier)
                .join("migrations"),
        )
    };

    remove_dir_or_symlink(&frontend_link).await?;
    prepare_migrations_dir(identifier).await?;
    remove_dir_or_symlink(&migrations_link).await?;

    tokio::fs::write(
        Path::new("backend-extensions")
            .join(identifier)
            .join("frontend")
            .join("tsconfig.json"),
        FRONTEND_TSCONFIG,
    )
    .await?;

    symlink_dir(
        &Path::new("../../backend-extensions")
            .join(identifier)
            .join("frontend"),
        &frontend_link,
    )?;
    symlink_dir(&migrations_target, &migrations_link)?;

    let node_modules_link = Path::new("backend-extensions")
        .join(identifier)
        .join("frontend")
        .join("node_modules");
    remove_dir_or_symlink(&node_modules_link).await?;
    symlink_dir(
        Path::new("../../../frontend/node_modules"),
        &node_modules_link,
    )?;

    Ok(())
}

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
    .add_command("clear", "Removes all extensions.", clear::ClearCommand)
    .add_command(
        "update",
        "Updates an extension using its identifier.",
        update::UpdateCommand,
    )
}
