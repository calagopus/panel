use crate::{
    models::{InsertQueryBuilder, UpdateQueryBuilder},
    prelude::*,
    tunnel::{MAX_SERVER_IDX, TunnelProtocol},
};
use garde::Validate;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{
    collections::{BTreeMap, HashMap, HashSet},
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

const ADVISORY_LOCK_IDX: i64 = 0x7475_6e6e_656c_0001;

fn validate_name(name: &compact_str::CompactString, _context: &()) -> Result<(), garde::Error> {
    if name.is_empty() || name.len() > 63 {
        return Err(garde::Error::new("name must be 1 to 63 characters"));
    }

    if !name
        .bytes()
        .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
    {
        return Err(garde::Error::new(
            "name must only contain lowercase letters, digits and dashes",
        ));
    }

    if name.starts_with('-') || name.ends_with('-') {
        return Err(garde::Error::new("name must not start or end with a dash"));
    }

    if crate::tunnel::is_alias_shaped(name) {
        return Err(garde::Error::new(
            "name must not be eight hexadecimal characters, which is reserved for the address every server keeps",
        ));
    }

    Ok(())
}

pub fn validate_optional_name(
    name: &Option<compact_str::CompactString>,
    context: &(),
) -> Result<(), garde::Error> {
    match name {
        Some(name) => validate_name(name, context),
        None => Ok(()),
    }
}

fn validate_protocols(
    protocols: &HashSet<TunnelProtocol>,
    _context: &(),
) -> Result<(), garde::Error> {
    if protocols.is_empty() {
        return Err(garde::Error::new("at least one protocol is required"));
    }

    Ok(())
}

#[derive(Serialize, Deserialize)]
pub struct ServerTunnel {
    pub server: Fetchable<super::server::Server>,

    pub idx: u16,
    pub name: compact_str::CompactString,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for ServerTunnel {
    const NAME: &'static str = "server_tunnel";

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
                "server_tunnels.server_uuid",
                compact_str::format_compact!("{prefix}server_uuid"),
            ),
            (
                "server_tunnels.idx",
                compact_str::format_compact!("{prefix}idx"),
            ),
            (
                "server_tunnels.name",
                compact_str::format_compact!("{prefix}name"),
            ),
            (
                "server_tunnels.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ])
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            server: super::server::Server::get_fetchable(
                row.try_get(compact_str::format_compact!("{prefix}server_uuid").as_str())?,
            ),
            idx: row.try_get::<i32, _>(compact_str::format_compact!("{prefix}idx").as_str())?
                as u16,
            name: row.try_get(compact_str::format_compact!("{prefix}name").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl ServerTunnel {
    pub async fn by_server_uuid(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM server_tunnels
            WHERE server_tunnels.server_uuid = $1
            "#,
            Self::columns_sql(None)
        )))
        .bind(server_uuid)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    async fn allocate_idx(
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<i32, crate::database::DatabaseError> {
        sqlx::query("SELECT pg_advisory_xact_lock($1)")
            .bind(ADVISORY_LOCK_IDX)
            .execute(&mut **transaction)
            .await?;

        let idx: Option<i32> = sqlx::query_scalar(
            r#"
            SELECT candidate.idx
            FROM generate_series(0, $1) AS candidate(idx)
            WHERE NOT EXISTS (
                SELECT 1 FROM server_tunnels WHERE server_tunnels.idx = candidate.idx
            )
            ORDER BY candidate.idx
            LIMIT 1
            "#,
        )
        .bind(i32::from(MAX_SERVER_IDX))
        .fetch_optional(&mut **transaction)
        .await?;

        idx.ok_or_else(|| {
            crate::database::DatabaseError::Any(anyhow::anyhow!(
                "the tunnel network is full, no frontend index is available"
            ))
        })
    }

    pub async fn ports(
        &self,
        database: &crate::database::Database,
    ) -> Result<Vec<ServerTunnelPort>, crate::database::DatabaseError> {
        ServerTunnelPort::by_server_uuid(database, self.server.uuid).await
    }

    pub fn suggest_name(server_name: &str) -> compact_str::CompactString {
        let mut base = String::with_capacity(server_name.len());
        for character in server_name.chars() {
            match character {
                'a'..='z' | '0'..='9' => base.push(character),
                'A'..='Z' => base.push(character.to_ascii_lowercase()),
                _ if !base.ends_with('-') => base.push('-'),
                _ => {}
            }
        }

        let base: String = base.trim_matches('-').chars().take(58).collect();
        let base = base.trim_matches('-');
        let base = if base.is_empty() { "server" } else { base };

        if crate::tunnel::is_alias_shaped(base) {
            compact_str::format_compact!("{base}-1")
        } else {
            base.into()
        }
    }
}

#[derive(ToSchema, Serialize, Deserialize)]
pub struct ServerTunnelPort {
    pub port: u16,
    pub protocols: HashSet<TunnelProtocol>,

    pub created: chrono::DateTime<chrono::Utc>,
}

impl ServerTunnelPort {
    pub async fn by_server_uuid(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
    ) -> Result<Vec<Self>, crate::database::DatabaseError> {
        sqlx::query(
            r#"
            SELECT server_tunnel_ports.port, server_tunnel_ports.protocols, server_tunnel_ports.created
            FROM server_tunnel_ports
            WHERE server_tunnel_ports.server_uuid = $1
            ORDER BY server_tunnel_ports.port
            "#,
        )
        .bind(server_uuid)
        .fetch_all(database.read())
        .await?
        .into_iter()
        .map(|row| {
            Ok(Self {
                port: row.try_get::<i32, _>("port")? as u16,
                protocols: row
                    .try_get::<Vec<TunnelProtocol>, _>("protocols")?
                    .into_iter()
                    .collect(),
                created: row.try_get::<chrono::NaiveDateTime, _>("created")?.and_utc(),
            })
        })
        .try_collect_vec()
    }

    pub async fn by_server_uuids(
        database: &crate::database::Database,
        server_uuids: &[uuid::Uuid],
    ) -> Result<HashMap<uuid::Uuid, Vec<Self>>, crate::database::DatabaseError> {
        let mut ports: HashMap<uuid::Uuid, Vec<Self>> = HashMap::new();

        for row in sqlx::query(
            r#"
            SELECT server_tunnel_ports.server_uuid, server_tunnel_ports.port, server_tunnel_ports.protocols, server_tunnel_ports.created
            FROM server_tunnel_ports
            WHERE server_tunnel_ports.server_uuid = ANY($1)
            ORDER BY server_tunnel_ports.port
            "#,
        )
        .bind(server_uuids)
        .fetch_all(database.read())
        .await?
        {
            ports
                .entry(row.try_get("server_uuid")?)
                .or_default()
                .push(Self {
                    port: row.try_get::<i32, _>("port")? as u16,
                    protocols: row
                        .try_get::<Vec<TunnelProtocol>, _>("protocols")?
                        .into_iter()
                        .collect(),
                    created: row.try_get::<chrono::NaiveDateTime, _>("created")?.and_utc(),
                });
        }

        Ok(ports)
    }

    pub async fn replace(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
        ports: &[CreateServerTunnelPortOptions],
    ) -> Result<(), crate::database::DatabaseError> {
        for port in ports {
            port.validate()?;
        }

        let mut transaction = database.write().begin().await?;

        sqlx::query("DELETE FROM server_tunnel_ports WHERE server_tunnel_ports.server_uuid = $1")
            .bind(server_uuid)
            .execute(&mut *transaction)
            .await?;

        for port in ports {
            sqlx::query(
                r#"
                INSERT INTO server_tunnel_ports (server_uuid, port, protocols)
                VALUES ($1, $2, $3)
                ON CONFLICT (server_uuid, port) DO UPDATE SET protocols = EXCLUDED.protocols
                "#,
            )
            .bind(server_uuid)
            .bind(i32::from(port.port))
            .bind(port.protocols.iter().copied().collect::<Vec<_>>())
            .execute(&mut *transaction)
            .await?;
        }

        crate::tunnel::bump_epoch(&mut *transaction).await?;
        transaction.commit().await?;

        Ok(())
    }
}

#[derive(ToSchema, Serialize)]
#[schema(title = "ServerTunnelPeer")]
pub struct ServerTunnelPeer {
    pub server_uuid: uuid::Uuid,
    pub server_name: compact_str::CompactString,

    pub name: compact_str::CompactString,
    pub alias: compact_str::CompactString,
    pub address: Option<compact_str::CompactString>,
    pub ports: Vec<ServerTunnelPort>,

    pub created: chrono::DateTime<chrono::Utc>,
}

#[derive(ToSchema, Deserialize, Validate)]
pub struct CreateServerTunnelPortOptions {
    #[garde(range(min = 1))]
    #[schema(minimum = 1)]
    pub port: u16,
    #[garde(custom(validate_protocols))]
    pub protocols: HashSet<TunnelProtocol>,
}

pub struct ServerTunnelConnection;

impl ServerTunnelConnection {
    pub async fn by_src_server_uuid(
        database: &crate::database::Database,
        src_server_uuid: uuid::Uuid,
    ) -> Result<Vec<uuid::Uuid>, crate::database::DatabaseError> {
        Ok(sqlx::query_scalar(
            r#"
            SELECT server_tunnel_connections.dst_server_uuid
            FROM server_tunnel_connections
            WHERE server_tunnel_connections.src_server_uuid = $1
            "#,
        )
        .bind(src_server_uuid)
        .fetch_all(database.read())
        .await?)
    }

    pub async fn peers(
        database: &crate::database::Database,
        server_uuid: uuid::Uuid,
        incoming: bool,
    ) -> Result<Vec<ServerTunnelPeer>, crate::database::DatabaseError> {
        let (own, peer) = if incoming {
            ("dst_server_uuid", "src_server_uuid")
        } else {
            ("src_server_uuid", "dst_server_uuid")
        };

        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT
                server_tunnels.server_uuid,
                server_tunnels.idx,
                server_tunnels.name,
                servers.name AS server_name,
                servers.uuid_short,
                server_tunnel_connections.created
            FROM server_tunnel_connections
            JOIN server_tunnels ON server_tunnels.server_uuid = server_tunnel_connections.{peer}
            JOIN servers ON servers.uuid = server_tunnels.server_uuid
            WHERE server_tunnel_connections.{own} = $1
            ORDER BY server_tunnels.name
            "#
        )))
        .bind(server_uuid)
        .fetch_all(database.read())
        .await?;

        let peer_uuids = rows
            .iter()
            .map(|row| row.try_get("server_uuid"))
            .collect::<Result<Vec<uuid::Uuid>, _>>()?;
        let mut ports = ServerTunnelPort::by_server_uuids(database, &peer_uuids).await?;

        let mut peers = Vec::with_capacity(rows.len());
        for (row, server_uuid) in rows.into_iter().zip(peer_uuids) {
            peers.push(ServerTunnelPeer {
                server_uuid,
                server_name: row.try_get("server_name")?,
                name: row.try_get("name")?,
                alias: crate::tunnel::alias_of(row.try_get("uuid_short")?),
                address: crate::tunnel::frontend_address(row.try_get::<i32, _>("idx")? as u16),
                ports: ports.remove(&server_uuid).unwrap_or_default(),
                created: row
                    .try_get::<chrono::NaiveDateTime, _>("created")?
                    .and_utc(),
            });
        }

        Ok(peers)
    }

    pub async fn colliding_ports(
        database: &crate::database::Database,
        src_server_uuid: uuid::Uuid,
        dst_server_uuid: uuid::Uuid,
    ) -> Result<Vec<u16>, crate::database::DatabaseError> {
        let ports: Vec<i32> = sqlx::query_scalar(
            r#"
            SELECT DISTINCT node_allocations.port
            FROM server_allocations
            JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
            WHERE server_allocations.server_uuid = $1
                AND node_allocations.port IN (
                    SELECT server_tunnel_ports.port
                    FROM server_tunnel_ports
                    WHERE server_tunnel_ports.server_uuid = $2
                )
            ORDER BY node_allocations.port
            "#,
        )
        .bind(src_server_uuid)
        .bind(dst_server_uuid)
        .fetch_all(database.read())
        .await?;

        Ok(ports.into_iter().map(|port| port as u16).collect())
    }

    pub async fn count_by_src_server_uuid(
        database: &crate::database::Database,
        src_server_uuid: uuid::Uuid,
    ) -> Result<i64, crate::database::DatabaseError> {
        Ok(sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM server_tunnel_connections
            WHERE server_tunnel_connections.src_server_uuid = $1
            "#,
        )
        .bind(src_server_uuid)
        .fetch_one(database.read())
        .await?)
    }

    pub async fn create(
        database: &crate::database::Database,
        src_server_uuid: uuid::Uuid,
        dst_server_uuid: uuid::Uuid,
    ) -> Result<(), crate::database::DatabaseError> {
        if src_server_uuid == dst_server_uuid {
            return Err(crate::database::DatabaseError::Any(anyhow::anyhow!(
                "a server cannot be connected to itself"
            )));
        }

        let mut transaction = database.write().begin().await?;

        let dst_name: compact_str::CompactString = sqlx::query_scalar(
            r#"
            SELECT server_tunnels.name
            FROM server_tunnels
            WHERE server_tunnels.server_uuid = $1
            FOR KEY SHARE
            "#,
        )
        .bind(dst_server_uuid)
        .fetch_one(&mut *transaction)
        .await?;

        let affected = sqlx::query(
            r#"
            INSERT INTO server_tunnel_connections (src_server_uuid, dst_server_uuid, dst_name)
            VALUES ($1, $2, $3)
            ON CONFLICT (src_server_uuid, dst_server_uuid) DO NOTHING
            "#,
        )
        .bind(src_server_uuid)
        .bind(dst_server_uuid)
        .bind(dst_name.as_str())
        .execute(&mut *transaction)
        .await?
        .rows_affected();

        if affected > 0 {
            crate::tunnel::bump_epoch(&mut *transaction).await?;
        }

        transaction.commit().await?;

        Ok(())
    }

    pub async fn delete(
        database: &crate::database::Database,
        src_server_uuid: uuid::Uuid,
        dst_server_uuid: uuid::Uuid,
    ) -> Result<bool, crate::database::DatabaseError> {
        let mut transaction = database.write().begin().await?;

        let affected = sqlx::query(
            r#"
            DELETE FROM server_tunnel_connections
            WHERE server_tunnel_connections.src_server_uuid = $1
                AND server_tunnel_connections.dst_server_uuid = $2
            "#,
        )
        .bind(src_server_uuid)
        .bind(dst_server_uuid)
        .execute(&mut *transaction)
        .await?
        .rows_affected();

        if affected == 0 {
            return Ok(false);
        }

        crate::tunnel::bump_epoch(&mut *transaction).await?;
        transaction.commit().await?;

        Ok(true)
    }
}

