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

#[derive(Serialize, Deserialize)]
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
    pub async fn by_server_uuid_username(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
        username: &str,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM server_subusers
            JOIN users ON users.uuid = server_subusers.user_uuid
            LEFT JOIN roles ON roles.uuid = users.role_uuid
            WHERE server_subusers.server_uuid = $1 AND users.username = $2
            "#,
            Self::columns_sql(None)
        ))
        .bind(server_uuid)
        .bind(username)
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

        let rows = sqlx::query(&format!(
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

    pub async fn delete_by_uuids(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
        user_uuid: uuid::Uuid,
    ) -> Result<(), crate::database::DatabaseError> {
        sqlx::query(
            r#"
            DELETE FROM server_subusers
            WHERE server_subusers.server_uuid = $1 AND server_subusers.user_uuid = $2
            "#,
        )
        .bind(server_uuid)
        .bind(user_uuid)
        .execute(database.write())
        .await?;

        Ok(())
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

    async fn create(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
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
                    language: app_settings.app.language.clone(),
                };
                drop(app_settings);
                let user = match super::user::User::create(state, create_options).await {
                    Ok(user) => user,
                    Err(err) => {
                        tracing::error!(username = %username, email = %options.email, "failed to create subuser user: {:?}", err);
                        return Err(err);
                    }
                };

                match super::user_password_reset::UserPasswordReset::create(
                    &state.database,
                    user.uuid,
                )
                .await
                {
                    Ok(token) => {
                        let settings = state.settings.get().await?;

                        super::user_activity::UserActivity::create(
                            state,
                            super::user_activity::CreateUserActivityOptions {
                                user_uuid: user.uuid,
                                impersonator_uuid: None,
                                api_key_uuid: None,
                                event: "email:account-created".into(),
                                ip: None,
                                data: serde_json::json!({}),
                                created: None,
                            },
                        )
                        .await?;

                        state
                            .mail
                            .send(
                                user.email.clone(),
                                format!("{} - Account Created", settings.app.name).into(),
                                crate::mail::MAIL_ACCOUNT_CREATED,
                                minijinja::context! {
                                    user => user,
                                    reset_link => format!(
                                        "{}/auth/reset-password?token={}",
                                        settings.app.url,
                                        urlencoding::encode(&token),
                                    )
                                },
                            )
                            .await;
                    }
                    Err(err) => {
                        tracing::warn!(
                            user = %user.uuid,
                            "failed to create subuser password reset token: {:#?}",
                            err
                        );
                    }
                }

                user
            }
        };

        if options.server.owner.uuid == user.uuid {
            return Err(sqlx::Error::InvalidArgument(
                "cannot create subuser for server owner".into(),
            )
            .into());
        }

        let mut transaction = state.database.write().begin().await?;

        let mut query_builder = InsertQueryBuilder::new("server_subusers");

        Self::run_create_handlers(&mut options, &mut query_builder, state, &mut transaction)
            .await?;

        query_builder
            .set("server_uuid", options.server.uuid)
            .set("user_uuid", user.uuid)
            .set("permissions", &options.permissions)
            .set("ignored_files", &options.ignored_files);

        query_builder.execute(&mut *transaction).await?;

        transaction.commit().await?;

        let subuser =
            Self::by_server_uuid_username(&state.database, options.server.uuid, &user.username)
                .await?
                .ok_or_else(|| {
                    anyhow::anyhow!(
                        "subuser with username {} not found after creation",
                        user.username
                    )
                })?;

        Ok(subuser)
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

    fn get_update_handlers() -> &'static LazyLock<UpdateListenerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateListenerList<ServerSubuser>> =
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

        let mut query_builder = UpdateQueryBuilder::new("server_subusers");

        Self::run_update_handlers(
            self,
            &mut options,
            &mut query_builder,
            state,
            &mut transaction,
        )
        .await?;

        query_builder
            .set("permissions", options.permissions.as_ref())
            .set("ignored_files", options.ignored_files.as_ref())
            .where_eq("server_uuid", self.server.uuid)
            .where_eq("user_uuid", self.user.uuid);

        query_builder.execute(&mut *transaction).await?;

        if let Some(permissions) = options.permissions {
            self.permissions = permissions;
        }
        if let Some(ignored_files) = options.ignored_files {
            self.ignored_files = ignored_files;
        }

        transaction.commit().await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl DeletableModel for ServerSubuser {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteListenerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteListenerList<ServerSubuser>> =
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
            DELETE FROM server_subusers
            WHERE server_subusers.server_uuid = $1 AND server_subusers.user_uuid = $2
            "#,
        )
        .bind(self.server.uuid)
        .bind(self.user.uuid)
        .execute(&mut *transaction)
        .await?;

        transaction.commit().await?;

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
