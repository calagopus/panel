use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use serde::Serialize;
    use shared::{
        GetState,
        models::{
            EventEmittingModel, admin_activity::GetAdminActivityLogger, server::GetServer,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
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
        mut server: GetServer,
        activity_logger: GetAdminActivityLogger,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("servers.update")?;

        let mut transaction = state.database.write().begin().await?;

        if let Some(destination_node) = &server.destination_node {
            let destination_node = destination_node.fetch_cached(&state.database).await?;

            let (allocations, _) = tokio::try_join!(
                sqlx::query!(
                    "SELECT server_allocations.uuid FROM server_allocations
                    JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
                    WHERE server_allocations.server_uuid = $1 AND node_allocations.node_uuid != $2",
                    server.uuid,
                    server.node.uuid
                )
                .fetch_all(state.database.read()),
                sqlx::query!(
                    "UPDATE servers
                    SET destination_allocation_uuid = NULL, destination_node_uuid = NULL
                    WHERE servers.uuid = $1",
                    server.uuid
                )
                .execute(&mut *transaction)
            )?;

            sqlx::query!(
                "DELETE FROM server_allocations
                WHERE server_allocations.uuid = ANY($1)",
                &allocations.into_iter().map(|a| a.uuid).collect::<Vec<_>>()
            )
            .execute(&mut *transaction)
            .await?;

            if let Err(err) = destination_node
                .api_client(&state.database)
                .await?
                .delete_servers_server(server.uuid)
                .await
            {
                tracing::error!("failed to delete server on destination node: {:?}", err);
            }
        }

        server.set_status(&mut *transaction, None).await?;

        transaction.commit().await?;

        activity_logger
            .log(
                "server:clear-state",
                serde_json::json!({
                    "uuid": server.uuid,
                }),
            )
            .await;

        shared::models::server::Server::get_event_emitter().emit(
            state.0,
            shared::models::server::ServerEvent::StateReset {
                server: Box::new(server.0),
            },
        );

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
