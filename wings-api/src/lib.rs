// This file is auto-generated from OpenAPI spec. Do not edit manually.
use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

pub mod client;
mod extra;
pub use extra::*;

nestify::nest! {
    #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct ApiError {
        #[schema(inline)]
        pub error: compact_str::CompactString,
    }
}

#[derive(Debug, ToSchema, Deserialize, Serialize, Clone, Copy)]
pub enum AppContainerType {
    #[serde(rename = "official")]
    Official,
    #[serde(rename = "unknown")]
    Unknown,
    #[serde(rename = "none")]
    None,
}

#[derive(Debug, ToSchema, Deserialize, Serialize, Clone, Copy)]
pub enum ArchiveFormat {
    #[serde(rename = "tar")]
    Tar,
    #[serde(rename = "tar_gz")]
    TarGz,
    #[serde(rename = "tar_xz")]
    TarXz,
    #[serde(rename = "tar_lzip")]
    TarLzip,
    #[serde(rename = "tar_bz2")]
    TarBz2,
    #[serde(rename = "tar_lz4")]
    TarLz4,
    #[serde(rename = "tar_zstd")]
    TarZstd,
    #[serde(rename = "zip")]
    Zip,
    #[serde(rename = "seven_zip")]
    SevenZip,
}

#[derive(Debug, ToSchema, Deserialize, Serialize, Clone, Copy)]
pub enum BackupAdapter {
    #[serde(rename = "wings")]
    Wings,
    #[serde(rename = "s3")]
    S3,
    #[serde(rename = "ddup-bak")]
    DdupBak,
    #[serde(rename = "btrfs")]
    Btrfs,
    #[serde(rename = "zfs")]
    Zfs,
    #[serde(rename = "restic")]
    Restic,
}

#[derive(Debug, ToSchema, Deserialize, Serialize, Clone, Copy)]
pub enum CompressionLevel {
    #[serde(rename = "best_speed")]
    BestSpeed,
    #[serde(rename = "good_speed")]
    GoodSpeed,
    #[serde(rename = "good_compression")]
    GoodCompression,
    #[serde(rename = "best_compression")]
    BestCompression,
}

nestify::nest! {
    #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct DirectoryEntry {
        #[schema(inline)]
        pub name: compact_str::CompactString,
        #[schema(inline)]
        pub created: chrono::DateTime<chrono::Utc>,
        #[schema(inline)]
        pub modified: chrono::DateTime<chrono::Utc>,
        #[schema(inline)]
        pub mode: compact_str::CompactString,
        #[schema(inline)]
        pub mode_bits: compact_str::CompactString,
        #[schema(inline)]
        pub size: u64,
        #[schema(inline)]
        pub directory: bool,
        #[schema(inline)]
        pub file: bool,
        #[schema(inline)]
        pub symlink: bool,
        #[schema(inline)]
        pub mime: compact_str::CompactString,
    }
}

#[derive(Debug, ToSchema, Deserialize, Serialize, Clone, Copy)]
pub enum DiskLimiterMode {
    #[serde(rename = "none")]
    None,
    #[serde(rename = "btrfs_subvolume")]
    BtrfsSubvolume,
    #[serde(rename = "zfs_dataset")]
    ZfsDataset,
    #[serde(rename = "xfs_quota")]
    XfsQuota,
    #[serde(rename = "fuse_quota")]
    FuseQuota,
}

nestify::nest! {
    #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Download {
        #[schema(inline)]
        pub identifier: uuid::Uuid,
        #[schema(inline)]
        pub destination: compact_str::CompactString,
        #[schema(inline)]
        pub progress: u64,
        #[schema(inline)]
        pub total: u64,
    }
}

nestify::nest! {
    #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct InstallationScript {
        #[schema(inline)]
        pub container_image: compact_str::CompactString,
        #[schema(inline)]
        pub entrypoint: compact_str::CompactString,
        #[schema(inline)]
        pub script: compact_str::CompactString,
        #[schema(inline)]
        pub environment: IndexMap<compact_str::CompactString, serde_json::Value>,
    }
}

nestify::nest! {
    #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Mount {
        #[schema(inline)]
        pub target: compact_str::CompactString,
        #[schema(inline)]
        pub source: compact_str::CompactString,
        #[schema(inline)]
        pub read_only: bool,
    }
}

nestify::nest! {
    #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct ResourceUsage {
        #[schema(inline)]
        pub memory_bytes: u64,
        #[schema(inline)]
        pub memory_limit_bytes: u64,
        #[schema(inline)]
        pub disk_bytes: u64,
        #[schema(inline)]
        pub state: ServerState,
        #[schema(inline)]
        pub network: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct ResourceUsageNetwork {
            #[schema(inline)]
            pub rx_bytes: u64,
            #[schema(inline)]
            pub tx_bytes: u64,
        },

        #[schema(inline)]
        pub cpu_absolute: f64,
        #[schema(inline)]
        pub uptime: u64,
    }
}

nestify::nest! {
    #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Schedule {
        #[schema(inline)]
        pub uuid: uuid::Uuid,
        #[schema(inline)]
        pub triggers: serde_json::Value,
        #[schema(inline)]
        pub condition: serde_json::Value,
        #[schema(inline)]
        pub actions: Vec<serde_json::Value>,
    }
}

nestify::nest! {
    #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct ScheduleStatus {
        #[schema(inline)]
        pub running: bool,
        #[schema(inline)]
        pub errors: IndexMap<compact_str::CompactString, compact_str::CompactString>,
        #[schema(inline)]
        pub step: Option<uuid::Uuid>,
    }
}

