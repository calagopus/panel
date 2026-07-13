use super::State;
use axum::{
    extract::ws::{Message, WebSocketUpgrade},
    http::{HeaderMap, StatusCode},
    routing::any,
};
use futures_util::{SinkExt, StreamExt};
use shared::{GetIp, GetState, models::user::GetPermissionManager, response::ApiResponse};
use std::collections::HashMap;
use utoipa_axum::router::OpenApiRouter;

use crate::routes::api::client::servers::_server_::databases::instances::_instance_::GetServerDatabaseInstance;

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .route(
            "/",
            any(
                |state: GetState,
                 permissions: GetPermissionManager,
                 database_instance: GetServerDatabaseInstance,
                 ip: GetIp,
                 ws: WebSocketUpgrade| async move {
                    permissions.has_server_permission("database-instances.read")?;

                    let mut headers = HeaderMap::new();
                    headers.insert("X-Real-Ip", ip.to_string().parse()?);

                    let upstream = match database_instance
                        .database_agent_host
                        .api_client(&state.database)
                        .await?
                        .open_websocket("/api/instances/utilization/ws", headers)
                        .await
                    {
                        Ok(stream) => stream,
                        Err(err) => {
                            tracing::warn!("failed to connect to utilization ws: {:?}", err);

                            return ApiResponse::error("failed to connect to upstream")
                                .with_status(StatusCode::BAD_GATEWAY)
                                .ok();
                        }
                    };

                    let database_instance_uuid = database_instance.uuid;

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

                                let msg = match msg {
                                    Message::Text(text) => {
                                        let Ok(mut utilization) = serde_json::from_str::<
                                            HashMap<uuid::Uuid, db_agent_api::ResourceUsage>,
                                        >(
                                            text.as_str()
                                        ) else {
                                            continue;
                                        };
                                        let Some(resources) =
                                            utilization.remove(&database_instance_uuid)
                                        else {
                                            continue;
                                        };

                                        match serde_json::to_string(&resources) {
                                            Ok(json) => Message::Text(json.into()),
                                            Err(_) => continue,
                                        }
                                    }
                                    other => other,
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
