use super::DatabaseAgentType;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

pub type Config = super::system_config::get::Response200;

#[derive(Debug, ToSchema, Deserialize, Serialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum QueryValue {
    Null,
    Text { value: String, truncated: bool },
    Binary { value: String, truncated: bool },
}

#[derive(Debug, ToSchema, Deserialize, Serialize, Clone, Copy, PartialEq, Eq)]
pub enum WebsocketEvent {
    #[serde(rename = "send stats")]
    SendStats,
    #[serde(rename = "send status")]
    SendStatus,
    #[serde(rename = "send logs")]
    SendLogs,
    #[serde(rename = "set state")]
    SetState,

    #[serde(rename = "stats")]
    InstanceStats,
    #[serde(rename = "status")]
    InstanceStatus,
    #[serde(rename = "console output")]
    InstanceConsoleOutput,
    #[serde(rename = "image pull progress")]
    InstanceImagePullProgress,
    #[serde(rename = "image pull completed")]
    InstanceImagePullCompleted,
    #[serde(rename = "daemon error")]
    InstanceDaemonError,
    #[serde(rename = "daemon message")]
    InstanceDaemonMessage,

    #[serde(rename = "operation progress")]
    OperationProgress,
    #[serde(rename = "operation completed")]
    OperationCompleted,
    #[serde(rename = "operation error")]
    OperationError,
    #[serde(rename = "operation aborted")]
    OperationAborted,
}

#[derive(Debug, ToSchema, Deserialize, Serialize, Clone)]
pub struct WebsocketMessage {
    pub event: WebsocketEvent,
    #[serde(default)]
    pub args: Vec<compact_str::CompactString>,
}

impl WebsocketMessage {
    #[inline]
    pub fn builder(event: WebsocketEvent) -> WebsocketMessageBuilder {
        WebsocketMessageBuilder::new(event)
    }
}

pub struct WebsocketMessageBuilder {
    event: WebsocketEvent,
    args: Vec<compact_str::CompactString>,
}

impl WebsocketMessageBuilder {
    pub fn new(event: WebsocketEvent) -> Self {
        Self {
            event,
            args: Vec::new(),
        }
    }

    pub fn arg(mut self, arg: impl Into<compact_str::CompactString>) -> Self {
        self.args.push(arg.into());
        self
    }

    pub fn build(self) -> WebsocketMessage {
        WebsocketMessage {
            event: self.event,
            args: self.args,
        }
    }
}

impl DatabaseAgentType {
    #[inline]
    pub const fn as_str(self) -> &'static str {
        match self {
            DatabaseAgentType::Postgres => "postgres",
            DatabaseAgentType::Mariadb => "mariadb",
            DatabaseAgentType::Mongodb => "mongodb",
            DatabaseAgentType::Redis => "redis",
        }
    }

    #[inline]
    pub const fn dump_extension(self) -> &'static str {
        match self {
            DatabaseAgentType::Postgres => "sql",
            DatabaseAgentType::Mariadb => "sql",
            DatabaseAgentType::Mongodb => "archive",
            DatabaseAgentType::Redis => "rdb",
        }
    }

    #[inline]
    pub const fn default_port(self) -> u16 {
        match self {
            DatabaseAgentType::Postgres => 5432,
            DatabaseAgentType::Mariadb => 3306,
            DatabaseAgentType::Mongodb => 27017,
            DatabaseAgentType::Redis => 6379,
        }
    }

    #[inline]
    const fn as_pg_str(self) -> &'static str {
        match self {
            DatabaseAgentType::Postgres => "POSTGRES",
            DatabaseAgentType::Mariadb => "MARIADB",
            DatabaseAgentType::Mongodb => "MONGODB",
            DatabaseAgentType::Redis => "REDIS",
        }
    }
}

impl PartialEq for DatabaseAgentType {
    #[inline]
    fn eq(&self, other: &Self) -> bool {
        std::mem::discriminant(self) == std::mem::discriminant(other)
    }
}

impl Eq for DatabaseAgentType {}

impl sqlx::Type<sqlx::Postgres> for DatabaseAgentType {
    fn type_info() -> sqlx::postgres::PgTypeInfo {
        sqlx::postgres::PgTypeInfo::with_name("database_agent_type")
    }
}

impl sqlx::postgres::PgHasArrayType for DatabaseAgentType {
    fn array_type_info() -> sqlx::postgres::PgTypeInfo {
        sqlx::postgres::PgTypeInfo::with_name("_database_agent_type")
    }
}

impl sqlx::Encode<'_, sqlx::Postgres> for DatabaseAgentType {
    fn encode_by_ref(
        &self,
        buf: &mut sqlx::postgres::PgArgumentBuffer,
    ) -> Result<sqlx::encode::IsNull, sqlx::error::BoxDynError> {
        <&str as sqlx::Encode<sqlx::Postgres>>::encode(self.as_pg_str(), buf)
    }
}

impl<'r> sqlx::Decode<'r, sqlx::Postgres> for DatabaseAgentType {
    fn decode(value: sqlx::postgres::PgValueRef<'r>) -> Result<Self, sqlx::error::BoxDynError> {
        Ok(
            match <&str as sqlx::Decode<sqlx::Postgres>>::decode(value)? {
                "POSTGRES" => DatabaseAgentType::Postgres,
                "MARIADB" => DatabaseAgentType::Mariadb,
                "MONGODB" => DatabaseAgentType::Mongodb,
                "REDIS" => DatabaseAgentType::Redis,
                other => return Err(format!("invalid database_agent_type: {other}").into()),
            },
        )
    }
}

// mirrors db-agent config::FORBIDDEN_PATHS
const FORBIDDEN_CONFIG_PATHS: &[&str] = &[
    "ignore_config_updates",
    "ignore_upgrades",
    "socket_dir",
    "data_dir",
    "log_dir",
    "docker.socket",
    "api.token",
    "api.bind",
    "api.tls",
    "api.trusted_proxies",
    "api.disable_remote_import",
    "api.remote_import_blocked_cidrs",
];

pub fn strip_config_paths(value: &mut serde_json::Value) {
    for path in FORBIDDEN_CONFIG_PATHS {
        let mut cursor = &mut *value;
        let mut parts = path.split('.').peekable();

        while let Some(part) = parts.next() {
            let serde_json::Value::Object(map) = cursor else {
                break;
            };

            if parts.peek().is_none() {
                map.remove(part);
                break;
            }

            if map.get(part).is_some_and(|next| !next.is_object()) {
                map.remove(part);
                break;
            }

            match map.get_mut(part) {
                Some(next) => cursor = next,
                None => break,
            }
        }
    }
}