#[async_trait::async_trait]
impl IntoApiObject for ServerTunnel {
    type ApiObject = ApiServerTunnel;
    type ExtraArgs<'a> = i32;

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        uuid_short: Self::ExtraArgs<'a>,
    ) -> Result<Self::ApiObject, crate::database::DatabaseError> {
        let api_object = ApiServerTunnel::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            ApiServerTunnel {
                name: self.name,
                alias: crate::tunnel::alias_of(uuid_short),
                address: crate::tunnel::frontend_address(self.idx),
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[schema_extension_derive::extendible]
#[init_args(ServerTunnel, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "ServerTunnel")]
pub struct ApiServerTunnel {
    pub name: compact_str::CompactString,
    pub alias: compact_str::CompactString,
    pub address: Option<compact_str::CompactString>,

    pub created: chrono::DateTime<chrono::Utc>,
}

#[derive(ToSchema, Deserialize, Validate)]
pub struct CreateServerTunnelOptions {
    #[garde(skip)]
    pub server_uuid: uuid::Uuid,

    #[garde(custom(validate_name))]
    #[schema(min_length = 1, max_length = 63)]
    pub name: compact_str::CompactString,
}

#[async_trait::async_trait]
impl CreatableModel for ServerTunnel {
    type CreateOptions<'a> = CreateServerTunnelOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<ServerTunnel>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create_with_transaction(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        let idx = Self::allocate_idx(transaction).await?;

        let mut query_builder = InsertQueryBuilder::new("server_tunnels");

        Self::run_create_handlers(&mut options, &mut query_builder, state, transaction).await?;

        query_builder
            .set("server_uuid", options.server_uuid)
            .set("idx", idx)
            .set("name", &options.name);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut **transaction)
            .await?;
        let mut server_tunnel = Self::map(None, &row)?;

        crate::tunnel::bump_epoch(&mut **transaction).await?;

        Self::run_after_create_handlers(&mut server_tunnel, &options, state, transaction).await?;

        Ok(server_tunnel)
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Default)]
pub struct UpdateServerTunnelOptions {
    #[garde(custom(validate_optional_name))]
    #[schema(min_length = 1, max_length = 63)]
    pub name: Option<compact_str::CompactString>,
}

#[async_trait::async_trait]
impl UpdatableModel for ServerTunnel {
    type UpdateOptions = UpdateServerTunnelOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateHandlerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateHandlerList<ServerTunnel>> =
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

        let mut query_builder = UpdateQueryBuilder::new("server_tunnels");

        self.run_update_handlers(&mut options, &mut query_builder, state, transaction)
            .await?;

        query_builder
            .set("name", options.name.as_ref())
            .where_eq("server_uuid", self.server.uuid);

        query_builder.execute(&mut **transaction).await?;

        crate::tunnel::bump_epoch(&mut **transaction).await?;

        if let Some(name) = options.name {
            self.name = name;
        }

        self.run_after_update_handlers(state, transaction).await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl DeletableModel for ServerTunnel {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteHandlerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteHandlerList<ServerTunnel>> =
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
            DELETE FROM server_tunnels
            WHERE server_tunnels.server_uuid = $1
            "#,
        )
        .bind(self.server.uuid)
        .execute(&mut **transaction)
        .await?;

        crate::tunnel::bump_epoch(&mut **transaction).await?;

        self.run_after_delete_handlers(&options, state, transaction)
            .await?;

        Ok(())
    }
}
