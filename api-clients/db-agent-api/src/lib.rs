//! The Calagopus Panel DB Agent API library.
//!
//! Used for communicating with the DB Agent daemon. This library contains
//! auto-generated code from the OpenAPI specification as well as
//! some utilities for working with the DB Agent API. In 99% of cases you will
//! want to use the [crate::client::DbAgentClient] struct to interact with the API.

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

pub mod client;
mod extra;

use client::{AsyncRequestReader, AsyncResponseReader};
pub use extra::*;

nestify::nest! {
    #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct ApiError {
        #[schema(inline)]
        pub error: compact_str::CompactString,
    }
}

nestify::nest! {
    #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct ApiInstance {
        #[schema(inline)]
        pub uuid: uuid::Uuid,
        #[schema(inline)]
        pub uuid_short: i64,
        #[schema(inline)]
        pub database_type: DatabaseAgentType,
        #[schema(inline)]
        pub suspended: bool,
        #[schema(inline)]
        pub memory: i64,
        #[schema(inline)]
        pub swap: i64,
        #[schema(inline)]
        pub disk: i64,
        #[schema(inline)]
        pub io_weight: Option<i64>,
        #[schema(inline)]
        pub cpu: i64,
        #[schema(inline)]
        pub image: compact_str::CompactString,
        #[schema(inline)]
        pub image_uid: u32,
        #[schema(inline)]
        pub image_gid: u32,
        #[schema(inline)]
        pub volumes: IndexMap<compact_str::CompactString, compact_str::CompactString>,
        #[schema(inline)]
        pub socket_path: compact_str::CompactString,
        #[schema(inline)]
        pub timezone: Option<compact_str::CompactString>,
        #[schema(inline)]
        pub env: IndexMap<compact_str::CompactString, compact_str::CompactString>,
        #[schema(inline)]
        pub cmd: Option<Vec<compact_str::CompactString>>,
        #[schema(inline)]
        pub created: chrono::DateTime<chrono::Local>,
        #[schema(inline)]
        pub utilization: ResourceUsage,
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

nestify::nest! {
    #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Connections {
        #[schema(inline)]
        pub total: u64,
        #[schema(inline)]
        pub unique_databases: u64,
        #[schema(inline)]
        pub unique_users: u64,
    }
}

#[derive(Debug, ToSchema, Deserialize, Serialize, Clone, Copy)]
pub enum ContainerState {
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
pub enum DatabaseAgentType {
    #[serde(rename = "postgres")]
    Postgres,
    #[serde(rename = "mariadb")]
    Mariadb,
    #[serde(rename = "mongodb")]
    Mongodb,
    #[serde(rename = "redis")]
    Redis,
}

nestify::nest! {
    #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct DockerRegistry {
        #[schema(inline)]
        pub username: compact_str::CompactString,
        #[schema(inline)]
        pub password: compact_str::CompactString,
    }
}

#[derive(Debug, ToSchema, Deserialize, Serialize, Clone, Copy)]
pub enum PowerAction {
    #[serde(rename = "start")]
    Start,
    #[serde(rename = "stop")]
    Stop,
    #[serde(rename = "restart")]
    Restart,
    #[serde(rename = "kill")]
    Kill,
}

nestify::nest! {
    #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct QueryResult {
        #[schema(inline)]
        pub columns: Vec<compact_str::CompactString>,
        #[schema(inline)]
        pub rows: Vec<Vec<serde_json::Value>>,
        #[schema(inline)]
        pub rows_affected: u64,
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
        pub state: ContainerState,
        #[schema(inline)]
        pub cpu_absolute: f64,
        #[schema(inline)]
        pub uptime: u64,
    }
}

nestify::nest! {
    #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct StoredDatabase {
        #[schema(inline)]
        pub uuid: uuid::Uuid,
        #[schema(inline)]
        pub instance_uuid: uuid::Uuid,
        #[schema(inline)]
        pub name: compact_str::CompactString,
        #[schema(inline)]
        pub created: chrono::DateTime<chrono::Local>,
    }
}