nestify::nest! {
    #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Server {
        #[schema(inline)]
        pub state: ServerState,
        #[schema(inline)]
        pub is_suspended: bool,
        #[schema(inline)]
        pub utilization: ResourceUsage,
        #[schema(inline)]
        pub configuration: ServerConfiguration,
    }
}

#[derive(Debug, ToSchema, Deserialize, Serialize, Clone, Copy)]
pub enum ServerAutoStartBehavior {
    #[serde(rename = "always")]
    Always,
    #[serde(rename = "unless_stopped")]
    UnlessStopped,
    #[serde(rename = "never")]
    Never,
}

nestify::nest! {
    #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct ServerConfiguration {
        #[schema(inline)]
        pub uuid: uuid::Uuid,
        #[schema(inline)]
        pub start_on_completion: Option<bool>,
        #[schema(inline)]
        pub meta: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct ServerConfigurationMeta {
            #[schema(inline)]
            pub name: compact_str::CompactString,
            #[schema(inline)]
            pub description: compact_str::CompactString,
        },

        #[schema(inline)]
        pub suspended: bool,
        #[schema(inline)]
        pub invocation: compact_str::CompactString,
        #[schema(inline)]
        pub skip_egg_scripts: bool,
        #[schema(inline)]
        pub environment: IndexMap<compact_str::CompactString, serde_json::Value>,
        #[schema(inline)]
        pub labels: IndexMap<compact_str::CompactString, compact_str::CompactString>,
        #[schema(inline)]
        pub backups: Vec<uuid::Uuid>,
        #[schema(inline)]
        pub schedules: Vec<Schedule>,
        #[schema(inline)]
        pub allocations: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct ServerConfigurationAllocations {
            #[schema(inline)]
            pub force_outgoing_ip: bool,
            #[schema(inline)]
            pub default: Option<#[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct ServerConfigurationAllocationsDefault {
                #[schema(inline)]
                pub ip: compact_str::CompactString,
                #[schema(inline)]
                pub port: u32,
            }>,
            #[schema(inline)]
            pub mappings: IndexMap<compact_str::CompactString, Vec<u32>>,
        },

        #[schema(inline)]
        pub build: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct ServerConfigurationBuild {
            #[schema(inline)]
            pub memory_limit: i64,
            #[schema(inline)]
            pub swap: i64,
            #[schema(inline)]
            pub io_weight: Option<u32>,
            #[schema(inline)]
            pub cpu_limit: i64,
            #[schema(inline)]
            pub disk_space: u64,
            #[schema(inline)]
            pub threads: Option<compact_str::CompactString>,
            #[schema(inline)]
            pub oom_disabled: bool,
        },

        #[schema(inline)]
        pub mounts: Vec<Mount>,
        #[schema(inline)]
        pub egg: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct ServerConfigurationEgg {
            #[schema(inline)]
            pub id: uuid::Uuid,
            #[schema(inline)]
            pub file_denylist: Vec<compact_str::CompactString>,
        },

        #[schema(inline)]
        pub container: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct ServerConfigurationContainer {
            #[schema(inline)]
            pub image: compact_str::CompactString,
            #[schema(inline)]
            pub timezone: Option<compact_str::CompactString>,
            #[schema(inline)]
            pub hugepages_passthrough_enabled: bool,
            #[schema(inline)]
            pub seccomp: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct ServerConfigurationContainerSeccomp {
                #[schema(inline)]
                pub remove_allowed: Vec<compact_str::CompactString>,
            },

        },

        #[schema(inline)]
        pub auto_kill: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct ServerConfigurationAutoKill {
            #[schema(inline)]
            pub enabled: bool,
            #[schema(inline)]
            pub seconds: u64,
        },

        #[schema(inline)]
        pub auto_start_behavior: ServerAutoStartBehavior,
    }
}

#[derive(Debug, ToSchema, Deserialize, Serialize, Clone, Copy)]
pub enum ServerPowerAction {
    #[serde(rename = "start")]
    Start,
    #[serde(rename = "stop")]
    Stop,
    #[serde(rename = "restart")]
    Restart,
    #[serde(rename = "kill")]
    Kill,
}

#[derive(Debug, ToSchema, Deserialize, Serialize, Clone, Copy)]
pub enum ServerState {
    #[serde(rename = "offline")]
    Offline,
    #[serde(rename = "starting")]
    Starting,
    #[serde(rename = "stopping")]
    Stopping,
    #[serde(rename = "running")]
    Running,
}

#[derive(Debug, ToSchema, Deserialize, Serialize, Clone, Copy)]
pub enum SystemBackupsDdupBakCompressionFormat {
    #[serde(rename = "none")]
    None,
    #[serde(rename = "deflate")]
    Deflate,
    #[serde(rename = "gzip")]
    Gzip,
    #[serde(rename = "brotli")]
    Brotli,
}

nestify::nest! {
    #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct SystemStats {
        #[schema(inline)]
        pub cpu: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct SystemStatsCpu {
            #[schema(inline)]
            pub used: f64,
            #[schema(inline)]
            pub threads: u64,
            #[schema(inline)]
            pub model: compact_str::CompactString,
        },

        #[schema(inline)]
        pub network: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct SystemStatsNetwork {
            #[schema(inline)]
            pub received: u64,
            #[schema(inline)]
            pub receiving_rate: f64,
            #[schema(inline)]
            pub sent: u64,
            #[schema(inline)]
            pub sending_rate: f64,
        },

        #[schema(inline)]
        pub memory: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct SystemStatsMemory {
            #[schema(inline)]
            pub used: u64,
            #[schema(inline)]
            pub total: u64,
        },

        #[schema(inline)]
        pub disk: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct SystemStatsDisk {
            #[schema(inline)]
            pub used: u64,
            #[schema(inline)]
            pub total: u64,
            #[schema(inline)]
            pub read: u64,
            #[schema(inline)]
            pub reading_rate: f64,
            #[schema(inline)]
            pub written: u64,
            #[schema(inline)]
            pub writing_rate: f64,
        },

    }
}

