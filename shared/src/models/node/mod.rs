use crate::{
    models::{
        CreatableModel, CreateListenerList, InsertQueryBuilder, UpdatableModel, UpdateListenerList,
        UpdateQueryBuilder,
    },
    prelude::*,
};
use compact_str::ToCompactString;
use garde::Validate;
use rand::distr::SampleString;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{
    collections::{BTreeMap, HashMap},
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

mod events;
pub use events::NodeEvent;

pub type GetNode = crate::extract::ConsumingExtension<Node>;

#[derive(Serialize, Deserialize, Clone)]
pub struct Node {
    pub uuid: uuid::Uuid,
    pub location: super::location::Location,
    pub backup_configuration: Option<Fetchable<super::backup_configuration::BackupConfiguration>>,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,

    pub deployment_enabled: bool,
    pub maintenance_enabled: bool,

    pub public_url: Option<reqwest::Url>,
    pub url: reqwest::Url,
    pub sftp_host: Option<compact_str::CompactString>,
    pub sftp_port: i32,

    pub memory: i64,
    pub disk: i64,

    pub token_id: compact_str::CompactString,
    pub token: Vec<u8>,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for Node {
    const NAME: &'static str = "node";

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
            ("nodes.uuid", compact_str::format_compact!("{prefix}uuid")),
            (
                "nodes.backup_configuration_uuid",
                compact_str::format_compact!("{prefix}node_backup_configuration_uuid"),
            ),
            ("nodes.name", compact_str::format_compact!("{prefix}name")),
            (
                "nodes.description",
                compact_str::format_compact!("{prefix}description"),
            ),
            (
                "nodes.deployment_enabled",
                compact_str::format_compact!("{prefix}deployment_enabled"),
            ),
            (
                "nodes.maintenance_enabled",
                compact_str::format_compact!("{prefix}maintenance_enabled"),
            ),
            (
                "nodes.public_url",
                compact_str::format_compact!("{prefix}public_url"),
            ),
            ("nodes.url", compact_str::format_compact!("{prefix}url")),
            (
                "nodes.sftp_host",
                compact_str::format_compact!("{prefix}sftp_host"),
            ),
            (
                "nodes.sftp_port",
                compact_str::format_compact!("{prefix}sftp_port"),
            ),
            (
                "nodes.memory",
                compact_str::format_compact!("{prefix}memory"),
            ),
            ("nodes.disk", compact_str::format_compact!("{prefix}disk")),
            (
                "nodes.token_id",
                compact_str::format_compact!("{prefix}token_id"),
            ),
            ("nodes.token", compact_str::format_compact!("{prefix}token")),
            (
                "nodes.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ]);

        columns.extend(super::location::Location::base_columns(Some("location_")));

        columns
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            uuid: row.try_get(compact_str::format_compact!("{prefix}uuid").as_str())?,
            location: super::location::Location::map(Some("location_"), row)?,
            backup_configuration:
                super::backup_configuration::BackupConfiguration::get_fetchable_from_row(
                    row,
                    compact_str::format_compact!("{prefix}node_backup_configuration_uuid"),
                ),
            name: row.try_get(compact_str::format_compact!("{prefix}name").as_str())?,
            description: row
                .try_get(compact_str::format_compact!("{prefix}description").as_str())?,
            deployment_enabled: row
                .try_get(compact_str::format_compact!("{prefix}deployment_enabled").as_str())?,
            maintenance_enabled: row
                .try_get(compact_str::format_compact!("{prefix}maintenance_enabled").as_str())?,
            public_url: row
                .try_get::<Option<String>, _>(
                    compact_str::format_compact!("{prefix}public_url").as_str(),
                )?
                .try_map(|url| url.parse())
                .map_err(anyhow::Error::new)?,
            url: row
                .try_get::<String, _>(compact_str::format_compact!("{prefix}url").as_str())?
                .parse()
                .map_err(anyhow::Error::new)?,
            sftp_host: row.try_get(compact_str::format_compact!("{prefix}sftp_host").as_str())?,
            sftp_port: row.try_get(compact_str::format_compact!("{prefix}sftp_port").as_str())?,
            memory: row.try_get(compact_str::format_compact!("{prefix}memory").as_str())?,
            disk: row.try_get(compact_str::format_compact!("{prefix}disk").as_str())?,
            token_id: row.try_get(compact_str::format_compact!("{prefix}token_id").as_str())?,
            token: row.try_get(compact_str::format_compact!("{prefix}token").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl Node {
    pub const AIO_NODE_UUID: uuid::Uuid = uuid::uuid!("7dbbbb63-1734-48c4-e1de-d1a65f62cada");

    pub async fn by_token_id_token_cached(
        database: &crate::database::Database,
        token_id: &str,
        token: &str,
    ) -> Result<Option<Self>, anyhow::Error> {
        database
            .cache
            .cached(&format!("node::token::{token_id}.{token}"), 10, || async {
                let row = sqlx::query(&format!(
                    r#"
                    SELECT {}
                    FROM nodes
                    JOIN locations ON locations.uuid = nodes.location_uuid
                    WHERE nodes.token_id = $1
                    "#,
                    Self::columns_sql(None)
                ))
                .bind(token_id)
                .fetch_optional(database.read())
                .await?;

                Ok::<_, anyhow::Error>(
                    if let Some(node) = row.try_map(|row| Self::map(None, &row))? {
                        if constant_time_eq::constant_time_eq(
                            database.decrypt(node.token.clone()).await?.as_bytes(),
                            token.as_bytes(),
                        ) {
                            Some(node)
                        } else {
                            None
                        }
                    } else {
                        None
                    },
                )
            })
            .await
    }

    pub async fn by_location_uuid_with_pagination(
        database: &crate::database::Database,
        location_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(&format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM nodes
            JOIN locations ON locations.uuid = nodes.location_uuid
            WHERE nodes.location_uuid = $1 AND ($2 IS NULL OR nodes.name ILIKE '%' || $2 || '%')
            ORDER BY nodes.created
            LIMIT $3 OFFSET $4
            "#,
            Self::columns_sql(None)
        ))
        .bind(location_uuid)
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

    pub async fn by_backup_configuration_uuid_with_pagination(
        database: &crate::database::Database,
        backup_configuration_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(&format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM nodes
            JOIN locations ON locations.uuid = nodes.location_uuid
            WHERE nodes.backup_configuration_uuid = $1 AND ($2 IS NULL OR nodes.name ILIKE '%' || $2 || '%')
            ORDER BY nodes.created
            LIMIT $3 OFFSET $4
            "#,
            Self::columns_sql(None)
        ))
        .bind(backup_configuration_uuid)
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
            FROM nodes
            JOIN locations ON locations.uuid = nodes.location_uuid
            WHERE $1 IS NULL OR nodes.name ILIKE '%' || $1 || '%'
            ORDER BY nodes.created
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

    pub async fn by_location_uuids_most_eligible(
        database: &crate::database::Database,
        location_uuids: &[uuid::Uuid],
        limits: super::server::AdminApiServerLimits,
        allow_overallocation: bool,
    ) -> Result<Vec<Self>, crate::database::DatabaseError> {
        let rows = sqlx::query(&format!(
            r#"
            WITH server_usage AS (
                SELECT
                    node_uuid,
                    COALESCE(SUM(memory), 0)::BIGINT AS used_memory,
                    COALESCE(SUM(disk), 0)::BIGINT AS used_disk
                FROM servers
                GROUP BY node_uuid
            )
            SELECT {}
            FROM nodes
            JOIN locations ON locations.uuid = nodes.location_uuid
            LEFT JOIN server_usage u ON nodes.uuid = u.node_uuid
            WHERE nodes.location_uuid = ANY($1) AND nodes.deployment_enabled
            AND $4 OR (COALESCE(u.used_memory, 0) + $2 <= nodes.memory AND COALESCE(u.used_disk, 0) + $3 <= nodes.disk)
            ORDER BY
                (
                    GREATEST(COALESCE(u.used_memory, 0) + $2 - nodes.memory, 0) + 
                    GREATEST(COALESCE(u.used_disk, 0) + $3 - nodes.disk, 0)
                ),
                GREATEST(
                    (COALESCE(u.used_memory, 0) + $2)::FLOAT / NULLIF(nodes.memory, 0), 
                    (COALESCE(u.used_disk, 0) + $3)::FLOAT / NULLIF(nodes.disk, 0)
                )
            "#,
            Self::columns_sql(None),
        ))
        .bind(location_uuids)
        .bind(limits.memory)
        .bind(limits.disk)
        .bind(allow_overallocation)
        .fetch_all(database.read())
        .await?;

        rows.into_iter()
            .map(|row| Self::map(None, &row))
            .try_collect_vec()
    }

    pub async fn by_name(
        database: &crate::database::Database,
        name: &str,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}
            FROM nodes
            JOIN locations ON locations.uuid = nodes.location_uuid
            WHERE nodes.name = $1
            "#,
            Self::columns_sql(None)
        ))
        .bind(name)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn count_by_location_uuid(
        database: &crate::database::Database,
        location_uuid: uuid::Uuid,
    ) -> i64 {
        sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM nodes
            WHERE nodes.location_uuid = $1
            "#,
        )
        .bind(location_uuid)
        .fetch_one(database.read())
        .await
        .unwrap_or(0)
    }

    /// Fetch the current configuration of this node
    ///
    /// Cached for 120 seconds.
    pub async fn fetch_configuration(
        &self,
        database: &crate::database::Database,
    ) -> Result<wings_api::Config, anyhow::Error> {
        database
            .cache
            .cached(
                &format!("node::{}::configuration", self.uuid),
                120,
                || async {
                    Ok::<_, anyhow::Error>(
                        self.api_client(database).await?.get_system_config().await?,
                    )
                },
            )
            .await
    }

    /// Fetch the current resource usages of all servers on this node.
    ///
    /// Cached for 15 seconds.
    pub async fn fetch_server_resources(
        &self,
        database: &crate::database::Database,
    ) -> Result<HashMap<uuid::Uuid, wings_api::ResourceUsage>, anyhow::Error> {
        database
            .cache
            .cached(
                &format!("node::{}::server_resources", self.uuid),
                15,
                || async {
                    let resources = self
                        .api_client(database)
                        .await?
                        .get_servers_utilization()
                        .await?;

                    Ok::<_, anyhow::Error>(resources.into_iter().collect())
                },
            )
            .await
    }

    pub async fn reset_token(
        &self,
        state: &crate::State,
    ) -> Result<(String, String), anyhow::Error> {
        let token_id = rand::distr::Alphanumeric.sample_string(&mut rand::rng(), 16);
        let token = rand::distr::Alphanumeric.sample_string(&mut rand::rng(), 64);

        sqlx::query(
            r#"
            UPDATE nodes
            SET token_id = $2, token = $3
            WHERE nodes.uuid = $1
            "#,
        )
        .bind(self.uuid)
        .bind(&token_id)
        .bind(state.database.encrypt(token.clone()).await?)
        .execute(state.database.write())
        .await?;

        Self::get_event_emitter().emit(
            state.clone(),
            NodeEvent::TokenReset {
                node: Box::new(self.clone()),
                token_id: token_id.clone(),
                token: token.clone(),
            },
        );

        Ok((token_id, token))
    }

    #[inline]
    pub fn is_all_in_one_node(&self) -> bool {
        self.uuid == Self::AIO_NODE_UUID
    }

    #[inline]
    pub fn url(&self, path: &str) -> reqwest::Url {
        let mut url = self.url.clone();
        url.path_segments_mut()
            .unwrap()
            .extend(path.trim_start_matches('/').split('/'));
        url
    }

    #[inline]
    pub async fn public_url(
        &self,
        state: &crate::State,
        path: &str,
    ) -> Result<reqwest::Url, anyhow::Error> {
        let mut url = if self.is_all_in_one_node() {
            let mut url = state
                .settings
                .get_as(|s| reqwest::Url::parse(&s.app.url))
                .await??;
            url.path_segments_mut()
                .unwrap()
                .extend(&["wings-proxy", &self.uuid.to_compact_string()]);
            url
        } else {
            self.public_url.clone().unwrap_or(self.url.clone())
        };

        url.path_segments_mut()
            .unwrap()
            .extend(path.trim_start_matches('/').split('/'));

        Ok(url)
    }

    #[inline]
    pub async fn api_client(
        &self,
        database: &crate::database::Database,
    ) -> Result<wings_api::client::WingsClient, anyhow::Error> {
        Ok(wings_api::client::WingsClient::new(
            self.url.to_string(),
            database.decrypt(self.token.to_vec()).await?.into(),
        ))
    }

    #[inline]
    pub fn create_jwt<T: Serialize>(
        &self,
        database: &crate::database::Database,
        jwt: &crate::jwt::Jwt,
        payload: &T,
    ) -> Result<String, jsonwebtoken::errors::Error> {
        jwt.create_custom(
            database.blocking_decrypt(&self.token).unwrap().as_bytes(),
            payload,
        )
    }
}

#[async_trait::async_trait]
impl IntoAdminApiObject for Node {
    type AdminApiObject = AdminApiNode;
    type ExtraArgs<'a> = ();

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiNode::init_hooks(&self, state).await?;

        let public_url = if self.is_all_in_one_node() {
            Some(self.public_url(state, "/").await?.to_string())
        } else {
            self.public_url.map(|url| url.to_string())
        };

        let (location, backup_configuration) =
            tokio::join!(self.location.into_admin_api_object(state, ()), async {
                if let Some(backup_configuration) = self.backup_configuration {
                    if let Ok(backup_configuration) =
                        backup_configuration.fetch_cached(&state.database).await
                    {
                        backup_configuration
                            .into_admin_api_object(state, ())
                            .await
                            .ok()
                    } else {
                        None
                    }
                } else {
                    None
                }
            });

        let api_object = finish_extendible!(
            AdminApiNode {
                uuid: self.uuid,
                location: location?,
                backup_configuration,
                name: self.name,
                description: self.description,
                deployment_enabled: self.deployment_enabled,
                maintenance_enabled: self.maintenance_enabled,
                public_url,
                url: self.url.to_string(),
                sftp_host: self.sftp_host,
                sftp_port: self.sftp_port,
                memory: self.memory,
                disk: self.disk,
                token_id: self.token_id,
                token: state.database.decrypt(self.token).await?,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[async_trait::async_trait]
impl ByUuid for Node {
    async fn by_uuid(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
    ) -> Result<Self, crate::database::DatabaseError> {
        let row = sqlx::query(&format!(
            r#"
            SELECT {}, {}
            FROM nodes
            JOIN locations ON locations.uuid = nodes.location_uuid
            WHERE nodes.uuid = $1
            "#,
            Self::columns_sql(None),
            super::location::Location::columns_sql(Some("location_")),
        ))
        .bind(uuid)
        .fetch_one(database.read())
        .await?;

        Self::map(None, &row)
    }
}

#[derive(ToSchema, Deserialize, Validate)]
pub struct CreateNodeOptions {
    #[garde(skip)]
    pub location_uuid: uuid::Uuid,
    #[garde(skip)]
    pub backup_configuration_uuid: Option<uuid::Uuid>,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: compact_str::CompactString,
    #[garde(length(chars, min = 1, max = 1024))]
    #[schema(min_length = 1, max_length = 1024)]
    pub description: Option<compact_str::CompactString>,
    #[garde(skip)]
    pub deployment_enabled: bool,
    #[garde(skip)]
    pub maintenance_enabled: bool,
    #[garde(length(chars, min = 3, max = 255), url)]
    #[schema(min_length = 3, max_length = 255, format = "uri")]
    pub public_url: Option<compact_str::CompactString>,
    #[garde(length(chars, min = 3, max = 255), url)]
    #[schema(min_length = 3, max_length = 255, format = "uri")]
    pub url: compact_str::CompactString,
    #[garde(length(chars, min = 3, max = 255))]
    #[schema(min_length = 3, max_length = 255)]
    pub sftp_host: Option<compact_str::CompactString>,
    #[garde(range(min = 1))]
    #[schema(minimum = 1)]
    pub sftp_port: u16,
    #[garde(range(min = 1))]
    #[schema(minimum = 1)]
    pub memory: i64,
    #[garde(range(min = 1))]
    #[schema(minimum = 1)]
    pub disk: i64,
}

#[async_trait::async_trait]
impl CreatableModel for Node {
    type CreateOptions<'a> = CreateNodeOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<Node>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        let mut transaction = state.database.write().begin().await?;

        if let Some(backup_configuration_uuid) = &options.backup_configuration_uuid {
            super::backup_configuration::BackupConfiguration::by_uuid_optional(
                &state.database,
                *backup_configuration_uuid,
            )
            .await?
            .ok_or(crate::database::InvalidRelationError(
                "backup_configuration",
            ))?;
        }

        let mut query_builder = InsertQueryBuilder::new("nodes");

        Self::run_create_handlers(&mut options, &mut query_builder, state, &mut transaction)
            .await?;

        let token_id = rand::distr::Alphanumeric.sample_string(&mut rand::rng(), 16);
        let token = rand::distr::Alphanumeric.sample_string(&mut rand::rng(), 64);

        query_builder
            .set("location_uuid", options.location_uuid)
            .set(
                "backup_configuration_uuid",
                options.backup_configuration_uuid,
            )
            .set("name", &options.name)
            .set("description", &options.description)
            .set("deployment_enabled", options.deployment_enabled)
            .set("maintenance_enabled", options.maintenance_enabled)
            .set("public_url", &options.public_url)
            .set("url", &options.url)
            .set("sftp_host", &options.sftp_host)
            .set("sftp_port", options.sftp_port as i32)
            .set("memory", options.memory)
            .set("disk", options.disk)
            .set("token_id", token_id.clone())
            .set("token", state.database.encrypt(token.clone()).await?);

        let row = query_builder
            .returning("uuid")
            .fetch_one(&mut *transaction)
            .await?;
        let uuid: uuid::Uuid = row.get("uuid");

        transaction.commit().await?;

        Self::by_uuid(&state.database, uuid).await
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Clone, Default)]
pub struct UpdateNodeOptions {
    #[garde(skip)]
    pub location_uuid: Option<uuid::Uuid>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    #[garde(skip)]
    pub backup_configuration_uuid: Option<Option<uuid::Uuid>>,
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
    pub deployment_enabled: Option<bool>,
    #[garde(skip)]
    pub maintenance_enabled: Option<bool>,
    #[garde(length(chars, min = 3, max = 255), url)]
    #[schema(min_length = 3, max_length = 255, format = "uri")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub public_url: Option<Option<compact_str::CompactString>>,
    #[garde(length(chars, min = 3, max = 255), url)]
    #[schema(min_length = 3, max_length = 255, format = "uri")]
    pub url: Option<compact_str::CompactString>,
    #[garde(length(chars, min = 3, max = 255))]
    #[schema(min_length = 3, max_length = 255)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub sftp_host: Option<Option<compact_str::CompactString>>,
    #[garde(range(min = 1))]
    #[schema(minimum = 1)]
    pub sftp_port: Option<u16>,
    #[garde(range(min = 1))]
    #[schema(minimum = 1)]
    pub memory: Option<i64>,
    #[garde(range(min = 1))]
    #[schema(minimum = 1)]
    pub disk: Option<i64>,
}

#[async_trait::async_trait]
impl UpdatableModel for Node {
    type UpdateOptions = UpdateNodeOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateListenerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateListenerList<Node>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &UPDATE_LISTENERS
    }

    async fn update(
        &mut self,
        state: &crate::State,
        mut options: Self::UpdateOptions,
    ) -> Result<(), crate::database::DatabaseError> {
        options.validate()?;

        let location = if let Some(location_uuid) = options.location_uuid {
            Some(
                super::location::Location::by_uuid_optional(&state.database, location_uuid)
                    .await?
                    .ok_or(crate::database::InvalidRelationError("location"))?,
            )
        } else {
            None
        };

        let backup_configuration =
            if let Some(backup_configuration_uuid) = &options.backup_configuration_uuid {
                match backup_configuration_uuid {
                    Some(uuid) => {
                        super::backup_configuration::BackupConfiguration::by_uuid_optional(
                            &state.database,
                            *uuid,
                        )
                        .await?
                        .ok_or(crate::database::InvalidRelationError(
                            "backup_configuration",
                        ))?;

                        Some(Some(
                            super::backup_configuration::BackupConfiguration::get_fetchable(*uuid),
                        ))
                    }
                    None => Some(None),
                }
            } else {
                None
            };

        let mut transaction = state.database.write().begin().await?;

        let mut query_builder = UpdateQueryBuilder::new("nodes");

        Self::run_update_handlers(
            self,
            &mut options,
            &mut query_builder,
            state,
            &mut transaction,
        )
        .await?;

        query_builder
            .set("location_uuid", options.location_uuid.as_ref())
            .set(
                "backup_configuration_uuid",
                options
                    .backup_configuration_uuid
                    .as_ref()
                    .map(|u| u.as_ref()),
            )
            .set("name", options.name.as_ref())
            .set(
                "description",
                options.description.as_ref().map(|d| d.as_ref()),
            )
            .set("deployment_enabled", options.deployment_enabled)
            .set("maintenance_enabled", options.maintenance_enabled)
            .set(
                "public_url",
                options.public_url.as_ref().map(|u| u.as_ref()),
            )
            .set("url", options.url.as_ref())
            .set("sftp_host", options.sftp_host.as_ref().map(|h| h.as_ref()))
            .set("sftp_port", options.sftp_port.as_ref().map(|p| *p as i32))
            .set("memory", options.memory.as_ref())
            .set("disk", options.disk.as_ref())
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut *transaction).await?;

        if let Some(location) = location {
            self.location = location;
        }
        if let Some(backup_configuration) = backup_configuration {
            self.backup_configuration = backup_configuration;
        }
        if let Some(name) = options.name {
            self.name = name;
        }
        if let Some(description) = options.description {
            self.description = description;
        }
        if let Some(deployment_enabled) = options.deployment_enabled {
            self.deployment_enabled = deployment_enabled;
        }
        if let Some(maintenance_enabled) = options.maintenance_enabled {
            self.maintenance_enabled = maintenance_enabled;
        }
        if let Some(public_url) = options.public_url {
            self.public_url = public_url
                .try_map(|url| url.parse())
                .map_err(anyhow::Error::new)?;
        }
        if let Some(url) = options.url {
            self.url = url.parse().map_err(anyhow::Error::new)?;
        }
        if let Some(sftp_host) = options.sftp_host {
            self.sftp_host = sftp_host;
        }
        if let Some(sftp_port) = options.sftp_port {
            self.sftp_port = sftp_port as i32;
        }
        if let Some(memory) = options.memory {
            self.memory = memory;
        }
        if let Some(disk) = options.disk {
            self.disk = disk;
        }

        transaction.commit().await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl DeletableModel for Node {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteListenerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteListenerList<Node>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &DELETE_LISTENERS
    }

    async fn delete(
        &self,
        state: &crate::State,
        options: Self::DeleteOptions,
    ) -> Result<(), anyhow::Error> {
        if self.is_all_in_one_node() && state.container_type.is_all_in_one() {
            return Err(anyhow::anyhow!("The AIO node cannot be deleted"));
        }

        let mut transaction = state.database.write().begin().await?;

        self.run_delete_handlers(&options, state, &mut transaction)
            .await?;

        sqlx::query(
            r#"
            DELETE FROM nodes
            WHERE nodes.uuid = $1
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
#[init_args(Node, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "Node")]
pub struct AdminApiNode {
    pub uuid: uuid::Uuid,
    pub location: super::location::AdminApiLocation,
    pub backup_configuration: Option<super::backup_configuration::AdminApiBackupConfiguration>,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,

    pub deployment_enabled: bool,
    pub maintenance_enabled: bool,

    #[schema(format = "uri")]
    pub public_url: Option<String>,
    #[schema(format = "uri")]
    pub url: String,
    pub sftp_host: Option<compact_str::CompactString>,
    pub sftp_port: i32,

    pub memory: i64,
    pub disk: i64,

    pub token_id: compact_str::CompactString,
    pub token: compact_str::CompactString,

    pub created: chrono::DateTime<chrono::Utc>,
}
