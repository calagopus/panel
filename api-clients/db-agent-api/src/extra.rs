use super::DatabaseAgentType;

pub type Config = super::system_config::get::Response200;

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

    /// The default network port each database type listens on, used to fill in
    /// connection info when a host has no explicit public port configured.
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

const FORBIDDEN_CONFIG_PATHS: &[&str] = &["api.token"];

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

            match map.get_mut(part) {
                Some(next) => cursor = next,
                None => break,
            }
        }
    }
}