#[derive(Debug, ToSchema, Deserialize, Serialize, Clone, Copy)]
pub enum TransferArchiveFormat {
    #[serde(rename = "tar")]
    Tar,
    #[serde(rename = "tar_gz")]
    TarGz,
    #[serde(rename = "tar_xz")]
    TarXz,
    #[serde(rename = "tar_lzip")]
    TarLzip,
    #[serde(rename = "tar_bz2")]
    TarBz2,
    #[serde(rename = "tar_lz4")]
    TarLz4,
    #[serde(rename = "tar_zstd")]
    TarZstd,
}

pub mod backups_backup {
    use super::*;

    pub mod delete {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub adapter: BackupAdapter,
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response202 {
            }
        }

        pub type Response404 = ApiError;

        pub type Response = Response202;
    }
}
pub mod deauthorize_user {
    use super::*;

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub user: uuid::Uuid,
                #[schema(inline)]
                pub servers: Vec<uuid::Uuid>,
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response409 {
                #[schema(inline)]
                pub error: compact_str::CompactString,
            }
        }

        pub type Response = Response200;
    }
}
pub mod servers {
    use super::*;

    pub mod get {
        use super::*;

        pub type Response200 = Vec<Server>;

        pub type Response = Response200;
    }

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub uuid: uuid::Uuid,
                #[schema(inline)]
                pub start_on_completion: bool,
                #[schema(inline)]
                pub skip_scripts: bool,
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
            }
        }

        pub type Response409 = ApiError;

        pub type Response = Response200;
    }
}
pub mod servers_power {
    use super::*;

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub servers: Vec<uuid::Uuid>,
                #[schema(inline)]
                pub action: ServerPowerAction,
                #[schema(inline)]
                pub wait_seconds: Option<u64>,
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response202 {
                #[schema(inline)]
                pub affected: u64,
            }
        }

        pub type Response = Response202;
    }
}
pub mod servers_server {
    use super::*;

    pub mod get {
        use super::*;

        pub type Response200 = Server;

        pub type Response = Response200;
    }

    pub mod delete {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
            }
        }

        pub type Response = Response200;
    }
}
pub mod servers_server_backup {
    use super::*;

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub adapter: BackupAdapter,
                #[schema(inline)]
                pub uuid: uuid::Uuid,
                #[schema(inline)]
                pub ignore: compact_str::CompactString,
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response202 {
            }
        }

        pub type Response409 = ApiError;

        pub type Response = Response202;
    }
}
pub mod servers_server_backup_backup {
    use super::*;

    pub mod delete {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response202 {
            }
        }

        pub type Response404 = ApiError;

        pub type Response = Response202;
    }
}
pub mod servers_server_backup_backup_restore {
    use super::*;

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub adapter: BackupAdapter,
                #[schema(inline)]
                pub truncate_directory: bool,
                #[schema(inline)]
                pub download_url: Option<compact_str::CompactString>,
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response202 {
            }
        }

        pub type Response404 = ApiError;

        pub type Response = Response202;
    }
}
pub mod servers_server_commands {
    use super::*;

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub commands: Vec<compact_str::CompactString>,
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
            }
        }

        pub type Response417 = ApiError;

        pub type Response = Response200;
    }
}
pub mod servers_server_files_chmod {
    use super::*;

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub root: compact_str::CompactString,
                #[schema(inline)]
                pub files: Vec<#[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBodyFiles {
                    #[schema(inline)]
                    pub file: compact_str::CompactString,
                    #[schema(inline)]
                    pub mode: compact_str::CompactString,
                }>,
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
                #[schema(inline)]
                pub updated: u64,
            }
        }

        pub type Response404 = ApiError;

        pub type Response417 = ApiError;

        pub type Response = Response200;
    }
}
pub mod servers_server_files_compress {
    use super::*;

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub format: ArchiveFormat,
                #[schema(inline)]
                pub name: Option<compact_str::CompactString>,
                #[schema(inline)]
                pub root: compact_str::CompactString,
                #[schema(inline)]
                pub files: Vec<compact_str::CompactString>,
                #[schema(inline)]
                pub foreground: bool,
            }
        }

        pub type Response200 = DirectoryEntry;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response202 {
                #[schema(inline)]
                pub identifier: uuid::Uuid,
            }
        }

        pub type Response404 = ApiError;

        pub type Response417 = ApiError;

        #[derive(Deserialize)]
        #[serde(untagged)]
        pub enum Response {
            Ok(Response200),
            Accepted(Response202),
        }
    }
}
pub mod servers_server_files_contents {
    use super::*;

    pub mod get {
        use super::*;

        pub type Response200 = String;

        pub type Response404 = ApiError;

        pub type Response413 = ApiError;

        pub type Response417 = ApiError;