nestify::nest! {
    #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct StoredInstance {
        #[schema(inline)]
        pub uuid: uuid::Uuid,
        #[schema(inline)]
        pub uuid_short: i64,
        #[schema(inline)]
        pub database_type: DatabaseAgentType,
        #[schema(inline)]
        pub suspended: bool,
        #[schema(inline)]
        pub memory: i64,
        #[schema(inline)]
        pub swap: i64,
        #[schema(inline)]
        pub disk: i64,
        #[schema(inline)]
        pub io_weight: Option<i64>,
        #[schema(inline)]
        pub cpu: i64,
        #[schema(inline)]
        pub image: compact_str::CompactString,
        #[schema(inline)]
        pub image_uid: u32,
        #[schema(inline)]
        pub image_gid: u32,
        #[schema(inline)]
        pub volumes: IndexMap<compact_str::CompactString, compact_str::CompactString>,
        #[schema(inline)]
        pub socket_path: compact_str::CompactString,
        #[schema(inline)]
        pub timezone: Option<compact_str::CompactString>,
        #[schema(inline)]
        pub env: IndexMap<compact_str::CompactString, compact_str::CompactString>,
        #[schema(inline)]
        pub cmd: Option<Vec<compact_str::CompactString>>,
        #[schema(inline)]
        pub created: chrono::DateTime<chrono::Local>,
    }
}

nestify::nest! {
    #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct StoredUser {
        #[schema(inline)]
        pub uuid: uuid::Uuid,
        #[schema(inline)]
        pub uuid_short: i64,
        #[schema(inline)]
        pub instance_uuid: uuid::Uuid,
        #[schema(inline)]
        pub database_uuid: Option<uuid::Uuid>,
        #[schema(inline)]
        pub username: compact_str::CompactString,
        #[schema(inline)]
        pub password: compact_str::CompactString,
        #[schema(inline)]
        pub created: chrono::DateTime<chrono::Local>,
    }
}

nestify::nest! {
    #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct SubsystemStatus {
        #[schema(inline)]
        pub running: bool,
        #[schema(inline)]
        pub connections: Connections,
    }
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
            pub received_packets: u64,
            #[schema(inline)]
            pub receiving_rate: f64,
            #[schema(inline)]
            pub received_packets_rate: f64,
            #[schema(inline)]
            pub sent: u64,
            #[schema(inline)]
            pub sent_packets: u64,
            #[schema(inline)]
            pub sending_rate: f64,
            #[schema(inline)]
            pub sending_packets_rate: f64,
        },

        #[schema(inline)]
        pub memory: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct SystemStatsMemory {
            #[schema(inline)]
            pub used: u64,
            #[schema(inline)]
            pub used_process: u64,
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

nestify::nest! {
    #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Tls {
        #[schema(inline)]
        pub enabled: bool,
        #[schema(inline)]
        pub cert: compact_str::CompactString,
        #[schema(inline)]
        pub key: compact_str::CompactString,
    }
}

pub type VolumeMapping = IndexMap<compact_str::CompactString, compact_str::CompactString>;
pub mod instances {
    use super::*;

    pub mod get {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
                #[schema(inline)]
                pub instances: Vec<ApiInstance>,
            }
        }

        pub type Response = Response200;
    }

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub database_type: DatabaseAgentType,
                #[schema(inline)]
                pub suspended: bool,
                #[schema(inline)]
                pub memory: i64,
                #[schema(inline)]
                pub swap: i64,
                #[schema(inline)]
                pub disk: i64,
                #[schema(inline)]
                pub io_weight: Option<i64>,
                #[schema(inline)]
                pub cpu: i64,
                #[schema(inline)]
                pub image: compact_str::CompactString,
                #[schema(inline)]
                pub image_uid: u32,
                #[schema(inline)]
                pub image_gid: u32,
                #[schema(inline)]
                pub volumes: IndexMap<compact_str::CompactString, compact_str::CompactString>,
                #[schema(inline)]
                pub socket_path: compact_str::CompactString,
                #[schema(inline)]
                pub timezone: Option<compact_str::CompactString>,
                #[schema(inline)]
                pub env: IndexMap<compact_str::CompactString, compact_str::CompactString>,
                #[schema(inline)]
                pub cmd: Option<Vec<compact_str::CompactString>>,
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
                #[schema(inline)]
                pub instance: ApiInstance,
            }
        }

        pub type Response = Response200;
    }
}
pub mod instances_utilization {
    use super::*;

    pub mod get {
        use super::*;

        pub type Response200 = IndexMap<uuid::Uuid, ResourceUsage>;
        pub type Response = Response200;
    }
}
pub mod instances_instance {
    use super::*;

