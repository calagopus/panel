use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod connections;
mod ports;

mod get {
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoApiObject,
            server::GetServer,
            server_tunnel::{
                ServerTunnel, ServerTunnelConnection, ServerTunnelPeer, ServerTunnelPort,
            },
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        supported: bool,
        tunnel: Option<shared::models::server_tunnel::ApiServerTunnel>,

        ports: Vec<ServerTunnelPort>,
        allocation_ports: Vec<u16>,

        outgoing: Vec<ServerTunnelPeer>,
        incoming: Vec<ServerTunnelPeer>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
    ) -> ApiResponseResult {
        permissions.has_server_permission("connections.read")?;

        let supported = shared::models::node_tunnel::NodeTunnel::by_node_uuid(
            &state.database,
            server.node.uuid,
        )
        .await?
        .is_some();

        let tunnel = ServerTunnel::by_server_uuid(&state.database, server.uuid).await?;
        let (ports, outgoing, incoming) = match &tunnel {
            Some(_) => tokio::try_join!(
                ServerTunnelPort::by_server_uuid(&state.database, server.uuid),
                ServerTunnelConnection::peers(&state.database, server.uuid, false),
                ServerTunnelConnection::peers(&state.database, server.uuid, true),
            )?,
            None => (Vec::new(), Vec::new(), Vec::new()),
        };

        ApiResponse::new_serialized(Response {
            supported,
            tunnel: match tunnel {
                Some(tunnel) => Some(tunnel.into_api_object(&state, server.uuid_short).await?),
                None => None,
            },
            ports,
            allocation_ports: server.allocation_ports(&state.database).await?,
            outgoing,
            incoming,
        })
        .ok()
    }
}

mod post {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel, IntoApiObject,
            server::{GetServer, GetServerActivityLogger},
            server_tunnel::{CreateServerTunnelOptions, ServerTunnel, validate_optional_name},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(custom(validate_optional_name))]
        #[schema(min_length = 1, max_length = 63)]
        name: Option<compact_str::CompactString>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        tunnel: shared::models::server_tunnel::ApiServerTunnel,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = UNAUTHORIZED, body = ApiError),
        (status = CONFLICT, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        activity_logger: GetServerActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("connections.create")?;

        if shared::models::node_tunnel::NodeTunnel::by_node_uuid(&state.database, server.node.uuid)
            .await?
            .is_none()
        {
            return ApiResponse::error("this server's node is not on the private network")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        if ServerTunnel::by_server_uuid(&state.database, server.uuid)
            .await?
            .is_some()
        {
            return ApiResponse::error("this server is already on the private network")
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        let name = match data.name {
            Some(name) => name,
            None => ServerTunnel::suggest_name(&server.name),
        };

        let tunnel = match ServerTunnel::create(
            &state,
            CreateServerTunnelOptions {
                server_uuid: server.uuid,
                name,
            },
        )
        .await
        {
            Ok(tunnel) => tunnel,
            Err(err) if err.is_unique_constraint_violation("server_tunnels_pkey") => {
                return ApiResponse::error("this server is already on the private network")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return Err(err.into()),
        };

        activity_logger
            .log(
                "server:tunnel.create",
                serde_json::json!({
                    "name": tunnel.name,
                }),
            )
            .await;

        shared::tunnel::poke_nodes(&state.database).await;

        ApiResponse::new_serialized(Response {
            tunnel: tunnel.into_api_object(&state, server.uuid_short).await?,
        })
        .ok()
    }
}

mod patch {
    use axum::http::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            IntoApiObject, UpdatableModel,
            server::{GetServer, GetServerActivityLogger},
            server_tunnel::{ServerTunnel, UpdateServerTunnelOptions},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        name: compact_str::CompactString,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        tunnel: shared::models::server_tunnel::ApiServerTunnel,
    }

    #[utoipa::path(patch, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        activity_logger: GetServerActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        let options = UpdateServerTunnelOptions {
            name: Some(data.name),
        };
        if let Err(errors) = shared::utils::validate_data(&options) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("connections.update")?;

        let Some(mut tunnel) = ServerTunnel::by_server_uuid(&state.database, server.uuid).await?
        else {
            return ApiResponse::error("this server is not on the private network")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        };

        match tunnel.update(&state, options).await {
            Ok(()) => {}
            Err(err)
                if err.is_unique_constraint_violation(
                    "server_tunnel_connections_src_server_uuid_dst_name_idx",
                ) =>
            {
                return ApiResponse::error(
                    "a server connected to this one already reaches another server with that hostname",
                )
                .with_status(StatusCode::CONFLICT)
                .ok();
            }
            Err(err) => return Err(err.into()),
        }

        activity_logger
            .log(
                "server:tunnel.update",
                serde_json::json!({
                    "name": tunnel.name,
                }),
            )
            .await;

        shared::tunnel::poke_nodes(&state.database).await;

        ApiResponse::new_serialized(Response {
            tunnel: tunnel.into_api_object(&state, server.uuid_short).await?,
        })
        .ok()
    }
}

mod delete {
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel,
            server::{GetServer, GetServerActivityLogger},
            server_tunnel::ServerTunnel,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        activity_logger: GetServerActivityLogger,
    ) -> ApiResponseResult {
        permissions.has_server_permission("connections.delete")?;

        let Some(tunnel) = ServerTunnel::by_server_uuid(&state.database, server.uuid).await? else {
            return ApiResponse::error("this server is not on the private network")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        };

        let name = tunnel.name.clone();
        tunnel.delete(&state, ()).await?;

        activity_logger
            .log(
                "server:tunnel.delete",
                serde_json::json!({
                    "name": name,
                }),
            )
            .await;

        shared::tunnel::poke_nodes(&state.database).await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .routes(routes!(patch::route))
        .routes(routes!(delete::route))
        .nest("/ports", ports::router(state))
        .nest("/connections", connections::router(state))
        .with_state(state.clone())
}
