use crate::{
    models::{InsertQueryBuilder, UpdateQueryBuilder},
    prelude::*,
};
use garde::Validate;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow, prelude::Type};
use std::{
    collections::{BTreeMap, HashMap},
    hash::Hash,
    str::FromStr,
    sync::{Arc, LazyLock},
};
use tokio::sync::Mutex;
use utoipa::ToSchema;

pub enum DatabaseTransaction<'a> {
    Mysql(sqlx::Transaction<'a, sqlx::MySql>),
    Postgres(
        sqlx::Transaction<'a, sqlx::Postgres>,
        sqlx::Pool<sqlx::Postgres>,
    ),
    Mongodb(mongodb::Client),
}

#[derive(Clone)]
pub enum DatabasePool {
    Mysql(sqlx::Pool<sqlx::MySql>),
    Postgres(sqlx::Pool<sqlx::Postgres>),
    Mongodb(mongodb::Client),
}

type DatabasePoolValue = (std::time::Instant, DatabasePool);
static DATABASE_CLIENTS: LazyLock<Arc<Mutex<HashMap<uuid::Uuid, DatabasePoolValue>>>> =
    LazyLock::new(|| {
        let clients = Arc::new(Mutex::new(HashMap::<uuid::Uuid, DatabasePoolValue>::new()));

        tokio::spawn({
            let clients = Arc::clone(&clients);
            async move {
                loop {
                    tokio::time::sleep(std::time::Duration::from_mins(1)).await;

                    let mut clients = clients.lock().await;
                    let before_len = clients.len();
                    clients.retain(|_, &mut (last_used, _)| {
                        last_used.elapsed() < std::time::Duration::from_mins(5)
                    });

                    if clients.len() != before_len {
                        tracing::info!(
                            "cleaned up {} idle database connections",
                            before_len - clients.len()
                        );
                    }
                }
            }
        });

        clients
    });

#[derive(ToSchema, Serialize, Deserialize, Type, PartialEq, Eq, Hash, Clone, Copy)]
#[serde(rename_all = "snake_case")]
#[sqlx(type_name = "database_type", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DatabaseType {
    Mysql,
    Postgres,
    Mongodb,
}

impl DatabaseType {
    pub fn from_url_scheme(scheme: &str) -> Result<Self, anyhow::Error> {
        match scheme {
            "mysql" | "mariadb" => Ok(Self::Mysql),
            "postgres" | "postgresql" => Ok(Self::Postgres),
            "mongodb" => Ok(Self::Mongodb),
            _ => Err(anyhow::anyhow!("Unsupported database type: {}", scheme)),
        }
    }

    pub const fn default_port(self) -> u16 {
        match self {
            DatabaseType::Mysql => 3306,
            DatabaseType::Postgres => 5432,
            DatabaseType::Mongodb => 27017,
        }
    }
}

fn validate_connection_string(connection_string: &str, _context: &()) -> Result<(), garde::Error> {
    if connection_string.trim().is_empty() {
        return Err(garde::Error::new("connection string cannot be empty"));
    }

    let url = reqwest::Url::parse(connection_string)
        .map_err(|err| garde::Error::new(format!("Invalid connection string: {err}")))?;

    DatabaseType::from_url_scheme(url.scheme())
        .map_err(|err| garde::Error::new(format!("Invalid connection string: {err}")))?;

    Ok(())
}

#[derive(ToSchema, Validate, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DatabaseCredentials {
    ConnectionString {
        #[garde(length(chars, min = 1, max = 255), custom(validate_connection_string))]
        #[schema(min_length = 1, max_length = 255)]
        connection_string: compact_str::CompactString,
    },
    Details {
        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        host: compact_str::CompactString,
        #[garde(range(min = 1))]
        #[schema(minimum = 1)]
        port: u16,
        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        username: compact_str::CompactString,
        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        password: compact_str::CompactString,
    },
}

#[derive(ToSchema, Serialize)]
pub struct ParsedConnectionDetails {
    pub host: compact_str::CompactString,
    pub port: u16,
    pub username: compact_str::CompactString,
}

