use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod cancel;

mod post {
    use axum::http::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            ByUuid, admin_activity::GetAdminActivityLogger, node::Node, server::GetServer,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        node_uuid: uuid::Uuid,

        allocation_uuid: Option<uuid::Uuid>,
        allocation_uuids: Vec<uuid::Uuid>,

        backups: Vec<uuid::Uuid>,
        delete_source_backups: bool,
        archive_format: wings_api::TransferArchiveFormat,
        compression_level: Option<wings_api::CompressionLevel>,
        multiplex_channels: u64,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = ACCEPTED, body = inline(Response)),
        (status = CONFLICT, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
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
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("servers.transfer")?;

        if server.destination_node.is_some() {
            return ApiResponse::error("server is already being transferred")
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        if data.node_uuid == server.node.uuid {
            return ApiResponse::error("cannot transfer server to the same node")
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

        let server_uuid = server.uuid;
        let destination_node_uuid = destination_node.uuid;
        server
            .0
            .transfer(
                &state,
                shared::models::server::ServerTransferOptions {
                    destination_node,
                    allocation_uuid: data.allocation_uuid,
                    allocation_uuids: data.allocation_uuids,
                    backups: data.backups,
                    delete_source_backups: data.delete_source_backups,
                    archive_format: data.archive_format,
                    compression_level: data.compression_level,
                    multiplex_channels: data.multiplex_channels,
                },
            )
            .await?;

        activity_logger
            .log(
                "server:transfer",
                serde_json::json!({
                    "uuid": server_uuid,
                    "destination_node_uuid": destination_node_uuid,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {})
            .with_status(StatusCode::ACCEPTED)
            .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .nest("/cancel", cancel::router(state))
        .with_state(state.clone())
}
