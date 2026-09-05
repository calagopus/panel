use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _connection_;
mod available;

mod post {
    use axum::http::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            server::{GetServer, GetServerActivityLogger, Server},
            server_tunnel::{ServerTunnel, ServerTunnelConnection},
            user::{GetPermissionManager, GetUser},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        server: uuid::Uuid,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
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
        user: GetUser,
        server: GetServer,
        mut activity_logger: GetServerActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_server_permission("connections.create")?;

        if data.server == server.uuid {
            return ApiResponse::error("a server cannot be connected to itself")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let Some(tunnel) = ServerTunnel::by_server_uuid(&state.database, server.uuid).await? else {
            return ApiResponse::error("this server is not on the private network")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        };

        let Some(target) =
            Server::by_user_identifier(&state.database, &user, &data.server.to_string()).await?
        else {
            return ApiResponse::error("server not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        };

        if let Some(message) = target.unavailable_reason() {
            return ApiResponse::error(message)
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        // the grant lets this server past the target's firewall, so it needs the target's
        // consent as much as this one's
        permissions
            .for_server(&target)
            .has_server_permission("connections.create")?;

        let Some(target_tunnel) =
            ServerTunnel::by_server_uuid(&state.database, target.uuid).await?
        else {
            return ApiResponse::error("that server is not on the private network")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        };

        let connections_lock = state
            .cache
            .lock(
                format!("servers::{}::tunnel-connections", server.uuid),
                Some(30),
                Some(5),
            )
            .await?;

        let connections =
            ServerTunnelConnection::count_by_src_server_uuid(&state.database, server.uuid).await?;
        if connections
            >= state
                .settings
                .get()
                .await?
                .server
                .max_tunnel_connection_count as i64
        {
            return ApiResponse::error("maximum number of connections reached")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let colliding =
            ServerTunnelConnection::colliding_ports(&state.database, server.uuid, target.uuid)
                .await?;
        if let Some(port) = colliding.first() {
            return ApiResponse::error(format!(
                "port {port} is already used by this server's own allocations, so it cannot also reach {} on it",
                target.name
            ))
            .with_status(StatusCode::CONFLICT)
            .ok();
        }

        match ServerTunnelConnection::create(&state.database, server.uuid, target.uuid).await {
            Ok(()) => {}
            Err(err)
                if err.is_unique_constraint_violation(
                    "server_tunnel_connections_src_server_uuid_dst_name_idx",
                ) =>
            {
                return ApiResponse::error(
                    "this server already reaches another server with that hostname",
                )
                .with_status(StatusCode::CONFLICT)
                .ok();
            }
            Err(err) => return Err(err.into()),
        }

        drop(connections_lock);

        activity_logger
            .log(
                "server:tunnel.connections.create",
                serde_json::json!({
                    "server_uuid": target.uuid,
                    "name": target_tunnel.name,
                    "incoming": false,
                }),
            )
            .await;

        activity_logger.server_uuid = target.uuid;
        activity_logger
            .log(
                "server:tunnel.connections.create",
                serde_json::json!({
                    "server_uuid": server.uuid,
                    "name": tunnel.name,
                    "incoming": true,
                }),
            )
            .await;

        shared::tunnel::poke_nodes(&state.database).await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .nest("/available", available::router(state))
        .nest("/{connection}", _connection_::router(state))
        .with_state(state.clone())
}
