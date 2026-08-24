use crate::extensions::distr::{ExtensionDistrFile, MetadataToml};
use serde::{Deserialize, Serialize};
use std::{path::Path, time::Duration};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt};
use utoipa::ToSchema;

pub static EXTENSION_DIR: &str = "/app/extensions";
pub static SOCKET_PATH: &str = "/tmp/calagopus/supervisor.sock";

const EXCHANGE_DEADLINE: Duration = Duration::from_secs(15);
const MAX_RESPONSE: u64 = 1024 * 1024;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Request {
    GetStatus,
    RequestRebuild {
        force: bool,
    },
    StreamLog {
        build_id: Option<u64>,
        from_offset: u64,
    },
    Cancel {
        build_id: Option<u64>,
    },
    RequestRestart,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Response {
    Status(Status),
    RebuildAccepted {
        build_id: u64,
    },
    RebuildAlreadyRunning {
        build_id: u64,
    },
    LogChunk {
        offset: u64,
        data: String,
        eof: bool,
    },
    CancelAccepted {
        build_id: u64,
    },
    CancelNotRunning,
    RestartAccepted,
    Error {
        message: String,
    },
}

#[derive(Debug, ToSchema, Serialize, Deserialize, Clone, Copy, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum BuildPhase {
    Preparing,
    Clearing,
    Adding { done: u32, total: u32 },
    Resync,
    StagingTranslations,
    Building,
    Verifying,
    Installing,
    Restarting,
}

#[derive(Debug, ToSchema, Serialize, Deserialize, Clone, Copy, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SupervisorState {
    Idle,
    Queued,
    Building { phase: BuildPhase },
    Succeeded,
    Failed,
}

#[derive(Debug, ToSchema, Serialize, Deserialize, Clone, PartialEq)]
pub struct Status {
    pub state: SupervisorState,
    pub panel_version: String,
    pub cache_key: String,
    pub bin_name: String,
    pub build_id: Option<u64>,
    pub started_at: Option<String>,
    pub finished_at: Option<String>,
    pub exit_code: Option<i32>,
    pub failure_reason: Option<String>,
    pub log_len: u64,
}

pub async fn ask(request: &Request) -> Result<Response, std::io::Error> {
    ask_at(Path::new(SOCKET_PATH), request, EXCHANGE_DEADLINE).await
}

async fn ask_at(
    socket: &Path,
    request: &Request,
    deadline: Duration,
) -> Result<Response, std::io::Error> {
    let exchange = async {
        let stream = tokio::net::UnixStream::connect(socket).await?;
        let (reader, mut writer) = stream.into_split();

        let mut line = serde_json::to_vec(request).map_err(std::io::Error::other)?;
        line.push(b'\n');
        writer.write_all(&line).await?;
        writer.flush().await?;

        let mut answer = Vec::new();
        tokio::io::BufReader::new(reader.take(MAX_RESPONSE))
            .read_until(b'\n', &mut answer)
            .await?;

        serde_json::from_slice(&answer)
            .map_err(|err| std::io::Error::new(std::io::ErrorKind::InvalidData, err))
    };

    match tokio::time::timeout(deadline, exchange).await {
        Ok(answer) => answer,
        Err(_) => Err(std::io::Error::new(
            std::io::ErrorKind::TimedOut,
            "the supervisor did not answer",
        )),
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
