use super::State;
use axum::{
    extract::{Path, Query, ws::WebSocketUpgrade},
    http::{HeaderMap, StatusCode},
    routing::any,
};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use shared::{
    GetIp, GetState,
    models::{node::GetNode, user::GetPermissionManager},
    response::ApiResponse,
};
use utoipa_axum::router::OpenApiRouter;

#[derive(Deserialize)]
pub struct Params {
    lines: Option<u64>,
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .route(
            "/",
            any(
                |state: GetState,
                 permissions: GetPermissionManager,
                 node: GetNode,
                 ip: GetIp,
                 Path((_node, file)): Path<(uuid::Uuid, String)>,
                 Query(params): Query<Params>,
                 ws: WebSocketUpgrade| async move {
                    permissions.has_admin_permission("nodes.read")?;

                    let endpoint = match params.lines {
                        Some(lines) => format!("/api/system/logs/{file}/ws?lines={lines}"),
                        None => format!("/api/system/logs/{file}/ws"),
                    };

                    let mut headers = HeaderMap::new();
                    headers.insert("X-Real-Ip", ip.to_string().parse()?);

                    let upstream = match node
                        .api_client(&state.database)
                        .await?
                        .open_websocket(endpoint, headers)
                        .await
                    {
                        Ok(stream) => stream,
                        Err(_) => {
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
