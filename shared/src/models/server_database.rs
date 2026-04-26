use crate::{
    models::{
        InsertQueryBuilder, UpdateQueryBuilder,
        database_host::{DatabaseTransaction, DatabaseType},
    },
    prelude::*,
};
use garde::Validate;
use rand::distr::SampleString;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{
    collections::BTreeMap,
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, Clone)]
pub struct ServerDatabase {
    pub uuid: uuid::Uuid,
    pub server: Fetchable<super::server::Server>,
    pub database_host: super::database_host::DatabaseHost,

    pub name: compact_str::CompactString,
    pub locked: bool,

    pub username: compact_str::CompactString,
    pub password: Vec<u8>,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for ServerDatabase {
    const NAME: &'static str = "server_database";

    fn get_extension_list() -> &'static super::ModelExtensionList {
        static EXTENSIONS: LazyLock<super::ModelExtensionList> =
            LazyLock::new(|| std::sync::RwLock::new(Vec::new()));

        &EXTENSIONS
    }

    fn get_extension_data(&self) -> &super::ModelExtensionData {
        &self.extension_data
    }

    #[inline]
    fn base_columns(prefix: Option<&str>) -> BTreeMap<&'static str, compact_str::CompactString> {
        let prefix = prefix.unwrap_or_default();

        let mut columns = BTreeMap::from([
            (
                "server_databases.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "server_databases.server_uuid",
                compact_str::format_compact!("{prefix}server_uuid"),
            ),
            (
                "server_databases.name",
                compact_str::format_compact!("{prefix}name"),
            ),
            (
                "server_databases.locked",
                compact_str::format_compact!("{prefix}locked"),
            ),
            (
                "server_databases.username",
                compact_str::format_compact!("{prefix}username"),
            ),
            (
                "server_databases.password",
                compact_str::format_compact!("{prefix}password"),
            ),
            (
                "server_databases.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ]);

        columns.extend(super::database_host::DatabaseHost::base_columns(Some(
            "database_host_",
        )));

        columns
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            uuid: row.try_get(compact_str::format_compact!("{prefix}uuid").as_str())?,
            server: super::server::Server::get_fetchable(
                row.try_get(compact_str::format_compact!("{prefix}server_uuid").as_str())?,
            ),
            database_host: super::database_host::DatabaseHost::map(Some("database_host_"), row)?,
            name: row.try_get(compact_str::format_compact!("{prefix}name").as_str())?,
            locked: row.try_get(compact_str::format_compact!("{prefix}locked").as_str())?,
            username: row.try_get(compact_str::format_compact!("{prefix}username").as_str())?,
            password: row.try_get(compact_str::format_compact!("{prefix}password").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl ServerDatabase {
    pub async fn by_uuid(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM server_databases
            JOIN database_hosts ON database_hosts.uuid = server_databases.database_host_uuid
            WHERE server_databases.uuid = $1
            "#,
            Self::columns_sql(None)
        ))
        .bind(uuid)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn by_server_uuid_uuid(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM server_databases
            JOIN database_hosts ON database_hosts.uuid = server_databases.database_host_uuid
            WHERE server_databases.server_uuid = $1 AND server_databases.uuid = $2
            "#,
            Self::columns_sql(None)
        ))
        .bind(server_uuid)
        .bind(uuid)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn by_database_host_uuid_with_pagination(
        database: &crate::database::Database,
        database_host_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(&format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM server_databases
            JOIN database_hosts ON database_hosts.uuid = server_databases.database_host_uuid
            WHERE server_databases.database_host_uuid = $1 AND ($2 IS NULL OR server_databases.name ILIKE '%' || $2 || '%')
            ORDER BY server_databases.created
            LIMIT $3 OFFSET $4
            "#,
            Self::columns_sql(None)
        ))
        .bind(database_host_uuid)
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

    pub async fn by_server_uuid_with_pagination(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(&format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM server_databases
            JOIN database_hosts ON database_hosts.uuid = server_databases.database_host_uuid
            WHERE server_databases.server_uuid = $1 AND ($2 IS NULL OR server_databases.name ILIKE '%' || $2 || '%')
            ORDER BY server_databases.created
            LIMIT $3 OFFSET $4
            "#,
            Self::columns_sql(None)
        ))
        .bind(server_uuid)
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

    pub async fn all_by_server_uuid(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
    ) -> Result<Vec<Self>, crate::database::DatabaseError> {
        let rows = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM server_databases
            JOIN database_hosts ON database_hosts.uuid = server_databases.database_host_uuid
            WHERE server_databases.server_uuid = $1
            "#,
            Self::columns_sql(None)
        ))
        .bind(server_uuid)
        .fetch_all(database.read())
        .await?;

        rows.into_iter()
            .map(|row| Self::map(None, &row))
            .try_collect_vec()
    }

    pub async fn count_by_server_uuid(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
    ) -> i64 {
        sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM server_databases
            WHERE server_databases.server_uuid = $1
            "#,
        )
        .bind(server_uuid)
        .fetch_one(database.read())
        .await
        .unwrap_or(0)
    }