        pub type Response = Response200;
    }
}
pub mod servers_server_files_copy {
    use super::*;

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub path: compact_str::CompactString,
                #[schema(inline)]
                pub name: Option<compact_str::CompactString>,
                #[schema(inline)]
                pub foreground: bool,
            }
        }

        pub type Response200 = DirectoryEntry;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response202 {
                #[schema(inline)]
                pub identifier: uuid::Uuid,
            }
        }

        pub type Response404 = ApiError;

        pub type Response417 = ApiError;

        #[derive(Deserialize)]
        #[serde(untagged)]
        pub enum Response {
            Ok(Response200),
            Accepted(Response202),
        }
    }
}
pub mod servers_server_files_copy_remote {
    use super::*;

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub url: compact_str::CompactString,
                #[schema(inline)]
                pub token: compact_str::CompactString,
                #[schema(inline)]
                pub archive_format: TransferArchiveFormat,
                #[schema(inline)]
                pub compression_level: Option<CompressionLevel>,
                #[schema(inline)]
                pub root: compact_str::CompactString,
                #[schema(inline)]
                pub files: Vec<compact_str::CompactString>,
                #[schema(inline)]
                pub destination_server: uuid::Uuid,
                #[schema(inline)]
                pub destination_path: compact_str::CompactString,
                #[schema(inline)]
                pub foreground: bool,
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response202 {
                #[schema(inline)]
                pub identifier: uuid::Uuid,
            }
        }

        pub type Response404 = ApiError;

        pub type Response417 = ApiError;

        #[derive(Deserialize)]
        #[serde(untagged)]
        pub enum Response {
            Ok(Response200),
            Accepted(Response202),
        }
    }
}
pub mod servers_server_files_create_directory {
    use super::*;

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub root: compact_str::CompactString,
                #[schema(inline)]
                pub name: compact_str::CompactString,
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
            }
        }

        pub type Response404 = ApiError;

        pub type Response417 = ApiError;

        pub type Response = Response200;
    }
}
pub mod servers_server_files_decompress {
    use super::*;

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub root: compact_str::CompactString,
                #[schema(inline)]
                pub file: compact_str::CompactString,
                #[schema(inline)]
                pub foreground: bool,
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response202 {
                #[schema(inline)]
                pub identifier: uuid::Uuid,
            }
        }

        pub type Response404 = ApiError;

        pub type Response417 = ApiError;

        #[derive(Deserialize)]
        #[serde(untagged)]
        pub enum Response {
            Ok(Response200),
            Accepted(Response202),
        }
    }
}
pub mod servers_server_files_delete {
    use super::*;

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub root: compact_str::CompactString,
                #[schema(inline)]
                pub files: Vec<compact_str::CompactString>,
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
                #[schema(inline)]
                pub deleted: u64,
            }
        }

        pub type Response404 = ApiError;

        pub type Response417 = ApiError;

        pub type Response = Response200;
    }
}
pub mod servers_server_files_fingerprints {
    use super::*;

    pub mod get {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
                #[schema(inline)]
                pub fingerprints: IndexMap<compact_str::CompactString, compact_str::CompactString>,
            }
        }

        pub type Response = Response200;
    }
}
pub mod servers_server_files_list {
    use super::*;

    pub mod get {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
                #[schema(inline)]
                pub total: u64,
                #[schema(inline)]
                pub filesystem_writable: bool,
                #[schema(inline)]
                pub filesystem_fast: bool,
                #[schema(inline)]
                pub entries: Vec<DirectoryEntry>,
            }
        }

        pub type Response404 = ApiError;

        pub type Response417 = ApiError;

        pub type Response = Response200;
    }
}
pub mod servers_server_files_list_directory {
    use super::*;

    pub mod get {
        use super::*;

        pub type Response200 = Vec<DirectoryEntry>;

        pub type Response404 = ApiError;

        pub type Response417 = ApiError;

        pub type Response = Response200;
    }
}
pub mod servers_server_files_operations_operation {
    use super::*;

    pub mod delete {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
            }
        }

        pub type Response404 = ApiError;

        pub type Response = Response200;
    }
}
pub mod servers_server_files_pull {
    use super::*;

    pub mod get {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
                #[schema(inline)]
                pub downloads: Vec<Download>,
            }
        }

        pub type Response = Response200;
    }

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub root: compact_str::CompactString,
                #[schema(inline)]
                pub url: compact_str::CompactString,
                #[schema(inline)]
                pub file_name: Option<compact_str::CompactString>,
                #[schema(inline)]
                pub use_header: bool,
                #[schema(inline)]
                pub foreground: bool,
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response202 {
                #[schema(inline)]
                pub identifier: uuid::Uuid,
            }
        }

        pub type Response417 = ApiError;

        #[derive(Deserialize)]
        #[serde(untagged)]
        pub enum Response {
            Ok(Response200),
            Accepted(Response202),
        }
    }
}
pub mod servers_server_files_pull_query {
    use super::*;

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub url: compact_str::CompactString,
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
                #[schema(inline)]
                pub file_name: Option<compact_str::CompactString>,
                #[schema(inline)]
                pub file_size: Option<u64>,
                #[schema(inline)]
                pub final_url: compact_str::CompactString,
                #[schema(inline)]
                pub headers: IndexMap<compact_str::CompactString, compact_str::CompactString>,
            }
        }

        pub type Response417 = ApiError;

        pub type Response = Response200;
    }
}
pub mod servers_server_files_pull_pull {
    use super::*;

    pub mod delete {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
            }
        }

        pub type Response404 = ApiError;

        pub type Response = Response200;
    }
}
pub mod servers_server_files_rename {
    use super::*;

