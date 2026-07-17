use crate::prelude::*;
use compact_str::ToCompactString;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{
    collections::{BTreeMap, HashMap},
    sync::LazyLock,
};
#[derive(Serialize, Deserialize, Clone)]
pub struct NodeAllocation {
    pub uuid: uuid::Uuid,
    pub server: Option<Fetchable<super::server::Server>>,

    pub ip: sqlx::types::ipnetwork::IpNetwork,
    pub ip_alias: Option<compact_str::CompactString>,
    pub port: i32,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for NodeAllocation {
    const NAME: &'static str = "node_allocation";

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
                "node_allocations.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "node_allocations.ip",
                compact_str::format_compact!("{prefix}ip"),
            ),
            (
                "node_allocations.ip_alias",
                compact_str::format_compact!("{prefix}ip_alias"),
            ),
            (
                "node_allocations.port",
                compact_str::format_compact!("{prefix}port"),
            ),
            (
                "node_allocations.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ])
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            uuid: row.try_get(compact_str::format_compact!("{prefix}uuid").as_str())?,
            server: if let Ok(server_uuid) = row.try_get::<uuid::Uuid, _>("server_uuid") {
                Some(super::server::Server::get_fetchable(server_uuid))
            } else {
                None
            },
            ip: row.try_get(compact_str::format_compact!("{prefix}ip").as_str())?,
            ip_alias: row.try_get(compact_str::format_compact!("{prefix}ip_alias").as_str())?,
            port: row.try_get(compact_str::format_compact!("{prefix}port").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl NodeAllocation {
    pub async fn create(
        database: &crate::database::Database,
        node_uuid: uuid::Uuid,
        ip: &sqlx::types::ipnetwork::IpNetwork,
        ip_alias: Option<&str>,
        port: i32,
    ) -> Result<(), crate::database::DatabaseError> {
        sqlx::query(
            r#"
            INSERT INTO node_allocations (node_uuid, ip, ip_alias, port)
            VALUES ($1, $2, $3, $4)
            "#,
        )
        .bind(node_uuid)
        .bind(ip)
        .bind(ip_alias)
        .bind(port)
        .execute(database.write())
        .await?;

        Ok(())
    }

    pub async fn used_by_node(
        state: &crate::State,
        node: &super::node::Node,
        ips: &[std::net::IpAddr],
    ) -> Result<Vec<uuid::Uuid>, anyhow::Error> {
        if ips.is_empty() {
            return Ok(Vec::new());
        }

        let (used_ips, used_ports): (Vec<_>, Vec<_>) = node
            .used_ports(state, ips)
            .await?
            .into_iter()
            .flat_map(|(ip, ports)| {
                ports
                    .into_iter()
                    .map(move |port| (sqlx::types::ipnetwork::IpNetwork::from(ip), port as i32))
            })
            .unzip();

        if used_ips.is_empty() {
            return Ok(Vec::new());
        }

        Ok(sqlx::query_scalar(
            r#"
            SELECT node_allocations.uuid
            FROM node_allocations
            JOIN UNNEST($2::inet[], $3::int[]) AS used(ip, port)
                ON used.ip = node_allocations.ip AND used.port = node_allocations.port
            WHERE node_allocations.node_uuid = $1
            "#,
        )
        .bind(node.uuid)
        .bind(&used_ips)
        .bind(&used_ports)
        .fetch_all(state.database.read())
        .await?)
    }

    pub async fn used_by_node_any_ip(
        state: &crate::State,
        node: &super::node::Node,
    ) -> Result<Vec<uuid::Uuid>, anyhow::Error> {
        let ips: Vec<sqlx::types::ipnetwork::IpNetwork> = sqlx::query_scalar(
            r#"
            SELECT DISTINCT node_allocations.ip
            FROM node_allocations
            WHERE node_allocations.node_uuid = $1
            "#,
        )
        .bind(node.uuid)
        .fetch_all(state.database.read())
        .await?;

        Self::used_by_node(
            state,
            node,
            &ips.iter().map(|ip| ip.ip()).collect::<Vec<_>>(),
        )
        .await
    }

    pub async fn get_random(
        database: &crate::database::Database,
        node_uuid: uuid::Uuid,
        start_port: u16,
        end_port: u16,
        amount: i64,
        exclude: &[uuid::Uuid],
    ) -> Result<Vec<uuid::Uuid>, crate::database::DatabaseError> {
        let rows = sqlx::query(
            r#"
            WITH eligible_ips AS (
                SELECT node_allocations.ip
                FROM node_allocations
                LEFT JOIN server_allocations ON server_allocations.allocation_uuid = node_allocations.uuid
                WHERE
                    node_allocations.node_uuid = $1
                    AND node_allocations.port BETWEEN $2 AND $3
                    AND server_allocations.uuid IS NULL
                    AND NOT (node_allocations.uuid = ANY($5))
                GROUP BY node_allocations.ip
                HAVING COUNT(*) >= $4
            ),
            random_ip AS (
                SELECT ip FROM eligible_ips ORDER BY RANDOM() LIMIT 1
            )
            SELECT node_allocations.uuid
            FROM node_allocations
            LEFT JOIN server_allocations ON server_allocations.allocation_uuid = node_allocations.uuid
            WHERE
                node_allocations.node_uuid = $1
                AND node_allocations.port BETWEEN $2 AND $3
                AND server_allocations.uuid IS NULL
                AND NOT (node_allocations.uuid = ANY($5))
                AND node_allocations.ip = (SELECT ip FROM random_ip)
            ORDER BY RANDOM()
            LIMIT $4
            "#,
        )
        .bind(node_uuid)
        .bind(start_port as i32)
        .bind(end_port as i32)
        .bind(amount)
        .bind(exclude)
        .fetch_all(database.write())
        .await?;

        if rows.len() != amount as usize {
            return Err(anyhow::anyhow!("only found {} available allocations", rows.len()).into());
        }

        Ok(rows
            .into_iter()
            .map(|row| row.get::<uuid::Uuid, _>("uuid"))
            .collect())
    }

    pub async fn get_random_ip(
        database: &crate::database::Database,
        node_uuid: uuid::Uuid,
        ip: &sqlx::types::ipnetwork::IpNetwork,
        start_port: u16,
        end_port: u16,
        amount: i64,
        exclude: &[uuid::Uuid],
    ) -> Result<Vec<uuid::Uuid>, crate::database::DatabaseError> {
        let rows = sqlx::query(
            r#"
            SELECT node_allocations.uuid
            FROM node_allocations
            LEFT JOIN server_allocations ON server_allocations.allocation_uuid = node_allocations.uuid
            WHERE
                node_allocations.node_uuid = $1
                AND node_allocations.ip = $2
                AND node_allocations.port BETWEEN $3 AND $4
                AND server_allocations.uuid IS NULL
                AND NOT (node_allocations.uuid = ANY($6))
            ORDER BY RANDOM()
            LIMIT $5
            "#,
        )
        .bind(node_uuid)
        .bind(ip)
        .bind(start_port as i32)
        .bind(end_port as i32)
        .bind(amount)
        .bind(exclude)
        .fetch_all(database.write())
        .await?;

        if rows.len() != amount as usize {
            return Err(anyhow::anyhow!(
                "only found {} available allocations on this IP",
                rows.len()
            )
            .into());
        }

        Ok(rows
            .into_iter()
            .map(|row| row.get::<uuid::Uuid, _>("uuid"))
            .collect())
    }

    pub async fn get_random_dedicated(
        database: &crate::database::Database,
        node_uuid: uuid::Uuid,
        start_port: u16,
        end_port: u16,
        amount: i64,
        exclude: &[uuid::Uuid],
    ) -> Result<Vec<uuid::Uuid>, crate::database::DatabaseError> {
        let rows = sqlx::query(
            r#"
            WITH eligible_ips AS (
                SELECT node_allocations.ip
                FROM node_allocations
                LEFT JOIN server_allocations ON server_allocations.allocation_uuid = node_allocations.uuid
                WHERE node_allocations.node_uuid = $1
                GROUP BY node_allocations.ip
                HAVING
                    COUNT(server_allocations.uuid) = 0
                    AND COUNT(*) FILTER (WHERE node_allocations.uuid = ANY($5)) = 0
                    AND SUM(CASE WHEN node_allocations.port BETWEEN $2 AND $3 THEN 1 ELSE 0 END) >= $4
            ),
            random_ip AS (
                SELECT ip FROM eligible_ips ORDER BY RANDOM() LIMIT 1
            )
            SELECT node_allocations.uuid
            FROM node_allocations
            WHERE
                node_allocations.node_uuid = $1
                AND node_allocations.port BETWEEN $2 AND $3
                AND node_allocations.ip = (SELECT ip FROM random_ip)
            ORDER BY RANDOM()
            LIMIT $4
            "#,
        )
        .bind(node_uuid)
        .bind(start_port as i32)
        .bind(end_port as i32)
        .bind(amount)
        .bind(exclude)
        .fetch_all(database.write())
        .await?;

        if rows.len() != amount as usize {
            return Err(anyhow::anyhow!(
                "only found {} available dedicated allocations",
                rows.len()
            )
            .into());
        }

        Ok(rows
            .into_iter()
            .map(|row| row.get::<uuid::Uuid, _>("uuid"))
            .collect())
    }

    pub async fn get_preserved(
        database: &crate::database::Database,
        node_uuid: uuid::Uuid,
        ports: &[i32],
        exclude: &[uuid::Uuid],
    ) -> Result<
        Option<(sqlx::types::ipnetwork::IpNetwork, Vec<(uuid::Uuid, i32)>)>,
        crate::database::DatabaseError,
    > {
        let rows = sqlx::query(
            r#"
            WITH best_ip AS (
                SELECT node_allocations.ip
                FROM node_allocations
                LEFT JOIN server_allocations ON server_allocations.allocation_uuid = node_allocations.uuid
                WHERE
                    node_allocations.node_uuid = $1
                    AND node_allocations.port = ANY($2)
                    AND server_allocations.uuid IS NULL
                    AND NOT (node_allocations.uuid = ANY($3))
                GROUP BY node_allocations.ip
                ORDER BY COUNT(DISTINCT node_allocations.port) DESC, RANDOM()
                LIMIT 1
            )
            SELECT node_allocations.uuid, node_allocations.ip, node_allocations.port
            FROM node_allocations
            LEFT JOIN server_allocations ON server_allocations.allocation_uuid = node_allocations.uuid
            WHERE
                node_allocations.node_uuid = $1
                AND node_allocations.port = ANY($2)
                AND server_allocations.uuid IS NULL
                AND NOT (node_allocations.uuid = ANY($3))
                AND node_allocations.ip = (SELECT ip FROM best_ip)
            "#,
        )
        .bind(node_uuid)
        .bind(ports)
        .bind(exclude)
        .fetch_all(database.write())
        .await?;

        let Some(first) = rows.first() else {
            return Ok(None);
        };

        let ip = first.get::<sqlx::types::ipnetwork::IpNetwork, _>("ip");

        Ok(Some((
            ip,
            rows.into_iter()
                .map(|row| (row.get::<uuid::Uuid, _>("uuid"), row.get::<i32, _>("port")))
                .collect(),
        )))
    }

    pub async fn by_node_uuid_ip_port_unused(
        database: &crate::database::Database,
        node_uuid: uuid::Uuid,
        ip: &sqlx::types::ipnetwork::IpNetwork,
        port: i32,
        exclude: &[uuid::Uuid],
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM node_allocations
            LEFT JOIN server_allocations ON server_allocations.allocation_uuid = node_allocations.uuid
            WHERE node_allocations.node_uuid = $1 AND node_allocations.ip = $2 AND node_allocations.port = $3 AND server_allocations.uuid IS NULL
                AND NOT (node_allocations.uuid = ANY($4))
            "#,
            Self::columns_sql(None)
        )))
        .bind(node_uuid)
        .bind(ip)
        .bind(port)
        .bind(exclude)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn get_from_deployment<'a>(
        state: &crate::State,
        deployment: &'a super::egg_configuration::EggConfigAllocationsDeployment,
        node: &super::node::Node,
        variables: &mut HashMap<&'a str, compact_str::CompactString>,
    ) -> Result<(Option<uuid::Uuid>, Vec<uuid::Uuid>), crate::database::DatabaseError> {
        let database = &state.database;
        let node_uuid = node.uuid;

        let used = Self::used_by_node_any_ip(state, node).await?;

        let mut primary = None;
        let mut additional = Vec::new();

        const MAX_ITER: usize = 100;

        macro_rules! is_unused {
            ($uuid:expr) => {
                primary.as_ref().map_or(true, |p| p.uuid != $uuid) && !additional.contains(&$uuid)
            };
        }

        macro_rules! get_random {
            ($start_port:expr, $end_port:expr) => {{
                let mut exclude = used.clone();
                exclude.extend_from_slice(&additional);
                if let Some(primary) = &primary {
                    exclude.push(primary.uuid);
                    Self::get_random_ip(
                        database,
                        node_uuid,
                        &primary.ip,
                        $start_port,
                        $end_port,
                        1,
                        &exclude,
                    )
                    .await?
                } else {
                    Self::get_random(database, node_uuid, $start_port, $end_port, 1, &exclude)
                        .await?
                }
            }};
        }

        let mut success = false;

        'primary: for i in 0..MAX_ITER {
            if i != 0 && deployment.primary.is_none() {
                break;
            }

            additional.clear();
            variables.clear();

            if let Some(primary_allocation) = &deployment.primary {
                let random = if deployment.dedicated {
                    Self::get_random_dedicated(
                        database,
                        node_uuid,
                        primary_allocation.start_port,
                        primary_allocation.end_port,
                        1,
                        &used,
                    )
                    .await?
                } else {
                    Self::get_random(
                        database,
                        node_uuid,
                        primary_allocation.start_port,
                        primary_allocation.end_port,
                        1,
                        &used,
                    )
                    .await?
                };

                let Some(allocation) = random.into_iter().next() else {
                    return Err(anyhow::anyhow!("no available primary allocation found").into());
                };
                let allocation =
                    match Self::by_node_uuid_uuid(database, node_uuid, allocation).await? {
                        Some(allocation) => allocation,
                        None => {
                            return Err(
                                anyhow::anyhow!("allocated primary allocation not found").into()
                            );
                        }
                    };

                if let Some(variable_name) = &primary_allocation.assign_to_variable {
                    variables.insert(variable_name, allocation.port.to_compact_string());
                }

                primary = Some(allocation);
            }

            for additional_allocation in &deployment.additional {
                match additional_allocation.mode {
                    super::egg_configuration::EggConfigAllocationDeploymentAdditionalAllocationMode::Random => {
                        let random = get_random!(1, u16::MAX);

                        let Some(allocation) = random.into_iter().next() else {
                            return Err(anyhow::anyhow!("no available additional allocation found").into());
                        };
                        additional.push(allocation);

                        if let Some(variable_name) = &additional_allocation.assign_to_variable {
                            let allocation = match Self::by_node_uuid_uuid(database, node_uuid, allocation).await? {
                                Some(allocation) => allocation,
                                None => {
                                    return Err(
                                        anyhow::anyhow!("allocated additional allocation not found").into()
                                    );
                                }
                            };

                            variables.insert(variable_name, allocation.port.to_compact_string());
                        }
                    },
                    super::egg_configuration::EggConfigAllocationDeploymentAdditionalAllocationMode::Range {
                        start_port,
                        end_port,
                    } => {
                        let random = get_random!(start_port, end_port);

                        let Some(allocation) = random.into_iter().next() else {
                            return Err(anyhow::anyhow!("no available additional allocation found").into());
                        };
                        additional.push(allocation);

                        if let Some(variable_name) = &additional_allocation.assign_to_variable {
                            let allocation = match Self::by_node_uuid_uuid(database, node_uuid, allocation).await? {
                                Some(allocation) => allocation,
                                None => {
                                    return Err(
                                        anyhow::anyhow!("allocated additional allocation not found").into()
                                    );
                                }
                            };

                            variables.insert(variable_name, allocation.port.to_compact_string());
                        }
                    }
                    super::egg_configuration::EggConfigAllocationDeploymentAdditionalAllocationMode::AddPrimary { value } => {
                        let primary = match &primary {
                            Some(primary) => primary,
                            None => {
                                return Err(anyhow::anyhow!("primary allocation is required for `add_primary` mode").into());
                            }
                        };

                        let allocation_port = primary.port + value as i32;

                        let allocation = match Self::by_node_uuid_ip_port_unused(database, node_uuid, &primary.ip, allocation_port, &used).await? {
                            Some(allocation) => allocation,
                            None => continue 'primary,
                        };
                        if !is_unused!(allocation.uuid) {
                            return Err(anyhow::anyhow!("allocated additional allocation is already in use").into());
                        }
                        additional.push(allocation.uuid);

                        if let Some(variable_name) = &additional_allocation.assign_to_variable {
                            variables.insert(variable_name, allocation.port.to_compact_string());
                        }
                    }
                    super::egg_configuration::EggConfigAllocationDeploymentAdditionalAllocationMode::SubtractPrimary { value } => {
                        let primary = match &primary {
                            Some(primary) => primary,
                            None => {
                                return Err(anyhow::anyhow!("primary allocation is required for `subtract_primary` mode").into());
                            }
                        };

                        let allocation_port = primary.port - value as i32;

                        let allocation = match Self::by_node_uuid_ip_port_unused(database, node_uuid, &primary.ip, allocation_port, &used).await? {
                            Some(allocation) => allocation,
                            None => continue 'primary,
                        };
                        if !is_unused!(allocation.uuid) {
                            return Err(anyhow::anyhow!("allocated additional allocation is already in use").into());
                        }
                        additional.push(allocation.uuid);

                        if let Some(variable_name) = &additional_allocation.assign_to_variable {
                            variables.insert(variable_name, allocation.port.to_compact_string());
                        }
                    }
                    super::egg_configuration::EggConfigAllocationDeploymentAdditionalAllocationMode::MultiplyPrimary { value } => {
                        let primary = match &primary {
                            Some(primary) => primary,
                            None => {
                                return Err(anyhow::anyhow!("primary allocation is required for `multiply_primary` mode").into());
                            }
                        };

                        let allocation_port = (primary.port as f64 * value) as i32;

                        let allocation = match Self::by_node_uuid_ip_port_unused(database, node_uuid, &primary.ip, allocation_port, &used).await? {
                            Some(allocation) => allocation,
                            None => continue 'primary,
                        };
                        if !is_unused!(allocation.uuid) {
                            return Err(anyhow::anyhow!("allocated additional allocation is already in use").into());
                        }
                        additional.push(allocation.uuid);

                        if let Some(variable_name) = &additional_allocation.assign_to_variable {
                            variables.insert(variable_name, allocation.port.to_compact_string());
                        }
                    }
                    super::egg_configuration::EggConfigAllocationDeploymentAdditionalAllocationMode::DividePrimary { value } => {
                        let primary = match &primary {
                            Some(primary) => primary,
                            None => {
                                return Err(anyhow::anyhow!("primary allocation is required for `divide_primary` mode").into());
                            }
                        };

                        let allocation_port = (primary.port as f64 / value) as i32;

                        let allocation = match Self::by_node_uuid_ip_port_unused(database, node_uuid, &primary.ip, allocation_port, &used).await? {
                            Some(allocation) => allocation,
                            None => continue 'primary,
                        };
                        if !is_unused!(allocation.uuid) {
                            return Err(anyhow::anyhow!("allocated additional allocation is already in use").into());
                        }
                        additional.push(allocation.uuid);

                        if let Some(variable_name) = &additional_allocation.assign_to_variable {
                            variables.insert(variable_name, allocation.port.to_compact_string());
                        }
                    }
                }
            }

            success = true;
            break;
        }

