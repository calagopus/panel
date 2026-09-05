use super::State;
use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    http::{HeaderMap, StatusCode},
    routing::any,
};
use db_agent_api::{WebsocketEvent, WebsocketMessage};
use futures_util::{SinkExt, StreamExt, stream::SplitSink};
use shared::{
    GetIp, GetState,
    models::{
        server::{GetServerActivityLogger, ServerActivityLogger},
        server_database_instance::{ServerDatabaseInstance, ServerDatabaseInstanceStatus},
        user::{GetPermissionManager, PermissionManager},
    },
    response::ApiResponse,
};
use std::sync::Arc;
use tokio::sync::Mutex;
use utoipa_axum::router::OpenApiRouter;

use crate::routes::api::client::servers::_server_::databases::instances::_instance_::GetServerDatabaseInstance;

type Upstream = SplitSink<
    tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>,
    tokio_tungstenite::tungstenite::Message,
>;

struct InstanceWebsocketHandler {
    state: State,
    sender: Mutex<SplitSink<WebSocket, Message>>,
    upstream: Mutex<Upstream>,
    permissions: PermissionManager,
    activity_logger: ServerActivityLogger,
    database_instance: ServerDatabaseInstance,
}

impl InstanceWebsocketHandler {
    #[inline]
    fn has_permission(&self, permission: &str) -> bool {
        self.permissions.has_server_permission(permission).is_ok()
    }

    async fn send_message(&self, message: WebsocketMessage) {
        let message = match serde_json::to_string(&message) {
            Ok(message) => message,
            Err(err) => {
                tracing::error!("failed to serialize websocket message: {:?}", err);
                return;
            }
        };

        if let Err(err) = self
            .sender
            .lock()
            .await
            .send(Message::Text(message.into()))
            .await
        {
            tracing::debug!("failed to send websocket message: {:?}", err);
        }
    }

    async fn send_error(&self, message: &str) {
        self.send_message(
            WebsocketMessage::builder(WebsocketEvent::InstanceDaemonError)
                .arg(message)
                .build(),
        )
        .await;
    }

    async fn handle_client_message(&self, message: Message) -> bool {
        if let Message::Text(text) = &message
            && let Ok(parsed) = serde_json::from_str::<WebsocketMessage>(text.as_str())
        {
            match parsed.event {
                WebsocketEvent::SendStats | WebsocketEvent::SendStatus => {}
                WebsocketEvent::SendLogs => {
                    if !self.has_permission("database-instances.logs") {
                        self.send_error("you do not have permission to view logs")
                            .await;

                        return true;
                    }
                }
                WebsocketEvent::SetState => {
                    if !self.has_permission("database-instances.power") {
                        self.send_error("you do not have permission to send power actions")
                            .await;

                        return true;
                    }

                    if self
                        .database_instance
                        .database_agent_host
                        .maintenance_enabled
                    {
                        self.send_error(
                            "cannot send power actions while database agent host is in maintenance mode",
                        )
                        .await;

                        return true;
                    }

                    if matches!(
                        ServerDatabaseInstance::status_by_uuid(
                            &self.state.database,
                            self.database_instance.uuid,
                        )
                        .await,
                        Ok(Some(ServerDatabaseInstanceStatus::RestoringBackup))
                    ) {
                        self.send_error(
                            "cannot send power actions while a backup is being restored into the database instance",
                        )
                        .await;

                        return true;
                    }

                    let action = match parsed.args.first().map(compact_str::CompactString::as_str) {
                        Some("start") => db_agent_api::PowerAction::Start,
                        Some("stop") => db_agent_api::PowerAction::Stop,
                        Some("restart") => db_agent_api::PowerAction::Restart,
                        Some("kill") => db_agent_api::PowerAction::Kill,
                        _ => return true,
                    };

                    self.activity_logger
                        .log(
                            "server:database-instance.power",
                            serde_json::json!({
                                "uuid": self.database_instance.uuid,
                                "name": self.database_instance.name,
                                "action": action,
                            }),
                        )
                        .await;
                }
                _ => return true,
            }
        }

        self.upstream
            .lock()
            .await
            .send(shared::utils::axum_to_tungstenite(message))
            .await
            .is_ok()
    }

    async fn handle_agent_message(&self, message: tokio_tungstenite::tungstenite::Message) -> bool {
        let Some(message) = shared::utils::tungstenite_to_axum(message) else {
            return true;
        };

        if let Message::Text(text) = &message
            && !self.has_permission("database-instances.logs")
            && let Ok(parsed) = serde_json::from_str::<WebsocketMessage>(text.as_str())
            && matches!(parsed.event, WebsocketEvent::InstanceConsoleOutput)
        {
            return true;
        }

        self.sender.lock().await.send(message).await.is_ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .route(
            "/",
            any(
                |state: GetState,
                 permissions: GetPermissionManager,
                 database_instance: GetServerDatabaseInstance,
                 activity_logger: GetServerActivityLogger,
                 ip: GetIp,
                 ws: WebSocketUpgrade| async move {
                    permissions.has_server_permission("database-instances.read")?;

                    let mut headers = HeaderMap::new();
                    headers.insert("X-Real-Ip", ip.to_string().parse()?);

                    let upstream = match database_instance
                        .database_agent_host
                        .api_client(&state.database)
                        .await?
                        .open_websocket(
                            format!("/api/instances/{}/ws", database_instance.uuid),
                            headers,
                        )
                        .await
                    {
                        Ok(stream) => stream,
                        Err(err) => {
                            tracing::warn!("failed to connect to instance ws: {:?}", err);

                            return ApiResponse::error("failed to connect to upstream")
                                .with_status(StatusCode::BAD_GATEWAY)
                                .ok();
                        }
                    };

                    ApiResponse::new_response(ws.on_upgrade(move |client_ws| async move {
                        let (client_tx, mut client_rx) = client_ws.split();
                        let (upstream_tx, mut upstream_rx) = upstream.split();

                        let websocket_handler = Arc::new(InstanceWebsocketHandler {
                            state: Arc::clone(&state.0),
                            sender: Mutex::new(client_tx),
                            upstream: Mutex::new(upstream_tx),
                            permissions: permissions.0,
                            activity_logger: activity_logger.0,
                            database_instance: database_instance.0,
                        });

                        let reader = {
                            let websocket_handler = Arc::clone(&websocket_handler);

                            async move {
                                while let Some(Ok(message)) = client_rx.next().await {
                                    if !websocket_handler.handle_client_message(message).await {
                                        break;
                                    }
                                }
                            }
                        };

                        let writer = async move {
                            while let Some(Ok(message)) = upstream_rx.next().await {
                                if !websocket_handler.handle_agent_message(message).await {
                                    break;
                                }
                            }
                        };

                        tokio::select! {
                            _ = reader => {},
                            _ = writer => {},
                        }
                    }))
                    .ok()
                },
            ),
        )
        .with_state(state.clone())
}