impl DatabaseCredentials {
    pub async fn encrypt(
        &mut self,
        database: &crate::database::Database,
    ) -> Result<(), anyhow::Error> {
        match self {
            DatabaseCredentials::ConnectionString { connection_string } => {
                *connection_string = database.encrypt_base64(connection_string.clone()).await?;
            }
            DatabaseCredentials::Details { password, .. } => {
                *password = database.encrypt_base64(password.clone()).await?;
            }
        }

        Ok(())
    }

    pub async fn decrypt(
        &mut self,
        database: &crate::database::Database,
    ) -> Result<(), anyhow::Error> {
        match self {
            DatabaseCredentials::ConnectionString { connection_string } => {
                if let Some(decrypted) =
                    database.decrypt_base64_optional(&connection_string).await?
                {
                    *connection_string = decrypted;
                }
            }
            DatabaseCredentials::Details { password, .. } => {
                if let Some(decrypted) = database.decrypt_base64_optional(&password).await? {
                    *password = decrypted;
                }
            }
        }

        Ok(())
    }

    pub fn censor(&mut self) {
        match self {
            DatabaseCredentials::ConnectionString { connection_string } => {
                *connection_string = "".into();
            }
            DatabaseCredentials::Details { password, .. } => {
                *password = "".into();
            }
        }
    }

