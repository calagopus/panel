use crate::prelude::*;
use axum::http::StatusCode;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{
    collections::BTreeMap,
    sync::{Arc, LazyLock},
};
#[derive(Serialize, Deserialize, Clone)]
pub struct ServerAllocation {
    pub uuid: uuid::Uuid,
    pub allocation: super::node_allocation::NodeAllocation,

    pub notes: Option<compact_str::CompactString>,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for ServerAllocation {
    const NAME: &'static str = "server_allocation";

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
                "server_allocations.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "server_allocations.notes",
                compact_str::format_compact!("{prefix}notes"),
            ),
            (
                "server_allocations.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ]);

        columns.extend(super::node_allocation::NodeAllocation::base_columns(Some(
            "allocation_",
        )));

        columns
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            uuid: row.try_get(compact_str::format_compact!("{prefix}uuid").as_str())?,
            allocation: super::node_allocation::NodeAllocation::map(Some("allocation_"), row)?,
            notes: row.try_get(compact_str::format_compact!("{prefix}notes").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl ServerAllocation {
    pub async fn create(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
        allocation_uuid: uuid::Uuid,
    ) -> Result<uuid::Uuid, crate::database::DatabaseError> {
        let row = sqlx::query(
            r#"
            INSERT INTO server_allocations (server_uuid, allocation_uuid)
            VALUES ($1, $2)
            RETURNING uuid
            "#,
        )
        .bind(server_uuid)
        .bind(allocation_uuid)
        .fetch_one(database.write())
        .await?;

        Ok(row.try_get("uuid")?)
    }

    pub async fn create_random(
        database: &crate::database::Database,
        server: &super::server::Server,
    ) -> Result<uuid::Uuid, crate::database::DatabaseError> {
        let egg_configuration = server.egg.configuration(database).await?;

        let Some(config_allocations) = egg_configuration.config_allocations else {
            return Err(anyhow::Error::new(
                crate::response::DisplayError::new(
                    "no egg allocation configuration found, cannot auto-assign allocation",
                )
                .with_status(StatusCode::EXPECTATION_FAILED),
            )
            .into());
        };

        let row = sqlx::query(
            r#"
            INSERT INTO server_allocations (server_uuid, allocation_uuid)
            VALUES ($1, (
                SELECT node_allocations.uuid FROM node_allocations
                LEFT JOIN server_allocations ON server_allocations.allocation_uuid = node_allocations.uuid
                WHERE
                    node_allocations.node_uuid = $2
                    AND ($3 IS NULL OR node_allocations.ip = $3)
                    AND node_allocations.port BETWEEN $4 AND $5
                    AND server_allocations.uuid IS NULL
                ORDER BY RANDOM()
                LIMIT 1
            ))
            RETURNING uuid
            "#,
        )
        .bind(server.uuid)
        .bind(server.node.uuid)
        .bind(server.allocation.as_ref().map(|a| a.allocation.ip))
        .bind(config_allocations.user_self_assign.start_port as i32)
        .bind(config_allocations.user_self_assign.end_port as i32)
        .fetch_one(database.write())
        .await?;

        Ok(row.get("uuid"))
    }

    pub async fn by_uuid(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM server_allocations
            JOIN node_allocations ON server_allocations.allocation_uuid = node_allocations.uuid
            WHERE server_allocations.uuid = $1
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
        allocation_uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM server_allocations
            JOIN node_allocations ON server_allocations.allocation_uuid = node_allocations.uuid
            WHERE server_allocations.server_uuid = $1 AND server_allocations.uuid = $2
            "#,
            Self::columns_sql(None)
        ))
        .bind(server_uuid)
        .bind(allocation_uuid)
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
            FROM server_allocations
            JOIN node_allocations ON server_allocations.allocation_uuid = node_allocations.uuid
            WHERE server_allocations.server_uuid = $1
                AND ($2 IS NULL OR host(node_allocations.ip) || ':' || node_allocations.port ILIKE '%' || $2 || '%' OR server_allocations.notes ILIKE '%' || $2 || '%')
            ORDER BY server_allocations.created
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
            FROM server_allocations
            JOIN node_allocations ON server_allocations.allocation_uuid = node_allocations.uuid
            WHERE server_allocations.server_uuid = $1
            ORDER BY server_allocations.created
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
            FROM server_allocations
            WHERE server_allocations.server_uuid = $1
            "#,
        )
        .bind(server_uuid)
        .fetch_one(database.read())
        .await
        .unwrap_or(0)
    }
}

#[async_trait::async_trait]
impl IntoApiObject for ServerAllocation {
    type ApiObject = ApiServerAllocation;
    type ExtraArgs<'a> = Option<uuid::Uuid>;

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        primary: Self::ExtraArgs<'a>,
    ) -> Result<Self::ApiObject, crate::database::DatabaseError> {
        let api_object = ApiServerAllocation::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            ApiServerAllocation {
                uuid: self.uuid,
                ip: compact_str::format_compact!("{}", self.allocation.ip.ip()),
                ip_alias: self.allocation.ip_alias,
                port: self.allocation.port,
                notes: self.notes,
                is_primary: primary.is_some_and(|p| p == self.uuid),
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[async_trait::async_trait]
impl DeletableModel for ServerAllocation {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteListenerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteListenerList<ServerAllocation>> =
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
            DELETE FROM server_allocations
            WHERE server_allocations.uuid = $1
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
#[init_args(ServerAllocation, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "ServerAllocation")]
pub struct ApiServerAllocation {
    pub uuid: uuid::Uuid,

    pub ip: compact_str::CompactString,
    pub ip_alias: Option<compact_str::CompactString>,
    pub port: i32,

    pub notes: Option<compact_str::CompactString>,
    pub is_primary: bool,

    pub created: chrono::DateTime<chrono::Utc>,
}