    pub async fn count_by_database_host_uuid(
        database: &crate::database::Database,
        database_host_uuid: uuid::Uuid,
    ) -> i64 {
        sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM server_databases
            WHERE server_databases.database_host_uuid = $1
            "#,
        )
        .bind(database_host_uuid)
        .fetch_one(database.read())
        .await
        .unwrap_or(0)
    }

    pub async fn rotate_password(
        &mut self,
        database: &crate::database::Database,
    ) -> Result<String, anyhow::Error> {
        let new_password = rand::distr::Alphanumeric.sample_string(&mut rand::rng(), 24);

        match self.database_host.get_connection(database).await? {
            crate::models::database_host::DatabasePool::Mysql(pool) => {
                sqlx::query(&format!(
                    "ALTER USER '{}'@'%' IDENTIFIED BY '{}'",
                    self.username, new_password
                ))
                .execute(&pool)
                .await?;
            }
            crate::models::database_host::DatabasePool::Postgres(pool) => {
                sqlx::query(&format!(
                    "ALTER USER \"{}\" WITH PASSWORD '{}'",
                    self.username, new_password
                ))
                .execute(&pool)
                .await?;
            }
            crate::models::database_host::DatabasePool::Mongodb(client) => {
                let cmd = mongodb::bson::doc! {
                    "updateUser": self.username.to_string(),
                    "pwd": &new_password
                };
                client.database(&self.name).run_command(cmd).await?;
            }
        }

        sqlx::query(
            r#"
            UPDATE server_databases
            SET password = $1
            WHERE server_databases.uuid = $2
            "#,
        )
        .bind(database.encrypt(new_password.clone()).await?)
        .bind(self.uuid)
        .execute(database.write())
        .await?;

        Ok(new_password)
    }

    pub async fn get_size(
        &mut self,
        database: &crate::database::Database,
    ) -> Result<i64, crate::database::DatabaseError> {
        match self.database_host.get_connection(database).await? {
            crate::models::database_host::DatabasePool::Mysql(pool) => {
                let row = sqlx::query(
                    "SELECT CAST(SUM(data_length + index_length) AS INTEGER) FROM information_schema.tables WHERE table_schema = ?",
                )
                .bind(&self.name)
                .fetch_one(&pool)
                .await?;

                Ok(row.get::<Option<i64>, _>(0).unwrap_or(0))
            }
            crate::models::database_host::DatabasePool::Postgres(pool) => {
                let row = sqlx::query("SELECT pg_database_size($1)")
                    .bind(&self.name)
                    .fetch_one(&pool)
                    .await?;

                Ok(row.get::<Option<i64>, _>(0).unwrap_or(0))
            }
            crate::models::database_host::DatabasePool::Mongodb(client) => {
                let cmd = mongodb::bson::doc! { "dbStats": 1, "scale": 1 };
                let stats = client.database(&self.name).run_command(cmd).await?;

                let size = match stats.get("dataSize") {
                    Some(mongodb::bson::Bson::Int32(i)) => *i as i64,
                    Some(mongodb::bson::Bson::Int64(i)) => *i,
                    Some(mongodb::bson::Bson::Double(f)) => *f as i64,
                    _ => 0,
                };

                Ok(size)
            }
        }
    }

    pub async fn recreate(
        &mut self,
        database: &crate::database::Database,
    ) -> Result<(), anyhow::Error> {
        let mut run_recreate = async || {
            match self.database_host.get_connection(database).await? {
                crate::models::database_host::DatabasePool::Mysql(pool) => {
                    sqlx::query(&format!("DROP DATABASE IF EXISTS `{}`", self.name))
                        .execute(&pool)
                        .await?;
                    sqlx::query(&format!("CREATE DATABASE `{}` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;", self.name))
                        .execute(&pool)
                        .await?;
                }
                crate::models::database_host::DatabasePool::Postgres(pool) => {
                    sqlx::query(&format!("DROP DATABASE IF EXISTS \"{}\"", self.name))
                        .execute(&pool)
                        .await?;
                    sqlx::query(&format!(
                        "CREATE DATABASE \"{}\" WITH OWNER \"{}\" ENCODING 'UTF8'",
                        self.name, self.username
                    ))
                    .execute(&pool)
                    .await?;
                }
                crate::models::database_host::DatabasePool::Mongodb(client) => {
                    let db = client.database(&self.name);

                    let drop_user_cmd =
                        mongodb::bson::doc! { "dropUser": self.username.to_string() };
                    let _ = db.run_command(drop_user_cmd).await;

                    db.drop().await?;

                    let password = database.decrypt(self.password.clone()).await?;
                    let cmd = mongodb::bson::doc! {
                        "createUser": self.username.to_string(),
                        "pwd": password.into_string(),
                        "roles": [
                            { "role": "readWrite", "db": self.name.to_string() }
                        ]
                    };
                    db.run_command(cmd).await?;
                }
            }

            Ok::<(), anyhow::Error>(())
        };

        if let Err(err) = run_recreate().await {
            if err
                .downcast_ref::<sqlx::Error>()
                .and_then(|e| e.as_database_error())
                .is_some_and(|e| e.message().contains("is being accessed"))
            {
                return Err(crate::response::DisplayError::new(
                    "this database is being accessed, unable to recreate.",
                )
                .into());
            }

            return Err(err);
        }

        Ok(())
    }
}