    pub async fn parse_connection_details(
        &self,
        database: &crate::database::Database,
    ) -> Result<ParsedConnectionDetails, anyhow::Error> {
        match self {
            DatabaseCredentials::ConnectionString { connection_string } => {
                let connection_string = database.decrypt_base64(connection_string).await?;
                let url = reqwest::Url::parse(connection_string.as_str())?;
                let database_type = DatabaseType::from_url_scheme(url.scheme())?;

                let host = url
                    .host_str()
                    .ok_or_else(|| anyhow::anyhow!("Invalid host"))?
                    .into();
                let port = url.port().unwrap_or_else(|| database_type.default_port());
                let username = url.username().into();

                Ok(ParsedConnectionDetails {
                    host,
                    port,
                    username,
                })
            }
            DatabaseCredentials::Details {
                host,
                port,
                username,
                ..
            } => Ok(ParsedConnectionDetails {
                host: host.clone(),
                port: *port,
                username: username.clone(),
            }),
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DatabaseHost {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub r#type: DatabaseType,

    pub deployment_enabled: bool,
    pub maintenance_enabled: bool,

    pub public_host: Option<compact_str::CompactString>,
    pub public_port: Option<i32>,

    pub credentials: DatabaseCredentials,

    pub created: chrono::NaiveDateTime,
}

impl BaseModel for DatabaseHost {
    const NAME: &'static str = "database_host";

    #[inline]
    fn columns(prefix: Option<&str>) -> BTreeMap<&'static str, compact_str::CompactString> {
        let prefix = prefix.unwrap_or_default();

        BTreeMap::from([
            (
                "database_hosts.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "database_hosts.name",
                compact_str::format_compact!("{prefix}name"),
            ),
            (
                "database_hosts.type",
                compact_str::format_compact!("{prefix}type"),
            ),
            (
                "database_hosts.deployment_enabled",
                compact_str::format_compact!("{prefix}deployment_enabled"),
            ),
            (
                "database_hosts.maintenance_enabled",
                compact_str::format_compact!("{prefix}maintenance_enabled"),
            ),
            (
                "database_hosts.public_host",
                compact_str::format_compact!("{prefix}public_host"),
            ),
            (
                "database_hosts.public_port",
                compact_str::format_compact!("{prefix}public_port"),
            ),
            (
                "database_hosts.credentials",
                compact_str::format_compact!("{prefix}credentials"),
            ),
            (
                "database_hosts.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ])
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            uuid: row.try_get(compact_str::format_compact!("{prefix}uuid").as_str())?,
            name: row.try_get(compact_str::format_compact!("{prefix}name").as_str())?,
            r#type: row.try_get(compact_str::format_compact!("{prefix}type").as_str())?,
            deployment_enabled: row
                .try_get(compact_str::format_compact!("{prefix}deployment_enabled").as_str())?,
            maintenance_enabled: row
                .try_get(compact_str::format_compact!("{prefix}maintenance_enabled").as_str())?,
            public_host: row
                .try_get(compact_str::format_compact!("{prefix}public_host").as_str())?,
            public_port: row
                .try_get(compact_str::format_compact!("{prefix}public_port").as_str())?,
            credentials: serde_json::from_value(
                row.try_get(compact_str::format_compact!("{prefix}credentials").as_str())?,
            )?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
        })
    }
}

impl DatabaseHost {
    pub async fn get_connection(
        &mut self,
        database: &crate::database::Database,
    ) -> Result<DatabasePool, crate::database::DatabaseError> {
        let mut clients = DATABASE_CLIENTS.lock().await;

        if let Some((last_used, pool)) = clients.get_mut(&self.uuid) {
            *last_used = std::time::Instant::now();

            return Ok(pool.clone());
        }

        drop(clients);

        self.credentials.decrypt(database).await?;

        let pool = match self.r#type {
            DatabaseType::Mysql => {
                let options = match &self.credentials {
                    DatabaseCredentials::ConnectionString { connection_string } => {
                        sqlx::mysql::MySqlConnectOptions::from_str(connection_string).map_err(
                            |err| anyhow::anyhow!("failed to parse MySQL connection string: {err}"),
                        )?
                    }
                    DatabaseCredentials::Details {
                        host,
                        port,
                        username,
                        password,
                    } => sqlx::mysql::MySqlConnectOptions::new()
                        .host(host)
                        .port(*port)
                        .username(username)
                        .password(password),
                };

                let pool = sqlx::Pool::connect_with(options).await?;
                DatabasePool::Mysql(pool)
            }
            DatabaseType::Postgres => {
                let options = match &self.credentials {
                    DatabaseCredentials::ConnectionString { connection_string } => {
                        sqlx::postgres::PgConnectOptions::from_str(connection_string).map_err(
                            |err| {
                                anyhow::anyhow!("failed to parse Postgres connection string: {err}")
                            },
                        )?
                    }
                    DatabaseCredentials::Details {
                        host,
                        port,
                        username,
                        password,
                    } => sqlx::postgres::PgConnectOptions::new()
                        .host(host)
                        .port(*port)
                        .username(username)
                        .password(password)
                        .database("postgres"),
                };

                let pool = sqlx::Pool::connect_with(options).await?;
                DatabasePool::Postgres(pool)
            }
            DatabaseType::Mongodb => {
                let options = match &self.credentials {
                    DatabaseCredentials::ConnectionString { connection_string } => {
                        mongodb::options::ClientOptions::parse(connection_string.as_str())
                            .await
                            .map_err(|err| {
                                anyhow::anyhow!("failed to parse MongoDB connection string: {err}")
                            })?
                    }
                    DatabaseCredentials::Details {
                        host,
                        port,
                        username,
                        password,
                    } => {
                        let mut options = mongodb::options::ClientOptions::default();
                        options.hosts.push(mongodb::options::ServerAddress::Tcp {
                            host: host.to_string(),
                            port: Some(*port),
                        });
                        options.credential = Some(
                            mongodb::options::Credential::builder()
                                .username(username.to_string())
                                .password(password.to_string())
                                .build(),
                        );
                        options
                    }
                };

                let client = mongodb::Client::with_options(options)?;
                DatabasePool::Mongodb(client)
            }
        };

        DATABASE_CLIENTS
            .lock()
            .await
            .insert(self.uuid, (std::time::Instant::now(), pool.clone()));
        Ok(pool)
    }

    pub async fn all_with_pagination(
        database: &crate::database::Database,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(&format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM database_hosts
            WHERE ($1 IS NULL OR database_hosts.name ILIKE '%' || $1 || '%')
            ORDER BY database_hosts.created
            LIMIT $2 OFFSET $3
            "#,
            Self::columns_sql(None)
        ))
        .bind(search)
        .bind(per_page)
        .bind(offset)
        .fetch_all(database.read())
        .await?;

        Ok(super::Pagination {
            total: rows
                .first()
                .map_or(Ok(0), |row| row.try_get("total_count"))?,
            per_page,
            page,
            data: rows
                .into_iter()
                .map(|row| Self::map(None, &row))
                .try_collect_vec()?,
        })
    }

    pub async fn by_location_uuid_uuid(
        database: &crate::database::Database,
        location_uuid: uuid::Uuid,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM database_hosts
            JOIN location_database_hosts ON location_database_hosts.database_host_uuid = database_hosts.uuid AND location_database_hosts.location_uuid = $1
            WHERE database_hosts.uuid = $2
            "#,
            Self::columns_sql(None)
        ))
        .bind(location_uuid)
        .bind(uuid)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    #[inline]
    pub fn into_admin_api_object(mut self) -> AdminApiDatabaseHost {
        self.credentials.censor();

        AdminApiDatabaseHost {
            uuid: self.uuid,
            name: self.name,
            r#type: self.r#type,
            deployment_enabled: self.deployment_enabled,
            maintenance_enabled: self.maintenance_enabled,
            public_host: self.public_host,
            public_port: self.public_port,
            credentials: self.credentials,
            created: self.created.and_utc(),
        }
    }

