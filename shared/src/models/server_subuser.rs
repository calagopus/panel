use crate::{
    models::{InsertQueryBuilder, UpdateQueryBuilder},
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

#[derive(Clone, Serialize, Deserialize)]
pub struct ServerSubuser {
    pub user: super::user::User,
    pub server: Fetchable<super::server::Server>,

    pub permissions: Vec<compact_str::CompactString>,
    pub ignored_files: Vec<compact_str::CompactString>,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for ServerSubuser {
    const NAME: &'static str = "server_subuser";

    fn get_extension_list() -> &'static super::ModelExtensionList {
        static EXTENSIONS: LazyLock<super::ModelExtensionList> =
            LazyLock::new(|| parking_lot::RwLock::new(Vec::new()));

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
                "server_subusers.server_uuid",
                compact_str::format_compact!("{prefix}server_uuid"),
            ),
            (
                "server_subusers.permissions",
                compact_str::format_compact!("{prefix}permissions"),
            ),
            (
                "server_subusers.ignored_files",
                compact_str::format_compact!("{prefix}ignored_files"),
            ),
            (
                "server_subusers.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ]);

        columns.extend(super::user::User::base_columns(Some("user_")));

        columns
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            user: super::user::User::map(Some("user_"), row)?,
            server: super::server::Server::get_fetchable(
                row.try_get(compact_str::format_compact!("{prefix}server_uuid").as_str())?,
            ),
            permissions: row
                .try_get(compact_str::format_compact!("{prefix}permissions").as_str())?,
            ignored_files: row
                .try_get(compact_str::format_compact!("{prefix}ignored_files").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl ServerSubuser {
    pub async fn by_server_uuid_user_uuid(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
        user_uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM server_subusers
            JOIN users ON users.uuid = server_subusers.user_uuid
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            WHERE server_subusers.server_uuid = $1 AND server_subusers.user_uuid = $2
            "#,
            Self::columns_sql(None)
        )))
        .bind(server_uuid)
        .bind(user_uuid)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn by_server_uuid_with_pagination(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM server_subusers
            JOIN users ON users.uuid = server_subusers.user_uuid
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            WHERE server_subusers.server_uuid = $1 AND ($2 IS NULL OR users.username ILIKE '%' || $2 || '%')
            ORDER BY server_subusers.created
            LIMIT $3 OFFSET $4
            "#,
            Self::columns_sql(None)
        )))
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

    pub async fn count_by_server_uuid(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
    ) -> Result<i64, sqlx::Error> {
        sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM server_subusers
            WHERE server_subusers.server_uuid = $1
            "#,
        )
        .bind(server_uuid)
        .fetch_one(database.read())
        .await
    }
}

