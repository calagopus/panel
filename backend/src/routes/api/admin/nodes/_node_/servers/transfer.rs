use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            ByUuid,
            admin_activity::GetAdminActivityLogger,
            node::{GetNode, Node},
            node_allocation::NodeAllocation,
            server::Server,
            server_allocation::ServerAllocation,
            server_backup::ServerBackup,
            server_variable::ServerVariable,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use std::collections::{HashMap, HashSet};
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize, Clone, Copy)]
    #[serde(rename_all = "snake_case")]
    pub enum MassTransferAllocationMode {
        None,
        RandomPrimary,
        RandomAll,
        PreservePorts,
        EggConfigDeployment,
        EggConfigSelfAssignRange,
    }

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        servers: HashSet<uuid::Uuid>,
        node_uuid: uuid::Uuid,

        allocation_mode: MassTransferAllocationMode,

        transfer_backups: bool,
        delete_source_backups: bool,
        archive_format: wings_api::TransferArchiveFormat,
        compression_level: Option<wings_api::CompressionLevel>,
        multiplex_channels: u64,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        affected: u64,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = ACCEPTED, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
    ), params(
        (
            "node" = uuid::Uuid,
            description = "The node ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        node: GetNode,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("nodes.transfers")?;

        if data.node_uuid == node.uuid {
            return ApiResponse::error("cannot transfer servers to the same node")
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        let destination_node = match Node::by_uuid_optional(&state.database, data.node_uuid).await?
        {
            Some(node) => node,
            None => {
                return ApiResponse::error("node not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        };

        let mut affected = 0;

        let mut transfer_server = async |server: Server| {
            if server.destination_node.is_some() {
                return Ok(());
            }

            let backups = if data.transfer_backups {
                ServerBackup::all_uuids_by_server_uuid_not_shared(&state.database, server.uuid)
                    .await?
            } else {
                Vec::new()
            };

            let has_primary = server.allocation.is_some();
            let total_allocations =
                ServerAllocation::count_by_server_uuid(&state.database, server.uuid).await?;

            let mut allocation_uuid = None;
            let mut allocation_uuids = Vec::new();

            match data.allocation_mode {
                MassTransferAllocationMode::None => {}
                MassTransferAllocationMode::EggConfigDeployment => {
                    let egg_configuration = server.egg.configuration(&state.database).await?;

                    if let Some(allocations) = &egg_configuration.config_allocations {
                        let mut deployment_variables = HashMap::new();

                        let (deployment_allocation_uuid, deployment_allocation_uuids) =
                            match NodeAllocation::get_from_deployment(
                                &state,
                                &allocations.deployment,
                                &destination_node,
                                &mut deployment_variables,
                            )
                            .await
                            {
                                Ok(allocations) => allocations,
                                Err(err) => {
                                    tracing::error!(
                                        "failed to get allocations for server transfer using egg configuration deployment mode: {:?}",
                                        err
                                    );
                                    return Err(shared::response::DisplayError::new("failed to get allocations for server transfer using egg configuration deployment mode").into());
                                }
                            };

                        if !deployment_variables.is_empty() {
                            let variables = ServerVariable::all_by_server_uuid_egg_uuid(
                                &state.database,
                                server.uuid,
                                server.egg.uuid,
                            )
                            .await?;

                            for (variable_key, variable_value) in deployment_variables.into_iter() {
                                let variable_uuid = match variables
                                    .iter()
                                    .find(|v| v.variable.env_variable == variable_key)
                                {
                                    Some(variable) => variable.variable.uuid,
                                    None => continue,
                                };

                                ServerVariable::create(
                                    &state.database,
                                    server.uuid,
                                    variable_uuid,
                                    &variable_value,
                                )
                                .await?;
                            }
                        }

                        allocation_uuid = deployment_allocation_uuid;
                        allocation_uuids = deployment_allocation_uuids;
                    } else {
                        return Err(shared::response::DisplayError::new("egg configuration does not have any configured allocations for deployment").into());
                    }
                }
                MassTransferAllocationMode::PreservePorts => {
                    let mut ports = Vec::with_capacity(total_allocations as usize);
                    if let Some(primary) = &server.allocation {
                        ports.push(primary.allocation.port);
                    }

                    for server_allocation in
                        ServerAllocation::all_by_server_uuid(&state.database, server.uuid).await?
                    {
                        if server
                            .allocation
                            .as_ref()
                            .is_some_and(|primary| primary.uuid == server_allocation.uuid)
                        {
                            continue;
                        }

                        ports.push(server_allocation.allocation.port);
                    }

                    if !ports.is_empty() {
                        let bound =
                            NodeAllocation::used_by_node_any_ip(&state, &destination_node).await?;

                        let preserved = NodeAllocation::get_preserved(
                            &state.database,
                            destination_node.uuid,
                            &ports,
                            &bound,
                        )
                        .await?;

                        let (preferred_ip, mut available) = match preserved {
                            Some((ip, allocations)) => {
                                let mut available: HashMap<i32, Vec<uuid::Uuid>> = HashMap::new();
                                for (node_allocation_uuid, port) in allocations {
                                    available
                                        .entry(port)
                                        .or_default()
                                        .push(node_allocation_uuid);
                                }

                                (Some(ip), available)
                            }
                            None => (None, HashMap::new()),
                        };

                        let mut assigned = Vec::with_capacity(ports.len());
                        let mut used = bound;
                        for port in &ports {
                            let node_allocation_uuid =
                                available.get_mut(port).and_then(|uuids| uuids.pop());
                            if let Some(node_allocation_uuid) = node_allocation_uuid {
                                used.push(node_allocation_uuid);
                            }

                            assigned.push(node_allocation_uuid);
                        }

                        let missing = assigned.iter().filter(|uuid| uuid.is_none()).count() as i64;
                        if missing > 0 {
                            let fallback = match preferred_ip {
                                Some(ip) => match NodeAllocation::get_random_ip(
                                    &state.database,
                                    destination_node.uuid,
                                    &ip,
                                    1,
                                    u16::MAX,
                                    missing,
                                    &used,
                                )
                                .await
                                {
                                    Ok(node_allocations) => node_allocations,
                                    Err(_) => {
                                        NodeAllocation::get_random(
                                            &state.database,
                                            destination_node.uuid,
                                            1,
                                            u16::MAX,
                                            missing,
                                            &used,
                                        )
                                        .await?
                                    }
                                },
                                None => {
                                    NodeAllocation::get_random(
                                        &state.database,
                                        destination_node.uuid,
                                        1,
                                        u16::MAX,
                                        missing,
                                        &used,
                                    )
                                    .await?
                                }
                            };

                            let mut fallback = fallback.into_iter();
                            for slot in assigned.iter_mut() {
                                if slot.is_none() {
                                    *slot = fallback.next();
                                }
                            }
                        }

                        for (i, node_allocation_uuid) in assigned.into_iter().flatten().enumerate()
                        {
                            if has_primary && i == 0 {
                                allocation_uuid = Some(node_allocation_uuid);
                            } else {
                                allocation_uuids.push(node_allocation_uuid);
                            }
                        }
                    }
                }
                mode => {
                    let required_allocation_count = match mode {
                        MassTransferAllocationMode::RandomPrimary => {
                            if has_primary {
                                1
                            } else {
                                0
                            }
                        }
                        MassTransferAllocationMode::RandomAll
                        | MassTransferAllocationMode::EggConfigSelfAssignRange => total_allocations,
                        _ => unreachable!(),
                    };

                    if required_allocation_count > 0 {
                        let (start_port, end_port) =
                            if let MassTransferAllocationMode::EggConfigSelfAssignRange = mode {
                                let egg_configuration =
                                    server.egg.configuration(&state.database).await?;

                                if let Some(config_allocations) =
                                    &egg_configuration.config_allocations
                                {
                                    (
                                        config_allocations.user_self_assign.start_port,
                                        config_allocations.user_self_assign.end_port,
                                    )
                                } else {
                                    (1, u16::MAX)
                                }
                            } else {
                                (1, u16::MAX)
                            };

                        let node_allocations = NodeAllocation::get_random(
                            &state.database,
                            destination_node.uuid,
                            start_port,
                            end_port,
                            required_allocation_count,
                            &NodeAllocation::used_by_node_any_ip(&state, &destination_node).await?,
                        )
                        .await?;

                        for (i, node_allocation_uuid) in node_allocations.into_iter().enumerate() {
                            if has_primary && i == 0 {
                                allocation_uuid = Some(node_allocation_uuid);
                            } else {
                                allocation_uuids.push(node_allocation_uuid);
                            }
                        }
                    }
                }
            }

            server
                .transfer(
                    &state,
                    shared::models::server::ServerTransferOptions {
                        destination_node: destination_node.clone(),
                        allocation_uuid,
                        allocation_uuids,
                        backups,
                        delete_source_backups: data.delete_source_backups,
                        archive_format: data.archive_format,
                        compression_level: data.compression_level,
                        multiplex_channels: data.multiplex_channels,
                    },
                )
                .await?;

            affected += 1;

            Ok::<_, anyhow::Error>(())
        };

        if data.servers.is_empty() {
            let mut server_page = 1;
            loop {
                let servers = Server::by_node_uuid_with_pagination(
                    &state.database,
                    node.uuid,
                    server_page,
                    50,
                    None,
                )
                .await?;
                if servers.data.is_empty() {
                    break;
                }

                for server in servers.data {
                    transfer_server(server).await?;
                }

                server_page += 1;
            }
        } else {
            for server_uuid in data.servers.iter() {
                let server = match Server::by_uuid_optional(&state.database, *server_uuid).await? {
                    Some(server) => server,
                    None => continue,
                };

                if server.node.uuid != node.uuid {
                    continue;
                }

                transfer_server(server).await?;
            }
        }

        activity_logger
            .log(
                "node:servers.transfer",
                serde_json::json!({
                    "node_uuid": node.uuid,
                    "servers": if data.servers.is_empty() { None } else { Some(&data.servers) },
                    "destination_node_uuid": data.node_uuid,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response { affected })
            .with_status(StatusCode::ACCEPTED)
            .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