    #[inline]
    pub async fn into_api_object(
        self,
        database: &crate::database::Database,
    ) -> Result<ApiDatabaseHost, anyhow::Error> {
        let details = self.credentials.parse_connection_details(database).await?;

        Ok(ApiDatabaseHost {
            uuid: self.uuid,
            name: self.name,
            maintenance_enabled: self.maintenance_enabled,
            r#type: self.r#type,
            host: self.public_host.unwrap_or(details.host),
            port: self.public_port.unwrap_or(details.port as i32),
        })
    }
}

#[async_trait::async_trait]
impl ByUuid for DatabaseHost {
    async fn by_uuid(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
    ) -> Result<Self, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM database_hosts
            WHERE database_hosts.uuid = $1
            "#,
            Self::columns_sql(None)
        ))
        .bind(uuid)
        .fetch_one(database.read())
        .await?;

        Self::map(None, &row)
    }
}

#[derive(ToSchema, Deserialize, Validate)]
pub struct CreateDatabaseHostOptions {
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: compact_str::CompactString,
    #[garde(skip)]
    pub r#type: DatabaseType,

    #[garde(skip)]
    pub deployment_enabled: bool,
    #[garde(skip)]
    pub maintenance_enabled: bool,

    #[garde(length(chars, min = 3, max = 255))]
    #[schema(min_length = 3, max_length = 255)]
    pub public_host: Option<compact_str::CompactString>,
    #[garde(range(min = 1))]
    #[schema(minimum = 1)]
    pub public_port: Option<u16>,

    #[garde(dive)]
    pub credentials: DatabaseCredentials,
}

#[async_trait::async_trait]
impl CreatableModel for DatabaseHost {
    type CreateOptions<'a> = CreateDatabaseHostOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<DatabaseHost>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        let mut transaction = state.database.write().begin().await?;

        let mut query_builder = InsertQueryBuilder::new("database_hosts");

        Self::run_create_handlers(&mut options, &mut query_builder, state, &mut transaction)
            .await?;

        options.credentials.encrypt(&state.database).await?;

        query_builder
            .set("name", &options.name)
            .set("type", options.r#type)
            .set("deployment_enabled", options.deployment_enabled)
            .set("maintenance_enabled", options.maintenance_enabled)
            .set("public_host", &options.public_host)
            .set("public_port", options.public_port.map(|p| p as i32))
            .set("credentials", serde_json::to_value(&options.credentials)?);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut *transaction)
            .await?;
        let database_host = Self::map(None, &row)?;

        transaction.commit().await?;

