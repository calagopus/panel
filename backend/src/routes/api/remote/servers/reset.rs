use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use serde::Serialize;
    use shared::{
        GetState,
        models::{
            ByUuid, EventEmittingModel,
            node::{GetNode, Node},
            server::ServerStatus,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route(state: GetState, node: GetNode) -> ApiResponseResult {
        let (_, backups, server_transfers) = tokio::try_join!(
            sqlx::query!(
                "UPDATE servers
                SET status = $2
                WHERE servers.node_uuid = $1 AND servers.status = 'RESTORING_BACKUP'",
                node.uuid,
                ServerStatus::BackupRestoreFailed as ServerStatus
            )
            .execute(state.database.write()),
            sqlx::query!(
                "SELECT server_backups.uuid FROM server_backups
                JOIN servers ON servers.uuid = server_backups.server_uuid
                WHERE servers.node_uuid = $1 AND server_backups.completed IS NULL",
                node.uuid
            )
            .fetch_all(state.database.read()),
            sqlx::query!(
                "SELECT servers.uuid, servers.node_uuid, servers.destination_node_uuid FROM servers
                WHERE (servers.node_uuid = $1 AND servers.destination_node_uuid IS NOT NULL)
                    OR servers.destination_node_uuid = $1",
                node.uuid
            )
            .fetch_all(state.database.read()),
        )?;

        sqlx::query!(
            "UPDATE server_backups
            SET successful = false, completed = NOW()
            WHERE server_backups.uuid = ANY($1)",
            &backups.into_iter().map(|b| b.uuid).collect::<Vec<_>>()
        )
        .execute(state.database.write())
        .await?;

        tokio::spawn({
            let state = state.clone();

            async move {
                for server in server_transfers {
                    let run = async || -> Result<(), anyhow::Error> {
                        let destination_node = match server.destination_node_uuid {
                            Some(destination_node_uuid) => {
                                Node::by_uuid_cached(&state.database, destination_node_uuid).await?
                            }
                            None => return Ok(()),
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
                                server.node_uuid
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

                        if let Err(err) = destination_node
                            .api_client(&state.database)
                            .await?
                            .delete_servers_server(server.uuid)
                            .await
                        {
                            tracing::error!(
                                "failed to delete server on destination node: {:?}",
                                err
                            );
                        }

                        transaction.commit().await?;

                        Ok(())
                    };

                    if let Err(err) = run().await {
                        tracing::warn!(
                            server = %server.uuid,
                            "error while resetting transfer state in reset node endpoint: {:#?}",
                            err
                        );
                    }
                }
            }
        });

        shared::models::node::Node::get_event_emitter().emit(
            state.0,
            shared::models::node::NodeEvent::StateReset {
                node: Box::new(node.0),
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
