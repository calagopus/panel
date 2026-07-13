use super::State;
use axum::{
    extract::ws::WebSocketUpgrade,
    http::{HeaderMap, StatusCode},
    routing::any,
};
use futures_util::{SinkExt, StreamExt};
use shared::{GetIp, GetState, models::user::GetPermissionManager, response::ApiResponse};
use utoipa_axum::router::OpenApiRouter;

use crate::routes::api::admin::database_agent_hosts::_database_agent_host_::GetDatabaseAgentHost;

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .route(
            "/",
            any(
                |state: GetState,
                 permissions: GetPermissionManager,
                 database_agent_host: GetDatabaseAgentHost,
                 ip: GetIp,
                 ws: WebSocketUpgrade| async move {
                    permissions.has_admin_permission("database-agent-hosts.read")?;

                    let mut headers = HeaderMap::new();
                    headers.insert("X-Real-Ip", ip.to_string().parse()?);

                    let upstream = match database_agent_host
                        .api_client(&state.database)
                        .await?
                        .open_websocket("/api/system/stats/ws", headers)
                        .await
                    {
                        Ok(stream) => stream,
                        Err(err) => {
                            tracing::warn!("failed to connect to stats ws: {:?}", err);

                            return ApiResponse::error("failed to connect to upstream")
                                .with_status(StatusCode::BAD_GATEWAY)
                                .ok();
                        }
                    };

                    ApiResponse::new_response(ws.on_upgrade(move |client_ws| async move {
                        let (mut client_tx, mut client_rx) = client_ws.split();
                        let (mut up_tx, mut up_rx) = upstream.split();

                        let to_upstream = async {
                            while let Some(Ok(msg)) = client_rx.next().await {
                                let msg = shared::utils::axum_to_tungstenite(msg);
                                if up_tx.send(msg).await.is_err() {
                                    break;
                                }
                            }
                        };

                        let to_client = async {
                            while let Some(Ok(msg)) = up_rx.next().await {
                                let Some(msg) = shared::utils::tungstenite_to_axum(msg) else {
                                    continue;
                                };
                                if client_tx.send(msg).await.is_err() {
                                    break;
                                }
                            }
                        };

                        tokio::select! {
                            _ = to_upstream => {},
                            _ = to_client => {},
                        }
                    }))
                    .ok()
                },
            ),
        )
        .with_state(state.clone())
}