#[async_trait::async_trait]
impl IntoApiObject for ServerSubuser {
    type ApiObject = ApiServerSubuser;
    type ExtraArgs<'a> = &'a crate::storage::StorageUrlRetriever<'a>;

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        storage_url_retriever: Self::ExtraArgs<'a>,
    ) -> Result<Self::ApiObject, crate::database::DatabaseError> {
        let api_object = ApiServerSubuser::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            ApiServerSubuser {
                user: self
                    .user
                    .into_api_object(state, storage_url_retriever)
                    .await?,
                permissions: self.permissions,
                ignored_files: self.ignored_files,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[derive(Validate)]
pub struct CreateServerSubuserOptions<'a> {
    #[garde(skip)]
    pub server: &'a super::server::Server,

    #[garde(email)]
    pub email: compact_str::CompactString,
    #[garde(custom(crate::permissions::validate_server_permissions))]
    pub permissions: Vec<compact_str::CompactString>,
    #[garde(skip)]
    pub ignored_files: Vec<compact_str::CompactString>,
}

#[async_trait::async_trait]
impl CreatableModel for ServerSubuser {
    type CreateOptions<'a> = CreateServerSubuserOptions<'a>;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<ServerSubuser>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create_with_transaction(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        let user = match super::user::User::by_email(&state.database, &options.email).await? {
            Some(user) => user,
            None => {
                let username = options
                    .email
                    .split('@')
                    .next()
                    .unwrap_or("unknown")
                    .chars()
                    .filter(|c| c.is_alphanumeric() || *c == '_')
                    .take(10)
                    .collect::<compact_str::CompactString>();
                let username = compact_str::format_compact!(
                    "{username}_{}",
                    rand::distr::Alphanumeric.sample_string(&mut rand::rng(), 4)
                );

                let app_settings = state.settings.get().await?;

                let create_options = super::user::CreateUserOptions {
                    role_uuid: None,
                    external_id: None,
                    username: username.clone(),
                    email: options.email.clone(),
                    name_first: "Server".into(),
                    name_last: "Subuser".into(),
                    password: None,
                    admin: false,
                    frozen: false,
                    suspended: false,
                    send_email: true,
                    language: app_settings.app.language.clone(),
                };
                drop(app_settings);
                match super::user::User::create(state, create_options).await {
                    Ok(user) => user,
                    Err(err) => {
                        tracing::error!(username = %username, email = %options.email, "failed to create subuser user: {:?}", err);
                        return Err(err);
                    }
                }
            }
        };

        if options.server.owner.uuid == user.uuid {
            return Err(sqlx::Error::InvalidArgument(
                "cannot create subuser for server owner".into(),
            )
            .into());
        }

        let server_uuid = options.server.uuid;
        let username = user.username.clone();

        let mut query_builder = InsertQueryBuilder::new("server_subusers");

        Self::run_create_handlers(&mut options, &mut query_builder, state, transaction).await?;

        query_builder
            .set("server_uuid", options.server.uuid)
            .set("user_uuid", user.uuid)
            .set("permissions", &options.permissions)
            .set("ignored_files", &options.ignored_files);

        query_builder.execute(&mut **transaction).await?;

        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM server_subusers
            JOIN users ON users.uuid = server_subusers.user_uuid
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            WHERE server_subusers.server_uuid = $1 AND users.username = $2
            "#,
            Self::columns_sql(None)
        )))
        .bind(server_uuid)
        .bind(username.as_str())
        .fetch_one(&mut **transaction)
        .await?;

        let mut result = Self::map(None, &row)?;

        Self::run_after_create_handlers(&mut result, &options, state, transaction).await?;

        let settings = state.settings.get().await?;
        state
            .mail
            .send_template(
                state,
                "added_to_server",
                user.email.clone(),
                minijinja::context! {
                    user => user,
                    server => options.server,
                    server_link => format!(
                        "{}/server/{:08x}",
                        settings.app.url,
                        options.server.uuid_short,
                    )
                },
            )
            .await;

        Ok(result)
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Default)]
pub struct UpdateServerSubuserOptions {
    #[garde(inner(custom(crate::permissions::validate_server_permissions)))]
    pub permissions: Option<Vec<compact_str::CompactString>>,
    #[garde(skip)]
    pub ignored_files: Option<Vec<compact_str::CompactString>>,
}

#[async_trait::async_trait]
impl UpdatableModel for ServerSubuser {
    type UpdateOptions = UpdateServerSubuserOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateHandlerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateHandlerList<ServerSubuser>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &UPDATE_LISTENERS
    }

    async fn update_with_transaction(
        &mut self,
        state: &crate::State,
        mut options: Self::UpdateOptions,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<(), crate::database::DatabaseError> {
        options.validate()?;

        let mut query_builder = UpdateQueryBuilder::new("server_subusers");

        self.run_update_handlers(&mut options, &mut query_builder, state, transaction)
            .await?;

        query_builder
            .set("permissions", options.permissions.as_ref())
            .set("ignored_files", options.ignored_files.as_ref())
            .where_eq("server_uuid", self.server.uuid)
            .where_eq("user_uuid", self.user.uuid);

        query_builder.execute(&mut **transaction).await?;

        if let Some(permissions) = options.permissions {
            self.permissions = permissions;
        }
        if let Some(ignored_files) = options.ignored_files {
            self.ignored_files = ignored_files;
        }

        self.run_after_update_handlers(state, transaction).await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl DeletableModel for ServerSubuser {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteHandlerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteHandlerList<ServerSubuser>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &DELETE_LISTENERS
    }

    async fn delete_with_transaction(
        &self,
        state: &crate::State,
        options: Self::DeleteOptions,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<(), anyhow::Error> {
        self.run_delete_handlers(&options, state, transaction)
            .await?;

        sqlx::query(
            r#"
            DELETE FROM server_subusers
            WHERE server_subusers.server_uuid = $1 AND server_subusers.user_uuid = $2
            "#,
        )
        .bind(self.server.uuid)
        .bind(self.user.uuid)
        .execute(&mut **transaction)
        .await?;

        self.run_after_delete_handlers(&options, state, transaction)
            .await?;

        state
            .mail
            .send_template(
                state,
                "removed_from_server",
                self.user.email.clone(),
                minijinja::context! {
                    user => self.user,
                },
            )
            .await;

        Ok(())
    }
}

#[schema_extension_derive::extendible]
#[init_args(ServerSubuser, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "ServerSubuser")]
pub struct ApiServerSubuser {
    pub user: super::user::ApiUser,

    pub permissions: Vec<compact_str::CompactString>,
    pub ignored_files: Vec<compact_str::CompactString>,

    pub created: chrono::DateTime<chrono::Utc>,
}
