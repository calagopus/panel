use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            ByUuid, EventEmittingModel,
            server::{GetServer, Server, ServerEvent},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = CONFLICT, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(state: GetState, server: GetServer) -> ApiResponseResult {
        let destination_node = match &server.destination_node {
            Some(destination_node) => destination_node.fetch_cached(&state.database).await?,
            None => {
                return ApiResponse::error("server is not being transferred")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
        };

        let mut transaction = state.database.write().begin().await?;

        let (allocations, _) = tokio::try_join!(
            sqlx::query!(
                r#"
                SELECT server_allocations.uuid FROM server_allocations
                JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
                WHERE server_allocations.server_uuid = $1 AND node_allocations.node_uuid != $2
                "#,
                server.uuid,
                server.node.uuid
            )
            .fetch_all(state.database.read()),
            sqlx::query!(
                r#"
                UPDATE servers
                SET destination_allocation_uuid = NULL, destination_node_uuid = NULL
                WHERE servers.uuid = $1
                "#,
                server.uuid
            )
            .execute(&mut *transaction)
        )?;

        sqlx::query!(
            r#"
            DELETE FROM server_allocations
            WHERE server_allocations.uuid = ANY($1)
            "#,
            &allocations.into_iter().map(|a| a.uuid).collect::<Vec<_>>()
        )
        .execute(&mut *transaction)
        .await?;

        transaction.commit().await?;

        Server::invalidate_cached(&state.database, server.uuid).await;

        if let Err(err) = destination_node
            .api_client(&state.database)
            .await?
            .delete_servers_server(server.uuid)
            .await
        {
            tracing::error!("failed to delete server on destination node: {:?}", err);
        }

        Server::get_event_emitter().emit(
            state.0,
            ServerEvent::TransferCompleted {
                server: Box::new(server.0),
                destination_node: Box::new(destination_node),
                successful: false,
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