    pub mod put {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub root: compact_str::CompactString,
                #[schema(inline)]
                pub files: Vec<#[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBodyFiles {
                    #[schema(inline)]
                    pub from: compact_str::CompactString,
                    #[schema(inline)]
                    pub to: compact_str::CompactString,
                }>,
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
                #[schema(inline)]
                pub renamed: u64,
            }
        }

        pub type Response404 = ApiError;

        pub type Response = Response200;
    }
}
pub mod servers_server_files_search {
    use super::*;

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub root: compact_str::CompactString,
                #[schema(inline)]
                pub path_filter: Option<#[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBodyPathFilter {
                    #[schema(inline)]
                    pub include: Vec<compact_str::CompactString>,
                    #[schema(inline)]
                    pub exclude: Vec<compact_str::CompactString>,
                    #[schema(inline)]
                    pub case_insensitive: bool,
                }>,
                #[schema(inline)]
                pub size_filter: Option<#[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBodySizeFilter {
                    #[schema(inline)]
                    pub min: u64,
                    #[schema(inline)]
                    pub max: u64,
                }>,
                #[schema(inline)]
                pub content_filter: Option<#[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBodyContentFilter {
                    #[schema(inline)]
                    pub query: compact_str::CompactString,
                    #[schema(inline)]
                    pub max_search_size: u64,
                    #[schema(inline)]
                    pub include_unmatched: bool,
                    #[schema(inline)]
                    pub case_insensitive: bool,
                }>,
                #[schema(inline)]
                pub per_page: u64,
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
                #[schema(inline)]
                pub results: Vec<DirectoryEntry>,
            }
        }

        pub type Response404 = ApiError;

        pub type Response = Response200;
    }
}
pub mod servers_server_files_write {
    use super::*;

    pub mod post {
        use super::*;

        pub type RequestBody = compact_str::CompactString;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
            }
        }

        pub type Response404 = ApiError;

        pub type Response417 = ApiError;

        pub type Response = Response200;
    }
}
pub mod servers_server_install_abort {
    use super::*;

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response202 {
            }
        }

        pub type Response409 = ApiError;

        pub type Response = Response202;
    }
}
pub mod servers_server_logs {
    pub mod get {
        pub type Response200 = String;

        pub type Response = Response200;
    }
}
pub mod servers_server_logs_install {
    use super::*;

    pub mod get {
        use super::*;

        pub type Response200 = String;

        pub type Response404 = ApiError;

        pub type Response = Response200;
    }
}
pub mod servers_server_power {
    use super::*;

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub action: ServerPowerAction,
                #[schema(inline)]
                pub wait_seconds: Option<u64>,
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response202 {
            }
        }

        pub type Response = Response202;
    }
}
pub mod servers_server_reinstall {
    use super::*;

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub truncate_directory: bool,
                #[schema(inline)]
                pub installation_script: Option<InstallationScript>,
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response202 {
            }
        }

        pub type Response409 = ApiError;

        pub type Response = Response202;
    }
}
pub mod servers_server_schedules_schedule {
    use super::*;

    pub mod get {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
                #[schema(inline)]
                pub status: ScheduleStatus,
            }
        }

        pub type Response404 = ApiError;

        pub type Response = Response200;
    }
}
pub mod servers_server_schedules_schedule_abort {
    use super::*;

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
            }
        }

        pub type Response404 = ApiError;

        pub type Response = Response200;
    }
}
pub mod servers_server_schedules_schedule_trigger {
    use super::*;

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub skip_condition: bool,
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
            }
        }

        pub type Response404 = ApiError;

        pub type Response = Response200;
    }
}
pub mod servers_server_script {
    use super::*;

    pub mod post {
        use super::*;

        pub type RequestBody = InstallationScript;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
                #[schema(inline)]
                pub stdout: compact_str::CompactString,
                #[schema(inline)]
                pub stderr: compact_str::CompactString,
            }
        }

        pub type Response = Response200;
    }
}
pub mod servers_server_sync {
    use super::*;

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub server: serde_json::Value,
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
            }
        }

        pub type Response = Response200;
    }
}
pub mod servers_server_transfer {
    use super::*;

    pub mod delete {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
            }
        }

        pub type Response417 = ApiError;

        pub type Response = Response200;
    }

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub url: compact_str::CompactString,
                #[schema(inline)]
                pub token: compact_str::CompactString,
                #[schema(inline)]
                pub archive_format: TransferArchiveFormat,
                #[schema(inline)]
                pub compression_level: Option<CompressionLevel>,
                #[schema(inline)]
                pub backups: Vec<uuid::Uuid>,
                #[schema(inline)]
                pub delete_backups: bool,
                #[schema(inline)]
                pub multiplex_streams: u64,
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response202 {
            }
        }

        pub type Response409 = ApiError;

        pub type Response = Response202;
    }
}
pub mod servers_server_version {
    use super::*;

    pub mod get {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
                #[schema(inline)]
                pub hash: compact_str::CompactString,
            }
        }

        pub type Response404 = ApiError;

        pub type Response = Response200;
    }
}
pub mod servers_server_ws_deny {
    use super::*;

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub jtis: Vec<compact_str::CompactString>,
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
            }
        }

        pub type Response = Response200;
    }
}
pub mod servers_server_ws_permissions {
    use super::*;

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub user_permissions: Vec<#[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBodyUserPermissions {
                    #[schema(inline)]
                    pub user: uuid::Uuid,
                    #[schema(inline)]
                    pub permissions: Vec<compact_str::CompactString>,
                    #[schema(inline)]
                    pub ignored_files: Vec<compact_str::CompactString>,
                }>,
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
            }
        }

        pub type Response = Response200;
    }
}
pub mod system {
    use super::*;

    pub mod get {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
                #[schema(inline)]
                pub architecture: compact_str::CompactString,
                #[schema(inline)]
                pub cpu_count: u64,
                #[schema(inline)]
                pub kernel_version: compact_str::CompactString,
                #[schema(inline)]
                pub os: compact_str::CompactString,
                #[schema(inline)]
                pub version: compact_str::CompactString,
            }
        }

        pub type Response = Response200;
    }
}
pub mod system_config {
    use super::*;

