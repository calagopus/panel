use crate::{
    models::{InsertQueryBuilder, UpdateQueryBuilder},
    prelude::*,
};
use garde::Validate;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{
    collections::BTreeMap,
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, Clone)]
pub struct Role {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,

    pub require_two_factor: bool,

    pub admin_permissions: Arc<Vec<compact_str::CompactString>>,
    pub server_permissions: Arc<Vec<compact_str::CompactString>>,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for Role {
    const NAME: &'static str = "role";

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

        BTreeMap::from([
            ("roles.uuid", compact_str::format_compact!("{prefix}uuid")),
            ("roles.name", compact_str::format_compact!("{prefix}name")),
            (
                "roles.description",
                compact_str::format_compact!("{prefix}description"),
            ),
            (
                "roles.require_two_factor",
                compact_str::format_compact!("{prefix}require_two_factor"),
            ),
            (
                "roles.admin_permissions",
                compact_str::format_compact!("{prefix}admin_permissions"),
            ),
            (
                "roles.server_permissions",
                compact_str::format_compact!("{prefix}server_permissions"),
            ),
            (
                "roles.created",
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
            description: row
                .try_get(compact_str::format_compact!("{prefix}description").as_str())?,
            require_two_factor: row
                .try_get(compact_str::format_compact!("{prefix}require_two_factor").as_str())?,
            admin_permissions: Arc::new(
                row.try_get(compact_str::format_compact!("{prefix}admin_permissions").as_str())?,
            ),
            server_permissions: Arc::new(
                row.try_get(compact_str::format_compact!("{prefix}server_permissions").as_str())?,
            ),
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl Role {
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
            FROM roles
            WHERE ($1 IS NULL OR roles.name ILIKE '%' || $1 || '%')
            ORDER BY roles.created
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
}

#[async_trait::async_trait]
impl IntoAdminApiObject for Role {
    type AdminApiObject = AdminApiRole;
    type ExtraArgs<'a> = ();

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiRole::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            AdminApiRole {
                uuid: self.uuid,
                name: self.name,
                description: self.description,
                admin_permissions: self.admin_permissions,
                server_permissions: self.server_permissions,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[async_trait::async_trait]
impl ByUuid for Role {
    async fn by_uuid(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
    ) -> Result<Self, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM roles
            WHERE roles.uuid = $1
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
pub struct CreateRoleOptions {
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: compact_str::CompactString,
    #[garde(length(chars, min = 1, max = 1024))]
    #[schema(min_length = 1, max_length = 1024)]
    pub description: Option<compact_str::CompactString>,
    #[garde(skip)]
    pub require_two_factor: bool,
    #[garde(custom(crate::permissions::validate_admin_permissions))]
    pub admin_permissions: Vec<compact_str::CompactString>,
    #[garde(custom(crate::permissions::validate_server_permissions))]
    pub server_permissions: Vec<compact_str::CompactString>,
}

#[async_trait::async_trait]
impl CreatableModel for Role {
    type CreateOptions<'a> = CreateRoleOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<Role>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        let mut transaction = state.database.write().begin().await?;

        let mut query_builder = InsertQueryBuilder::new("roles");

        Self::run_create_handlers(&mut options, &mut query_builder, state, &mut transaction)
            .await?;

        query_builder
            .set("name", &options.name)
            .set("description", &options.description)
            .set("require_two_factor", options.require_two_factor)
            .set("admin_permissions", &options.admin_permissions)
            .set("server_permissions", &options.server_permissions);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut *transaction)
            .await?;
        let role = Self::map(None, &row)?;

        transaction.commit().await?;

        Ok(role)
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Clone, Default)]
pub struct UpdateRoleOptions {
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: Option<compact_str::CompactString>,
    #[garde(length(chars, min = 1, max = 1024))]
    #[schema(min_length = 1, max_length = 1024)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub description: Option<Option<compact_str::CompactString>>,
    #[garde(skip)]
    pub require_two_factor: Option<bool>,
    #[garde(inner(custom(crate::permissions::validate_admin_permissions)))]
    pub admin_permissions: Option<Vec<compact_str::CompactString>>,
    #[garde(inner(custom(crate::permissions::validate_server_permissions)))]
    pub server_permissions: Option<Vec<compact_str::CompactString>>,
}

#[async_trait::async_trait]
impl UpdatableModel for Role {
    type UpdateOptions = UpdateRoleOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateListenerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateListenerList<Role>> =
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

        let mut query_builder = UpdateQueryBuilder::new("roles");

        Self::run_update_handlers(
            self,
            &mut options,
            &mut query_builder,
            state,
            &mut transaction,
        )
        .await?;

        query_builder
            .set("name", options.name.as_ref())
            .set(
                "description",
                options.description.as_ref().map(|d| d.as_ref()),
            )
            .set("require_two_factor", options.require_two_factor)
            .set("admin_permissions", options.admin_permissions.as_ref())
            .set("server_permissions", options.server_permissions.as_ref())
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut *transaction).await?;

        if let Some(name) = options.name {
            self.name = name;
        }
        if let Some(description) = options.description {
            self.description = description;
        }
        if let Some(require_two_factor) = options.require_two_factor {
            self.require_two_factor = require_two_factor;
        }
        if let Some(admin_permissions) = options.admin_permissions {
            self.admin_permissions = Arc::new(admin_permissions);
        }
        if let Some(server_permissions) = options.server_permissions {
            self.server_permissions = Arc::new(server_permissions);
        }

        transaction.commit().await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl DeletableModel for Role {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteListenerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteListenerList<Role>> =
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
            DELETE FROM roles
            WHERE roles.uuid = $1
            "#,
        )
        .bind(self.uuid)
        .execute(&mut *transaction)
        .await?;

        transaction.commit().await?;

        Ok(())
    }
}

#[schema_extension_derive::extendible]
#[init_args(Role, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "Role")]
pub struct AdminApiRole {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,

    pub admin_permissions: Arc<Vec<compact_str::CompactString>>,
    pub server_permissions: Arc<Vec<compact_str::CompactString>>,

    pub created: chrono::DateTime<chrono::Utc>,
}