        Ok(database_host)
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Clone, Default)]
pub struct UpdateDatabaseHostOptions {
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: Option<compact_str::CompactString>,

    #[garde(skip)]
    pub deployment_enabled: Option<bool>,
    #[garde(skip)]
    pub maintenance_enabled: Option<bool>,

    #[garde(length(max = 255))]
    #[schema(max_length = 255)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub public_host: Option<Option<compact_str::CompactString>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    #[garde(range(min = 1))]
    #[schema(minimum = 1)]
    pub public_port: Option<Option<u16>>,

    #[garde(dive)]
    pub credentials: Option<DatabaseCredentials>,
}

#[async_trait::async_trait]
impl UpdatableModel for DatabaseHost {
    type UpdateOptions = UpdateDatabaseHostOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateListenerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateListenerList<DatabaseHost>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &UPDATE_LISTENERS
    }

    async fn update(
        &mut self,
        state: &crate::State,
        mut options: Self::UpdateOptions,
    ) -> Result<(), crate::database::DatabaseError> {
        options.validate()?;

        let mut transaction = state.database.write().begin().await?;

        let mut query_builder = UpdateQueryBuilder::new("database_hosts");

        Self::run_update_handlers(
            self,
            &mut options,
            &mut query_builder,
            state,
            &mut transaction,
        )
        .await?;

        if let Some(credentials) = &mut options.credentials {
            credentials.encrypt(&state.database).await?;
        }

        query_builder
            .set("name", options.name.as_ref())
            .set("deployment_enabled", options.deployment_enabled)
            .set("maintenance_enabled", options.maintenance_enabled)
            .set("public_host", options.public_host.as_ref())
            .set(
                "public_port",
                options
                    .public_port
                    .as_ref()
                    .map(|p| p.as_ref().map(|port| *port as i32)),
            )
            .set(
                "credentials",
                options
                    .credentials
                    .as_ref()
                    .map(serde_json::to_value)
                    .transpose()?,
            )
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut *transaction).await?;

        if let Some(name) = options.name {
            self.name = name;
        }
        if let Some(deployment_enabled) = options.deployment_enabled {
            self.deployment_enabled = deployment_enabled;
        }
        if let Some(maintenance_enabled) = options.maintenance_enabled {
            self.maintenance_enabled = maintenance_enabled;
        }
        if let Some(public_host) = options.public_host {
            self.public_host = public_host;
        }
        if let Some(public_port) = options.public_port {
            self.public_port = public_port.map(|port| port as i32);
        }
        if let Some(credentials) = options.credentials {
            self.credentials = credentials;
        }

        transaction.commit().await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl DeletableModel for DatabaseHost {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteListenerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteListenerList<DatabaseHost>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &DELETE_LISTENERS
    }

    async fn delete(
        &self,
        state: &crate::State,
        options: Self::DeleteOptions,
    ) -> Result<(), anyhow::Error> {
        let mut transaction = state.database.write().begin().await?;

        self.run_delete_handlers(&options, state, &mut transaction)
            .await?;

        sqlx::query(
            r#"
            DELETE FROM database_hosts
            WHERE database_hosts.uuid = $1
            "#,
        )
        .bind(self.uuid)
        .execute(&mut *transaction)
        .await?;

        transaction.commit().await?;

        Ok(())
    }
}

#[derive(ToSchema, Serialize)]
#[schema(title = "AdminDatabaseHost")]
pub struct AdminApiDatabaseHost {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub deployment_enabled: bool,
    pub maintenance_enabled: bool,
    pub r#type: DatabaseType,

    pub public_host: Option<compact_str::CompactString>,
    pub public_port: Option<i32>,

    pub credentials: DatabaseCredentials,

    pub created: chrono::DateTime<chrono::Utc>,
}

#[derive(ToSchema, Serialize)]
#[schema(title = "DatabaseHost")]
pub struct ApiDatabaseHost {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub maintenance_enabled: bool,
    pub r#type: DatabaseType,

    pub host: compact_str::CompactString,
    pub port: i32,
}