#[async_trait::async_trait]
impl IntoAdminApiObject for ServerDatabase {
    type AdminApiObject = AdminApiServerDatabase;
    type ExtraArgs<'a> = &'a crate::storage::StorageUrlRetriever<'a>;

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        storage_url_retriever: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiServerDatabase::init_hooks(&self, state).await?;

        let details = self
            .database_host
            .credentials
            .parse_connection_details(&state.database)
            .await?;

        let api_object = finish_extendible!(
            AdminApiServerDatabase {
                uuid: self.uuid,
                server: self
                    .server
                    .fetch_cached(&state.database)
                    .await?
                    .into_admin_api_object(state, storage_url_retriever)
                    .await?,
                r#type: self.database_host.r#type,
                host: self.database_host.public_host.unwrap_or(details.host),
                port: self
                    .database_host
                    .public_port
                    .unwrap_or(details.port as i32),
                name: self.name,
                is_locked: self.locked,
                username: self.username,
                password: state.database.decrypt(self.password).await?,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[async_trait::async_trait]
impl IntoApiObject for ServerDatabase {
    type ApiObject = ApiServerDatabase;
    type ExtraArgs<'a> = bool;

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        show_password: Self::ExtraArgs<'a>,
    ) -> Result<Self::ApiObject, crate::database::DatabaseError> {
        let api_object = ApiServerDatabase::init_hooks(&self, state).await?;

        let mut username = self.username;
        let space_idx = username.find(' ');

        if let Some(space_idx) = space_idx {
            username.truncate(space_idx);
        }

        let details = self
            .database_host
            .credentials
            .parse_connection_details(&state.database)
            .await?;

        let api_object = finish_extendible!(
            ApiServerDatabase {
                uuid: self.uuid,
                r#type: self.database_host.r#type,
                host: self.database_host.public_host.unwrap_or(details.host),
                port: self
                    .database_host
                    .public_port
                    .unwrap_or(details.port as i32),
                name: self.name,
                is_locked: self.locked,
                username,
                password: if show_password {
                    Some(state.database.decrypt(self.password).await?)
                } else {
                    None
                },
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[derive(Validate)]
pub struct CreateServerDatabaseOptions<'a> {
    #[garde(skip)]
    pub server: &'a super::server::Server,
    #[garde(skip)]
    pub database_host: &'a super::database_host::DatabaseHost,

    #[garde(length(chars, min = 3, max = 31), pattern("^[a-zA-Z0-9_]+$"))]
    pub name: compact_str::CompactString,
}

#[async_trait::async_trait]
impl CreatableModel for ServerDatabase {
    type CreateOptions<'a> = CreateServerDatabaseOptions<'a>;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<ServerDatabase>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        let server_id = format!("{:08x}", options.server.uuid_short);
        let name = format!("s{}_{}", server_id, options.name);
        let username = format!(
            "u{}_{}",
            server_id,
            rand::distr::Alphanumeric.sample_string(&mut rand::rng(), 10)
        );
        let password = rand::distr::Alphanumeric.sample_string(&mut rand::rng(), 24);

        let transaction: DatabaseTransaction = match options
            .database_host
            .clone()
            .get_connection(&state.database)
            .await?
        {
            crate::models::database_host::DatabasePool::Mysql(pool) => {
                let mut transaction = pool.begin().await?;

                sqlx::query(&format!(
                    "CREATE USER IF NOT EXISTS '{username}'@'%' IDENTIFIED BY '{password}'"
                ))
                .execute(&mut *transaction)
                .await?;
                sqlx::query(&format!("CREATE DATABASE IF NOT EXISTS `{name}` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"))
                    .execute(&mut *transaction)
                    .await?;
                sqlx::query(&format!(
                    "GRANT ALL PRIVILEGES ON `{name}`.* TO '{username}'@'%' WITH GRANT OPTION"
                ))
                .execute(&mut *transaction)
                .await?;

                DatabaseTransaction::Mysql(transaction)
            }
            crate::models::database_host::DatabasePool::Postgres(pool) => {
                let transaction = pool.begin().await?;

                sqlx::query(&format!(
                    "CREATE USER \"{username}\" WITH PASSWORD '{password}'"
                ))
                .execute(&pool)
                .await?;
                sqlx::query(&format!(
                    "CREATE DATABASE \"{name}\" WITH OWNER \"{username}\" ENCODING 'UTF8'"
                ))
                .execute(&pool)
                .await?;

                DatabaseTransaction::Postgres(transaction, pool)
            }
            crate::models::database_host::DatabasePool::Mongodb(client) => {
                let db = client.database(&name);
                let cmd = mongodb::bson::doc! {
                    "createUser": &username,
                    "pwd": &password,
                    "roles": [
                        { "role": "readWrite", "db": &name }
                    ]
                };
                db.run_command(cmd).await?;

                DatabaseTransaction::Mongodb(client)
            }
        };

        let mut panel_transaction = state.database.write().begin().await?;

        let mut query_builder = InsertQueryBuilder::new("server_databases");

        Self::run_create_handlers(
            &mut options,
            &mut query_builder,
            state,
            &mut panel_transaction,
        )
        .await?;

        query_builder
            .set("server_uuid", options.server.uuid)
            .set("database_host_uuid", options.database_host.uuid)
            .set("name", &name)
            .set("username", &username)
            .set("password", state.database.encrypt(password.clone()).await?);

        let row = match query_builder
            .returning("uuid")
            .fetch_one(&mut *panel_transaction)
            .await
        {
            Ok(row) => row,
            Err(err) => {
                match transaction {
                    DatabaseTransaction::Mysql(transaction) => {
                        transaction.rollback().await?;
                    }
                    DatabaseTransaction::Postgres(transaction, pool) => {
                        transaction.rollback().await?;

                        let drop_database = format!("DROP DATABASE IF EXISTS \"{name}\"");
                        let drop_user = format!("DROP USER IF EXISTS \"{username}\"");

                        let (_, _) = tokio::join!(
                            sqlx::query(&drop_database).execute(&pool),
                            sqlx::query(&drop_user).execute(&pool)
                        );
                    }
                    DatabaseTransaction::Mongodb(client) => {
                        let _ = client.database(&name).drop().await;
                    }
                }

                return Err(err.into());
            }
        };

        let uuid: uuid::Uuid = row.try_get("uuid")?;

        match match transaction {
            DatabaseTransaction::Mysql(transaction) => transaction.commit().await,
            DatabaseTransaction::Postgres(transaction, _) => transaction.commit().await,
            DatabaseTransaction::Mongodb(_) => Ok(()),
        } {
            Ok(_) => {}
            Err(err) => {
                sqlx::query(
                    r#"
                    DELETE FROM server_databases
                    WHERE server_databases.uuid = $1
                    "#,
                )
                .bind(uuid)
                .execute(&mut *panel_transaction)
                .await
                .ok();

                return Err(err.into());
            }
        }

        panel_transaction.commit().await?;

        Self::by_uuid(&state.database, uuid)
            .await?
            .ok_or(sqlx::Error::RowNotFound.into())
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Default)]
pub struct UpdateServerDatabaseOptions {
    #[garde(skip)]
    pub locked: Option<bool>,
}

#[async_trait::async_trait]
impl UpdatableModel for ServerDatabase {
    type UpdateOptions = UpdateServerDatabaseOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateListenerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateListenerList<ServerDatabase>> =
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

        let mut query_builder = UpdateQueryBuilder::new("server_databases");

        Self::run_update_handlers(
            self,
            &mut options,
            &mut query_builder,
            state,
            &mut transaction,
        )
        .await?;

        query_builder
            .set("locked", options.locked)
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut *transaction).await?;

        if let Some(locked) = options.locked {
            self.locked = locked;
        }

        transaction.commit().await?;

        Ok(())
    }
}

#[derive(Default)]
pub struct DeleteServerDatabaseOptions {
    pub force: bool,
}

#[async_trait::async_trait]
impl DeletableModel for ServerDatabase {
    type DeleteOptions = DeleteServerDatabaseOptions;

    fn get_delete_handlers() -> &'static LazyLock<DeleteListenerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteListenerList<ServerDatabase>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &DELETE_LISTENERS
    }

    async fn delete(
        &self,
        state: &crate::State,
        options: Self::DeleteOptions,
    ) -> Result<(), anyhow::Error> {
        let mut transaction = state.database.write().begin().await?;

        if self.name.contains(|c| ['"', '\'', '`'].contains(&c))
            || self.username.contains(|c| ['"', '\'', '`'].contains(&c))
        {
            return Err(anyhow::anyhow!(
                "unable to delete database with escape characters"
            ));
        }

        self.run_delete_handlers(&options, state, &mut transaction)
            .await?;

        let connection = self
            .database_host
            .clone()
            .get_connection(&state.database)
            .await?;
        let database_name = self.name.clone();
        let database_username = self.username.trim_end().to_string();
        let database_uuid = self.uuid;

        tokio::spawn(async move {
            let run_delete = async || {
                match connection {
                    crate::models::database_host::DatabasePool::Mysql(pool) => {
                        sqlx::query(&format!("DROP DATABASE IF EXISTS `{}`", database_name))
                            .execute(&pool)
                            .await?;
                        sqlx::query(&format!("DROP USER IF EXISTS '{}'@'%'", database_username))
                            .execute(&pool)
                            .await?;
                    }
                    crate::models::database_host::DatabasePool::Postgres(pool) => {
                        sqlx::query(&format!("DROP DATABASE IF EXISTS \"{}\"", database_name))
                            .execute(&pool)
                            .await?;
                        sqlx::query(&format!("DROP USER IF EXISTS \"{}\"", database_username))
                            .execute(&pool)
                            .await?;
                    }
                    crate::models::database_host::DatabasePool::Mongodb(client) => {
                        let db = client.database(&database_name);

                        db.run_command(mongodb::bson::doc! { "dropUser": &database_username })
                            .await?;

                        db.drop().await?;
                    }
                }

                Ok::<_, anyhow::Error>(())
            };

            if let Err(err) = run_delete().await
                && !options.force
            {
                if err
                    .downcast_ref::<sqlx::Error>()
                    .and_then(|e| e.as_database_error())
                    .is_some_and(|e| e.message().contains("is being accessed"))
                {
                    return Err(crate::response::DisplayError::new(
                        "this database is being accessed, unable to delete.",
                    )
                    .into());
                }

                return Err(err);
            }

            sqlx::query(
                r#"
                DELETE FROM server_databases
                WHERE server_databases.uuid = $1
                "#,
            )
            .bind(database_uuid)
            .execute(&mut *transaction)
            .await?;

            transaction.commit().await?;

            Ok(())
        })
        .await?
    }
}

#[schema_extension_derive::extendible]
#[init_args(ServerDatabase, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "AdminServerDatabase")]
pub struct AdminApiServerDatabase {
    pub uuid: uuid::Uuid,
    pub server: super::server::AdminApiServer,

    pub r#type: DatabaseType,
    pub host: compact_str::CompactString,
    pub port: i32,

    pub name: compact_str::CompactString,
    pub is_locked: bool,

    pub username: compact_str::CompactString,
    pub password: compact_str::CompactString,

    pub created: chrono::DateTime<chrono::Utc>,
}

#[schema_extension_derive::extendible]
#[init_args(ServerDatabase, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "ServerDatabase")]
pub struct ApiServerDatabase {
    pub uuid: uuid::Uuid,

    pub r#type: DatabaseType,
    pub host: compact_str::CompactString,
    pub port: i32,

    pub name: compact_str::CompactString,
    pub is_locked: bool,

    pub username: compact_str::CompactString,
    pub password: Option<compact_str::CompactString>,

    pub created: chrono::DateTime<chrono::Utc>,
}