    pub mod get {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
                #[schema(inline)]
                pub debug: bool,
                #[schema(inline)]
                pub app_name: compact_str::CompactString,
                #[schema(inline)]
                pub uuid: uuid::Uuid,
                #[schema(inline)]
                pub token_id: compact_str::CompactString,
                #[schema(inline)]
                pub token: compact_str::CompactString,
                #[schema(inline)]
                pub api: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200Api {
                    #[schema(inline)]
                    pub host: compact_str::CompactString,
                    #[schema(inline)]
                    pub port: u32,
                    #[schema(inline)]
                    pub ssl: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200ApiSsl {
                        #[schema(inline)]
                        pub enabled: bool,
                        #[schema(inline)]
                        pub cert: compact_str::CompactString,
                        #[schema(inline)]
                        pub key: compact_str::CompactString,
                    },

                    #[schema(inline)]
                    pub redirects: IndexMap<compact_str::CompactString, compact_str::CompactString>,
                    #[schema(inline)]
                    pub disable_openapi_docs: bool,
                    #[schema(inline)]
                    pub disable_remote_download: bool,
                    #[schema(inline)]
                    pub server_remote_download_limit: u64,
                    #[schema(inline)]
                    pub remote_download_blocked_cidrs: Vec<compact_str::CompactString>,
                    #[schema(inline)]
                    pub disable_directory_size: bool,
                    #[schema(inline)]
                    pub directory_entry_limit: u64,
                    #[schema(inline)]
                    pub send_offline_server_logs: bool,
                    #[schema(inline)]
                    pub file_search_threads: u64,
                    #[schema(inline)]
                    pub file_copy_threads: u64,
                    #[schema(inline)]
                    pub file_decompression_threads: u64,
                    #[schema(inline)]
                    pub file_compression_threads: u64,
                    #[schema(inline)]
                    pub upload_limit: u64,
                    #[schema(inline)]
                    pub max_jwt_uses: u64,
                    #[schema(inline)]
                    pub trusted_proxies: Vec<compact_str::CompactString>,
                },

                #[schema(inline)]
                pub system: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200System {
                    #[schema(inline)]
                    pub root_directory: compact_str::CompactString,
                    #[schema(inline)]
                    pub log_directory: compact_str::CompactString,
                    #[schema(inline)]
                    pub vmount_directory: compact_str::CompactString,
                    #[schema(inline)]
                    pub data: compact_str::CompactString,
                    #[schema(inline)]
                    pub archive_directory: compact_str::CompactString,
                    #[schema(inline)]
                    pub backup_directory: compact_str::CompactString,
                    #[schema(inline)]
                    pub tmp_directory: compact_str::CompactString,
                    #[schema(inline)]
                    pub username: compact_str::CompactString,
                    #[schema(inline)]
                    pub timezone: compact_str::CompactString,
                    #[schema(inline)]
                    pub user: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200SystemUser {
                        #[schema(inline)]
                        pub rootless: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200SystemUserRootless {
                            #[schema(inline)]
                            pub enabled: bool,
                            #[schema(inline)]
                            pub container_uid: u32,
                            #[schema(inline)]
                            pub container_gid: u32,
                        },

                        #[schema(inline)]
                        pub uid: u32,
                        #[schema(inline)]
                        pub gid: u32,
                    },

                    #[schema(inline)]
                    pub passwd: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200SystemPasswd {
                        #[schema(inline)]
                        pub enabled: bool,
                        #[schema(inline)]
                        pub directory: compact_str::CompactString,
                    },

                    #[schema(inline)]
                    pub disk_check_interval: u64,
                    #[schema(inline)]
                    pub disk_check_threads: u64,
                    #[schema(inline)]
                    pub disk_limiter_mode: DiskLimiterMode,
                    #[schema(inline)]
                    pub activity_send_interval: u64,
                    #[schema(inline)]
                    pub activity_send_count: u64,
                    #[schema(inline)]
                    pub check_permissions_on_boot: bool,
                    #[schema(inline)]
                    pub check_permissions_on_boot_threads: u64,
                    #[schema(inline)]
                    pub websocket_log_count: u64,
                    #[schema(inline)]
                    pub sftp: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200SystemSftp {
                        #[schema(inline)]
                        pub enabled: bool,
                        #[schema(inline)]
                        pub bind_address: compact_str::CompactString,
                        #[schema(inline)]
                        pub bind_port: u32,
                        #[schema(inline)]
                        pub read_only: bool,
                        #[schema(inline)]
                        pub key_algorithm: compact_str::CompactString,
                        #[schema(inline)]
                        pub disable_password_auth: bool,
                        #[schema(inline)]
                        pub directory_entry_limit: u64,
                        #[schema(inline)]
                        pub directory_entry_send_amount: u64,
                        #[schema(inline)]
                        pub limits: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200SystemSftpLimits {
                            #[schema(inline)]
                            pub authentication_password_attempts: u64,
                            #[schema(inline)]
                            pub authentication_pubkey_attempts: u64,
                            #[schema(inline)]
                            pub authentication_cooldown: u64,
                        },

                        #[schema(inline)]
                        pub shell: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200SystemSftpShell {
                            #[schema(inline)]
                            pub enabled: bool,
                            #[schema(inline)]
                            pub cli: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200SystemSftpShellCli {
                                #[schema(inline)]
                                pub name: compact_str::CompactString,
                            },

                        },

                        #[schema(inline)]
                        pub activity: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200SystemSftpActivity {
                            #[schema(inline)]
                            pub log_logins: bool,
                            #[schema(inline)]
                            pub log_file_reads: bool,
                        },

                    },

                    #[schema(inline)]
                    pub crash_detection: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200SystemCrashDetection {
                        #[schema(inline)]
                        pub enabled: bool,
                        #[schema(inline)]
                        pub detect_clean_exit_as_crash: bool,
                        #[schema(inline)]
                        pub timeout: u64,
                    },

                    #[schema(inline)]
                    pub backups: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200SystemBackups {
                        #[schema(inline)]
                        pub write_limit: u64,
                        #[schema(inline)]
                        pub read_limit: u64,
                        #[schema(inline)]
                        pub compression_level: CompressionLevel,
                        #[schema(inline)]
                        pub mounting: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200SystemBackupsMounting {
                            #[schema(inline)]
                            pub enabled: bool,
                            #[schema(inline)]
                            pub path: compact_str::CompactString,
                        },

                        #[schema(inline)]
                        pub wings: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200SystemBackupsWings {
                            #[schema(inline)]
                            pub create_threads: u64,
                            #[schema(inline)]
                            pub restore_threads: u64,
                            #[schema(inline)]
                            pub archive_format: ArchiveFormat,
                        },

                        #[schema(inline)]
                        pub s3: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200SystemBackupsS3 {
                            #[schema(inline)]
                            pub create_threads: u64,
                            #[schema(inline)]
                            pub part_upload_timeout: u64,
                            #[schema(inline)]
                            pub retry_limit: u64,
                        },

                        #[schema(inline)]
                        pub ddup_bak: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200SystemBackupsDdupBak {
                            #[schema(inline)]
                            pub create_threads: u64,
                            #[schema(inline)]
                            pub compression_format: SystemBackupsDdupBakCompressionFormat,
                        },

                        #[schema(inline)]
                        pub restic: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200SystemBackupsRestic {
                            #[schema(inline)]
                            pub repository: compact_str::CompactString,
                            #[schema(inline)]
                            pub password_file: compact_str::CompactString,
                            #[schema(inline)]
                            pub retry_lock_seconds: u64,
                            #[schema(inline)]
                            pub environment: IndexMap<compact_str::CompactString, compact_str::CompactString>,
                        },

                        #[schema(inline)]
                        pub btrfs: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200SystemBackupsBtrfs {
                            #[schema(inline)]
                            pub restore_threads: u64,
                            #[schema(inline)]
                            pub create_read_only: bool,
                        },

                        #[schema(inline)]
                        pub zfs: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200SystemBackupsZfs {
                            #[schema(inline)]
                            pub restore_threads: u64,
                        },

                    },

                    #[schema(inline)]
                    pub transfers: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200SystemTransfers {
                        #[schema(inline)]
                        pub download_limit: u64,
                    },

                },

