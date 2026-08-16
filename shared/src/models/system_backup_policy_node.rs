use crate::{models::InsertQueryBuilder, prelude::*};
use garde::Validate;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{
    collections::BTreeMap,
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

#[derive(Serialize, Deserialize)]
pub struct SystemBackupPolicyNode {
    pub system_backup_policy: Fetchable<super::system_backup_policy::SystemBackupPolicy>,
    pub node: Fetchable<super::node::Node>,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for SystemBackupPolicyNode {
    const NAME: &'static str = "system_backup_policy_node";

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

        BTreeMap::from([
            (
                "system_backup_policy_nodes.system_backup_policy_uuid",
                compact_str::format_compact!("{prefix}system_backup_policy_uuid"),
            ),
            (
                "system_backup_policy_nodes.node_uuid",
                compact_str::format_compact!("{prefix}node_uuid"),
            ),
            (
                "system_backup_policy_nodes.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ])
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            system_backup_policy: super::system_backup_policy::SystemBackupPolicy::get_fetchable(
                row.try_get(
                    compact_str::format_compact!("{prefix}system_backup_policy_uuid").as_str(),
                )?,
            ),
            node: super::node::Node::get_fetchable(
                row.try_get(compact_str::format_compact!("{prefix}node_uuid").as_str())?,
            ),
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl SystemBackupPolicyNode {
    pub async fn by_system_backup_policy_uuid_node_uuid(
        database: &crate::database::Database,
        system_backup_policy_uuid: uuid::Uuid,
        node_uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM system_backup_policy_nodes
            WHERE
                system_backup_policy_nodes.system_backup_policy_uuid = $1
                AND system_backup_policy_nodes.node_uuid = $2
            "#,
            Self::columns_sql(None)
        )))
        .bind(system_backup_policy_uuid)
        .bind(node_uuid)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn by_system_backup_policy_uuid_with_pagination(
        database: &crate::database::Database,
        system_backup_policy_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM system_backup_policy_nodes
            JOIN nodes ON nodes.uuid = system_backup_policy_nodes.node_uuid
            WHERE
                system_backup_policy_nodes.system_backup_policy_uuid = $1
                AND ($2 IS NULL OR nodes.name ILIKE '%' || $2 || '%')
            ORDER BY system_backup_policy_nodes.created
            LIMIT $3 OFFSET $4
            "#,
            Self::columns_sql(None)
        )))
        .bind(system_backup_policy_uuid)
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
impl IntoAdminApiObject for SystemBackupPolicyNode {
    type AdminApiObject = AdminApiSystemBackupPolicyNode;
    type ExtraArgs<'a> = ();

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiSystemBackupPolicyNode::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            AdminApiSystemBackupPolicyNode {
                node: self
                    .node
                    .fetch_cached(&state.database)
                    .await?
                    .into_admin_api_object(state, ())
                    .await?,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[derive(ToSchema, Deserialize, Validate)]
pub struct CreateSystemBackupPolicyNodeOptions {
    #[garde(skip)]
    pub system_backup_policy_uuid: uuid::Uuid,
    #[garde(skip)]
    pub node_uuid: uuid::Uuid,
}

#[async_trait::async_trait]
impl CreatableModel for SystemBackupPolicyNode {
    type CreateOptions<'a> = CreateSystemBackupPolicyNodeOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<SystemBackupPolicyNode>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create_with_transaction(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        super::node::Node::by_uuid_optional_cached(&state.database, options.node_uuid)
            .await?
            .ok_or(crate::database::InvalidRelationError("node"))?;

        let mut query_builder = InsertQueryBuilder::new("system_backup_policy_nodes");

        Self::run_create_handlers(&mut options, &mut query_builder, state, transaction).await?;

        query_builder
            .set(
                "system_backup_policy_uuid",
                options.system_backup_policy_uuid,
            )
            .set("node_uuid", options.node_uuid);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut **transaction)
            .await?;
        let mut policy_node = Self::map(None, &row)?;

        Self::run_after_create_handlers(&mut policy_node, &options, state, transaction).await?;

        Ok(policy_node)
    }
}

#[async_trait::async_trait]
impl DeletableModel for SystemBackupPolicyNode {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteHandlerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteHandlerList<SystemBackupPolicyNode>> =
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
            DELETE FROM system_backup_policy_nodes
            WHERE
                system_backup_policy_nodes.system_backup_policy_uuid = $1
                AND system_backup_policy_nodes.node_uuid = $2
            "#,
        )
        .bind(self.system_backup_policy.uuid)
        .bind(self.node.uuid)
        .execute(&mut **transaction)
        .await?;

        self.run_after_delete_handlers(&options, state, transaction)
            .await?;

        Ok(())
    }
}

#[schema_extension_derive::extendible]
#[init_args(SystemBackupPolicyNode, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "SystemBackupPolicyNode")]
pub struct AdminApiSystemBackupPolicyNode {
    pub node: super::node::AdminApiNode,

    pub created: chrono::DateTime<chrono::Utc>,
}