    pub mod get {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
                #[schema(inline)]
                pub instance: ApiInstance,
            }
        }

        pub type Response404 = ApiError;

        pub type Response = Response200;
    }

    pub mod delete {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
            }
        }

        pub type Response404 = ApiError;

        pub type Response = Response200;
    }

    pub mod patch {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub suspended: Option<bool>,
                #[schema(inline)]
                pub memory: Option<i64>,
                #[schema(inline)]
                pub swap: Option<i64>,
                #[schema(inline)]
                pub disk: Option<i64>,
                #[schema(inline)]
                pub io_weight: Option<i64>,
                #[schema(inline)]
                pub cpu: Option<i64>,
                #[schema(inline)]
                pub image: Option<compact_str::CompactString>,
                #[schema(inline)]
                pub image_uid: Option<u32>,
                #[schema(inline)]
                pub image_gid: Option<u32>,
                #[schema(inline)]
                pub volumes: Option<IndexMap<compact_str::CompactString, compact_str::CompactString>>,
                #[schema(inline)]
                pub socket_path: Option<compact_str::CompactString>,
                #[schema(inline)]
                pub timezone: Option<compact_str::CompactString>,
                #[schema(inline)]
                pub env: Option<IndexMap<compact_str::CompactString, compact_str::CompactString>>,
                #[schema(inline)]
                pub cmd: Option<Vec<compact_str::CompactString>>,
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
pub mod instances_instance_databases {
    use super::*;

    pub mod get {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
                #[schema(inline)]
                pub databases: Vec<StoredDatabase>,
            }
        }

        pub type Response404 = ApiError;

        pub type Response = Response200;
    }

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub name: compact_str::CompactString,
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
                #[schema(inline)]
                pub database: StoredDatabase,
            }
        }

        pub type Response400 = ApiError;

        pub type Response404 = ApiError;

        pub type Response = Response200;
    }
}
pub mod instances_instance_databases_database {
    use super::*;

    pub mod get {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
                #[schema(inline)]
                pub database: StoredDatabase,
            }
        }

        pub type Response404 = ApiError;

        pub type Response = Response200;
    }

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
pub mod instances_instance_databases_database_size {
    use super::*;

    pub mod get {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
                #[schema(inline)]
                pub size: i64,
            }
        }

        pub type Response404 = ApiError;

        pub type Response = Response200;
    }
}
pub mod instances_instance_export {
    use super::*;

    pub mod get {
        use super::*;

        pub type Response200 = AsyncResponseReader;

        pub type Response400 = ApiError;

        pub type Response404 = ApiError;

        pub type Response = Response200;

        #[derive(Debug, Clone, Default)]
        #[allow(clippy::manual_non_exhaustive)]
        pub struct Query {
            pub db: Option<compact_str::CompactString>,
            #[doc(hidden)]
            pub __priv: (),
        }
    }
}
pub mod instances_instance_import {
    use super::*;

    pub mod post {
        use super::*;

        pub type RequestBody = AsyncRequestReader;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
            }
        }

        pub type Response400 = ApiError;

        pub type Response404 = ApiError;

        pub type Response = Response200;

        #[derive(Debug, Clone, Default)]
        #[allow(clippy::manual_non_exhaustive)]
        pub struct Query {
            pub db: Option<compact_str::CompactString>,
            pub wipe: Option<bool>,
            #[doc(hidden)]
            pub __priv: (),
        }
    }
}
pub mod instances_instance_logs {
    use super::*;

    pub mod get {
        use super::*;

        pub type Response200 = AsyncResponseReader;

        pub type Response404 = ApiError;

        pub type Response = Response200;

        #[derive(Debug, Clone, Default)]
        #[allow(clippy::manual_non_exhaustive)]
        pub struct Query {
            pub lines: Option<u64>,
            #[doc(hidden)]
            pub __priv: (),
        }
    }
}
pub mod instances_instance_power {
    use super::*;

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub action: PowerAction,
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
pub mod instances_instance_query {
    use super::*;

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub db: Option<compact_str::CompactString>,
                #[schema(inline)]
                pub query: compact_str::CompactString,
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
                #[schema(inline)]
                pub result: QueryResult,
            }
        }

        pub type Response400 = ApiError;

        pub type Response404 = ApiError;

        pub type Response = Response200;
    }
}
pub mod instances_instance_users {
    use super::*;

    pub mod get {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
                #[schema(inline)]
                pub users: Vec<StoredUser>,
            }
        }

        pub type Response404 = ApiError;

        pub type Response = Response200;
    }

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct RequestBody {
                #[schema(inline)]
                pub username: compact_str::CompactString,
                #[schema(inline)]
                pub database_uuid: Option<uuid::Uuid>,
            }
        }

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
                #[schema(inline)]
                pub user: StoredUser,
                #[schema(inline)]
                pub username: compact_str::CompactString,
            }
        }

        pub type Response400 = ApiError;

        pub type Response404 = ApiError;

        pub type Response = Response200;
    }
}
pub mod instances_instance_users_user {
    use super::*;

