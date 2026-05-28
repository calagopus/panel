use crate::extensions::distr::{ExtensionDistrFile, MetadataToml};
use std::path::Path;
use tokio::io::AsyncWriteExt;

pub static EXTENSION_DIR: &str = "/app/extensions";
pub static EXTENSION_ROOT_DIR: &str = "/app/repo";
pub static EXTENSION_LOG: &str = "/tmp/extension_build.log";
pub static EXTENSION_BUILD_LOCK: &str = "/tmp/extension_build.lock";
pub static EXTENSION_REBUILD_TRIGGER: &str = "/tmp/rebuild_trigger";

pub async fn is_locked() -> bool {
    tokio::fs::metadata(EXTENSION_BUILD_LOCK).await.is_ok()
}

pub async fn trigger_rebuild() -> Result<(), std::io::Error> {
    let mut file = tokio::fs::File::create(EXTENSION_REBUILD_TRIGGER).await?;
    file.write_all(b"rebuild").await?;

    Ok(())
}

pub async fn get_build_logs() -> Box<dyn tokio::io::AsyncRead + Unpin + Send> {
    match tokio::fs::File::open(EXTENSION_LOG).await {
        Ok(file) => Box::new(file) as Box<dyn tokio::io::AsyncRead + Unpin + Send>,
        Err(_) => Box::new(tokio::io::empty()),
    }
}

pub async fn write_extension(
    data: &mut (dyn tokio::io::AsyncRead + Unpin + Send),
) -> Result<ExtensionDistrFile, anyhow::Error> {
    let tmp_dir = tempfile::tempdir()?;
    let tmp_path = tmp_dir.path().join("extension.c7s.zip");

    let mut tmp_file = tokio::fs::File::create_new(&tmp_path).await?;
    tokio::io::copy(data, &mut tmp_file).await?;
    let tmp_file = tmp_file.into_std().await;

    let distr =
        tokio::task::spawn_blocking(move || ExtensionDistrFile::parse_from_reader(tmp_file))
            .await??;

    let identifier = distr.metadata_toml.get_package_identifier();
    if !MetadataToml::is_valid_package_identifier(&identifier) {
        return Err(anyhow::anyhow!("invalid package identifier `{identifier}`"));
    }

    tokio::fs::copy(
        tmp_path,
        Path::new(EXTENSION_DIR).join(format!("{}.c7s.zip", identifier)),
    )
    .await?;

    Ok(distr)
}

pub async fn remove_extension(package_name: &str) -> Result<(), std::io::Error> {
    let identifier = MetadataToml::convert_package_name_to_identifier(package_name);
    if !MetadataToml::is_valid_package_identifier(&identifier) {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            format!("invalid package identifier `{identifier}`"),
        ));
    }

    let path = Path::new(EXTENSION_DIR).join(format!("{}.c7s.zip", identifier));

    tokio::fs::remove_file(path).await?;

    Ok(())
}

pub async fn list_extensions() -> Result<Vec<ExtensionDistrFile>, anyhow::Error> {
    let mut entries = tokio::fs::read_dir(EXTENSION_DIR).await?;
    let mut extensions = Vec::new();

    while let Some(entry) = entries.next_entry().await? {
        if entry.file_type().await?.is_file() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("zip") {
                let file = tokio::fs::File::open(path).await?;
                let file = file.into_std().await;
                let distr = match tokio::task::spawn_blocking(move || {
                    ExtensionDistrFile::parse_from_reader(file)
                })
                .await
                {
                    Ok(Ok(d)) => d,
                    _ => continue,
                };

                extensions.push(distr);
            }
        }
    }

    Ok(extensions)
}