                #[schema(inline)]
                pub docker: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200Docker {
                    #[schema(inline)]
                    pub socket: compact_str::CompactString,
                    #[schema(inline)]
                    pub server_name_in_container_name: bool,
                    #[schema(inline)]
                    pub delete_container_on_stop: bool,
                    #[schema(inline)]
                    pub network: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200DockerNetwork {
                        #[schema(inline)]
                        pub interface: compact_str::CompactString,
                        #[schema(inline)]
                        pub disable_interface_binding: bool,
                        #[schema(inline)]
                        pub dns: Vec<compact_str::CompactString>,
                        #[schema(inline)]
                        pub name: compact_str::CompactString,
                        #[schema(inline)]
                        pub ispn: bool,
                        #[schema(inline)]
                        pub driver: compact_str::CompactString,
                        #[schema(inline)]
                        pub mode: compact_str::CompactString,
                        #[schema(inline)]
                        pub is_internal: bool,
                        #[schema(inline)]
                        pub enable_icc: bool,
                        #[schema(inline)]
                        pub network_mtu: u64,
                        #[schema(inline)]
                        pub interfaces: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200DockerNetworkInterfaces {
                            #[schema(inline)]
                            pub v4: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200DockerNetworkInterfacesV4 {
                                #[schema(inline)]
                                pub subnet: compact_str::CompactString,
                                #[schema(inline)]
                                pub gateway: compact_str::CompactString,
                            },

                            #[schema(inline)]
                            pub v6: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200DockerNetworkInterfacesV6 {
                                #[schema(inline)]
                                pub subnet: compact_str::CompactString,
                                #[schema(inline)]
                                pub gateway: compact_str::CompactString,
                            },

                        },

                    },

                    #[schema(inline)]
                    pub domainname: compact_str::CompactString,
                    #[schema(inline)]
                    pub registries: IndexMap<compact_str::CompactString, serde_json::Value>,
                    #[schema(inline)]
                    pub tmpfs_size: u64,
                    #[schema(inline)]
                    pub container_pid_limit: u64,
                    #[schema(inline)]
                    pub installer_limits: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200DockerInstallerLimits {
                        #[schema(inline)]
                        pub timeout: u64,
                        #[schema(inline)]
                        pub memory: u64,
                        #[schema(inline)]
                        pub cpu: u64,
                    },

                    #[schema(inline)]
                    pub overhead: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200DockerOverhead {
                        #[schema(inline)]
                        pub r#override: bool,
                        #[schema(inline)]
                        pub default_multiplier: f64,
                        #[schema(inline)]
                        pub multipliers: IndexMap<compact_str::CompactString, f64>,
                    },

                    #[schema(inline)]
                    pub userns_mode: compact_str::CompactString,
                    #[schema(inline)]
                    pub log_config: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200DockerLogConfig {
                        #[schema(inline)]
                        pub r#type: compact_str::CompactString,
                        #[schema(inline)]
                        pub config: IndexMap<compact_str::CompactString, compact_str::CompactString>,
                    },

                },

                #[schema(inline)]
                pub throttles: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200Throttles {
                    #[schema(inline)]
                    pub enabled: bool,
                    #[schema(inline)]
                    pub lines: u64,
                    #[schema(inline)]
                    pub line_reset_interval: u64,
                },