    pub mod get {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
                #[schema(inline)]
                pub user: StoredUser,
            }
        }

        pub type Response404 = ApiError;

        pub type Response = Response200;
    }

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
pub mod instances_instance_users_user_rotate_password {
    use super::*;

    pub mod post {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
                #[schema(inline)]
                pub password: compact_str::CompactString,
            }
        }

        pub type Response404 = ApiError;

        pub type Response = Response200;
    }
}
pub mod instances_instance_utilization {
    use super::*;

    pub mod get {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
                #[schema(inline)]
                pub utilization: ResourceUsage,
            }
        }

        pub type Response404 = ApiError;

        pub type Response = Response200;
    }
}
pub mod status {
    use super::*;

    pub mod get {
        use super::*;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
                #[schema(inline)]
                pub postgres: SubsystemStatus,
                #[schema(inline)]
                pub mariadb: SubsystemStatus,
                #[schema(inline)]
                pub mongodb: SubsystemStatus,
                #[schema(inline)]
                pub redis: SubsystemStatus,
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
                pub socket_dir: compact_str::CompactString,
                #[schema(inline)]
                pub data_dir: compact_str::CompactString,
                #[schema(inline)]
                pub log_dir: compact_str::CompactString,
                #[schema(inline)]
                pub ignore_config_updates: bool,
                #[schema(inline)]
                pub disk_check_interval: u64,
                #[schema(inline)]
                pub disk_check_concurrency: u64,
                #[schema(inline)]
                pub postgres: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200Postgres {
                    #[schema(inline)]
                    pub enabled: bool,
                    #[schema(inline)]
                    pub bind: compact_str::CompactString,
                    #[schema(inline)]
                    pub tls: Tls,
                },

                #[schema(inline)]
                pub mariadb: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200Mariadb {
                    #[schema(inline)]
                    pub enabled: bool,
                    #[schema(inline)]
                    pub bind: compact_str::CompactString,
                    #[schema(inline)]
                    pub tls: Tls,
                },

                #[schema(inline)]
                pub mongodb: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200Mongodb {
                    #[schema(inline)]
                    pub enabled: bool,
                    #[schema(inline)]
                    pub bind: compact_str::CompactString,
                    #[schema(inline)]
                    pub tls: Tls,
                },

                #[schema(inline)]
                pub redis: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200Redis {
                    #[schema(inline)]
                    pub enabled: bool,
                    #[schema(inline)]
                    pub bind: compact_str::CompactString,
                    #[schema(inline)]
                    pub tls: Tls,
                },

                #[schema(inline)]
                pub database: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200Database {
                    #[schema(inline)]
                    pub url: compact_str::CompactString,
                    #[schema(inline)]
                    pub migrate: bool,
                },

                #[schema(inline)]
                pub docker: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200Docker {
                    #[schema(inline)]
                    pub socket: compact_str::CompactString,
                    #[schema(inline)]
                    pub registries: IndexMap<compact_str::CompactString, DockerRegistry>,
                    #[schema(inline)]
                    pub tmpfs_size: u64,
                    #[schema(inline)]
                    pub container_pid_limit: i64,
                    #[schema(inline)]
                    pub timezone: compact_str::CompactString,
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
                pub api: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200Api {
                    #[schema(inline)]
                    pub bind: compact_str::CompactString,
                    #[schema(inline)]
                    pub token: compact_str::CompactString,
                    #[schema(inline)]
                    pub disable_openapi_docs: bool,
                    #[schema(inline)]
                    pub ignore_upgrades: bool,
                    #[schema(inline)]
                    pub tls: Tls,
                    #[schema(inline)]
                    pub trusted_proxies: Vec<compact_str::CompactString>,
                },

            }
        }

        pub type Response = Response200;
    }

    pub mod patch {
        use super::*;

        pub type RequestBody = serde_json::Value;

        nestify::nest! {
            #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200 {
                #[schema(inline)]
                pub applied: bool,
            }
        }

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
                pub local_time: chrono::DateTime<chrono::Local>,
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
                    #[schema(inline)]
                    pub used_bytes_process: u64,
                },

                #[schema(inline)]
                pub instances: #[derive(Debug, ToSchema, Deserialize, Serialize, Clone)] pub struct Response200Instances {
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
                #[schema(inline)]
                pub applied: bool,
            }
        }

        pub type Response409 = ApiError;

        pub type Response = Response202;
    }
}
