use std::path::PathBuf;
use tokio::io::AsyncWriteExt;

pub const WINGS_VERSION: &str = env!("WINGS_VERSION");
pub static WINGS_BIN: &[u8] = include_bytes!("../bins/wings-rs");

pub async fn get_wings_bin_path() -> Result<PathBuf, std::io::Error> {
    pub static BIN_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

    let tmp_dir = std::env::temp_dir().join("calagopus");
    tokio::fs::create_dir_all(&tmp_dir).await?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o700);
        tokio::fs::set_permissions(&tmp_dir, perms).await?;
    }

    let bin_path = tmp_dir.join(format!("panel_wings_bin_{}", WINGS_VERSION));

    if tokio::fs::metadata(&bin_path).await.is_err() {
        let _lock = BIN_LOCK.lock().await;

        if tokio::fs::metadata(&bin_path).await.is_ok() {
            return Ok(bin_path);
        }

        let decompressed = tokio::task::spawn_blocking(|| {
            zstd::decode_all(WINGS_BIN).map_err(std::io::Error::other)
        })
        .await??;

        let mut file = tokio::fs::File::create(tmp_dir.join("panel_wings_bin_tmp")).await?;
        file.write_all(&decompressed).await?;
        file.flush().await?;
        drop(file);

        tokio::fs::rename(tmp_dir.join("panel_wings_bin_tmp"), &bin_path).await?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let perms = std::fs::Permissions::from_mode(0o755);
            tokio::fs::set_permissions(&bin_path, perms).await?;
        }
    }

    Ok(bin_path)
}