                #[schema(inline)]
                pub remote: compact_str::CompactString,
                #[schema(inline)]
                pub remote_headers: IndexMap<compact_str::CompactString, compact_str::CompactString>,
                #[schema(inline)]
                pub remote_query: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200RemoteQuery {
                    #[schema(inline)]
                    pub timeout: u64,
                    #[schema(inline)]
                    pub boot_servers_per_page: u64,
                    #[schema(inline)]
                    pub retry_limit: u64,
                },

                #[schema(inline)]
                pub allowed_mounts: Vec<compact_str::CompactString>,
                #[schema(inline)]
                pub allowed_origins: Vec<compact_str::CompactString>,
                #[schema(inline)]
                pub allow_cors_private_network: bool,
                #[schema(inline)]
                pub ignore_panel_config_updates: bool,
            }
        }

        pub type Response = Response200;
    }
}
pub mod system_logs {
    use super::*;

    pub mod get {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
                #[schema(inline)]
                pub log_files: Vec<#[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200LogFiles {
                    #[schema(inline)]
                    pub name: compact_str::CompactString,
                    #[schema(inline)]
                    pub size: u64,
                    #[schema(inline)]
                    pub last_modified: chrono::DateTime<chrono::Utc>,
                }>,
            }
        }

        pub type Response = Response200;
    }
}
pub mod system_logs_file {
    use super::*;

    pub mod get {
        use super::*;

        pub type Response200 = String;

        pub type Response404 = ApiError;

        pub type Response = Response200;
    }
}
pub mod system_overview {
    use super::*;

    pub mod get {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
                #[schema(inline)]
                pub version: compact_str::CompactString,
                #[schema(inline)]
                pub container_type: AppContainerType,
                #[schema(inline)]
                pub cpu: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200Cpu {
                    #[schema(inline)]
                    pub name: compact_str::CompactString,
                    #[schema(inline)]
                    pub brand: compact_str::CompactString,
                    #[schema(inline)]
                    pub vendor_id: compact_str::CompactString,
                    #[schema(inline)]
                    pub frequency_mhz: u64,
                    #[schema(inline)]
                    pub cpu_count: u64,
                },

                #[schema(inline)]
                pub memory: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200Memory {
                    #[schema(inline)]
                    pub total_bytes: u64,
                    #[schema(inline)]
                    pub free_bytes: u64,
                    #[schema(inline)]
                    pub used_bytes: u64,
                },

                #[schema(inline)]
                pub servers: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200Servers {
                    #[schema(inline)]
                    pub total: u64,
                    #[schema(inline)]
                    pub online: u64,
                    #[schema(inline)]
                    pub offline: u64,
                },

                #[schema(inline)]
                pub architecture: compact_str::CompactString,
                #[schema(inline)]
                pub kernel_version: compact_str::CompactString,
            }
        }

        pub type Response = Response200;
    }
}
pub mod system_stats {
    use super::*;

    pub mod get {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
                #[schema(inline)]
                pub stats: SystemStats,
            }
        }

        pub type Response = Response200;
    }
}
pub mod system_upgrade {
    use super::*;

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub url: compact_str::CompactString,
                #[schema(inline)]
                pub headers: IndexMap<compact_str::CompactString, compact_str::CompactString>,
                #[schema(inline)]
                pub sha256: compact_str::CompactString,
                #[schema(inline)]
                pub restart_command: compact_str::CompactString,
                #[schema(inline)]
                pub restart_command_args: Vec<compact_str::CompactString>,
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response202 {
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response409 {
                #[schema(inline)]
                pub error: compact_str::CompactString,
            }
        }

        pub type Response = Response202;
    }
}
pub mod transfers {
    use super::*;

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
            }
        }

        pub type Response401 = ApiError;

        pub type Response409 = ApiError;

        pub type Response = Response200;
    }
}
pub mod transfers_files {
    use super::*;

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
            }
        }

        pub type Response401 = ApiError;

        pub type Response409 = ApiError;

        pub type Response = Response200;
    }
}
pub mod transfers_server {
    use super::*;

    pub mod delete {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
            }
        }

        pub type Response404 = ApiError;

        pub type Response = Response200;
    }
}
pub mod update {
    use super::*;

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub debug: Option<bool>,
                #[schema(inline)]
                pub app_name: Option<compact_str::CompactString>,
                #[schema(inline)]
                pub api: Option<#[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBodyApi {
                    #[schema(inline)]
                    pub host: Option<compact_str::CompactString>,
                    #[schema(inline)]
                    pub port: Option<u32>,
                    #[schema(inline)]
                    pub ssl: Option<#[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBodyApiSsl {
                        #[schema(inline)]
                        pub enabled: Option<bool>,
                        #[schema(inline)]
                        pub cert: Option<compact_str::CompactString>,
                        #[schema(inline)]
                        pub key: Option<compact_str::CompactString>,
                    }>,
                    #[schema(inline)]
                    pub upload_limit: Option<u64>,
                }>,
                #[schema(inline)]
                pub system: Option<#[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBodySystem {
                    #[schema(inline)]
                    pub sftp: Option<#[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBodySystemSftp {
                        #[schema(inline)]
                        pub bind_address: Option<compact_str::CompactString>,
                        #[schema(inline)]
                        pub bind_port: Option<u32>,
                    }>,
                }>,
                #[schema(inline)]
                pub allowed_origins: Option<Vec<compact_str::CompactString>>,
                #[schema(inline)]
                pub allow_cors_private_network: Option<bool>,
                #[schema(inline)]
                pub ignore_panel_config_updates: Option<bool>,
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
                #[schema(inline)]
                pub applied: bool,
            }
        }

        pub type Response = Response200;
    }
}