        if !success {
            return Err(anyhow::anyhow!(
                "could not satisfy all additional allocation rules after {MAX_ITER} attempts"
            )
            .into());
        }

        Ok((primary.map(|p| p.uuid), additional))
    }

    pub async fn by_node_uuid_uuid(
        database: &crate::database::Database,
        node_uuid: uuid::Uuid,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM node_allocations
            WHERE node_allocations.node_uuid = $1 AND node_allocations.uuid = $2
            "#,
            Self::columns_sql(None)
        )))
        .bind(node_uuid)
        .bind(uuid)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn available_by_node_uuid_with_pagination(
        database: &crate::database::Database,
        node_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM node_allocations
            LEFT JOIN server_allocations ON server_allocations.allocation_uuid = node_allocations.uuid
            WHERE node_allocations.node_uuid = $1 AND server_allocations.uuid IS NULL
                AND (
                    $2 IS NULL
                    OR host(node_allocations.ip) || ':' || node_allocations.port ILIKE '%' || $2 || '%'
                    OR (node_allocations.ip_alias IS NOT NULL AND node_allocations.ip_alias || ':' || node_allocations.port ILIKE '%' || $2 || '%')
                )
            ORDER BY node_allocations.ip, node_allocations.port
            LIMIT $3 OFFSET $4
            "#,
            Self::columns_sql(None)
        )))
        .bind(node_uuid)
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

    pub async fn by_node_uuid_with_pagination(
        database: &crate::database::Database,
        node_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}, server_allocations.server_uuid, COUNT(*) OVER() AS total_count
            FROM node_allocations
            LEFT JOIN server_allocations ON server_allocations.allocation_uuid = node_allocations.uuid
            WHERE node_allocations.node_uuid = $1
                AND (
                    $2 IS NULL OR host(node_allocations.ip) || ':' || node_allocations.port ILIKE '%' || $2 || '%'
                    OR (node_allocations.ip_alias IS NOT NULL AND node_allocations.ip_alias || ':' || node_allocations.port ILIKE '%' || $2 || '%')
                    OR server_allocations.notes ILIKE '%' || $2 || '%'
                )
            ORDER BY node_allocations.ip, node_allocations.port
            LIMIT $3 OFFSET $4
            "#,
            Self::columns_sql(None)
        )))
        .bind(node_uuid)
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
        node_uuid: uuid::Uuid,
        uuids: &[uuid::Uuid],
    ) -> Result<u64, crate::database::DatabaseError> {
        let deleted = sqlx::query(
            r#"
            DELETE FROM node_allocations
            WHERE node_allocations.node_uuid = $1 AND node_allocations.uuid = ANY($2)
            "#,
        )
        .bind(node_uuid)
        .bind(uuids)
        .execute(database.write())
        .await?
        .rows_affected();

        Ok(deleted)
    }
}

#[async_trait::async_trait]
impl IntoAdminApiObject for NodeAllocation {
    type AdminApiObject = AdminApiNodeAllocation;
    type ExtraArgs<'a> = &'a crate::storage::StorageUrlRetriever<'a>;

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        storage_url_retriever: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiNodeAllocation::init_hooks(&self, state).await?;

        let server = match self.server {
            Some(fetchable) => Some(
                fetchable
                    .fetch_cached(&state.database)
                    .await?
                    .into_admin_api_object(state, storage_url_retriever)
                    .await?,
            ),
            None => None,
        };

        let api_object = finish_extendible!(
            AdminApiNodeAllocation {
                uuid: self.uuid,
                server,
                ip: self.ip.ip().to_compact_string(),
                ip_alias: self.ip_alias,
                port: self.port,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[schema_extension_derive::extendible]
#[init_args(NodeAllocation, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "NodeAllocation")]
pub struct AdminApiNodeAllocation {
    pub uuid: uuid::Uuid,
    pub server: Option<super::server::AdminApiServer>,

    pub ip: compact_str::CompactString,
    pub ip_alias: Option<compact_str::CompactString>,
    pub port: i32,

    pub created: chrono::DateTime<chrono::Utc>,
}
