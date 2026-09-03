use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            ByUuid, EventEmittingModel,
            node::GetNode,
            server::{GetServer, Server, ServerEvent},
            server_backup::BackupDisk,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use std::collections::BTreeMap;
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct PayloadBackupMigration {
        pub checksum: String,
        pub checksum_type: compact_str::CompactString,
        pub browsable: bool,
        pub streaming: bool,
        #[serde(default)]
        pub adapter: Option<wings_api::BackupAdapter>,
    }

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        backups: Vec<uuid::Uuid>,
        #[serde(default)]
        #[schema(inline)]
        backup_migrations: BTreeMap<uuid::Uuid, PayloadBackupMigration>,
    }

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
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        node: GetNode,
        server: GetServer,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        let destination_node = match &server.destination_node {
            Some(id) => id,
            None => {
                return ApiResponse::error("server is not being transferred")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
        };

        if node.uuid != destination_node.uuid {
            return ApiResponse::error("destination node must call success endpoint")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let mut transaction = state.database.write().begin().await?;

        let (allocations, _) = tokio::try_join!(
            sqlx::query!(
                "SELECT server_allocations.uuid, node_allocations.node_uuid FROM server_allocations
                JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
                WHERE server_allocations.server_uuid = $1 AND node_allocations.node_uuid != $2",
                server.uuid,
                destination_node.uuid
            )
            .fetch_all(state.database.read()),
            sqlx::query!(
                "UPDATE servers
                SET node_uuid = $1, allocation_uuid = $2, destination_allocation_uuid = NULL, destination_node_uuid = NULL
                WHERE servers.uuid = $3",
                destination_node.uuid,
                server.destination_allocation_uuid,
                server.uuid
            )
            .execute(&mut *transaction)
        )?;

        sqlx::query!(
            "UPDATE server_backups
            SET node_uuid = $3
            WHERE server_backups.server_uuid = $1
                AND (server_backups.uuid = ANY($2) OR server_backups.shared = true)",
            server.uuid,
            &data.backups,
            destination_node.uuid
        )
        .execute(&mut *transaction)
        .await?;

        {
            let mut backup_migration_uuid = Vec::new();
            let mut backup_migration_checksum = Vec::new();
            let mut backup_migration_browsable = Vec::new();
            let mut backup_migration_streaming = Vec::new();
            let mut backup_migration_disk = Vec::new();

            for (backup_uuid, backup_migration) in data.backup_migrations {
                backup_migration_uuid.push(backup_uuid);
                backup_migration_checksum.push(format!(
                    "{}:{}",
                    backup_migration.checksum_type, backup_migration.checksum
                ));
                backup_migration_browsable.push(backup_migration.browsable);
                backup_migration_streaming.push(backup_migration.streaming);
                backup_migration_disk
                    .push(backup_migration.adapter.map(BackupDisk::from_wings_adapter));
            }
            sqlx::query!(
                "UPDATE server_backups
                SET checksum = v.checksum, browsable = v.browsable, streaming = v.streaming,
                    disk = COALESCE(v.disk, server_backups.disk)
                FROM UNNEST($2::uuid[], $3::text[], $4::boolean[], $5::boolean[], $6::backup_disk[]) AS v(uuid, checksum, browsable, streaming, disk)
                WHERE server_backups.server_uuid = $1 AND server_backups.uuid = v.uuid",
                server.uuid,
                &backup_migration_uuid,
                &backup_migration_checksum,
                &backup_migration_browsable,
                &backup_migration_streaming,
                &backup_migration_disk as &[Option<BackupDisk>]
            )
            .execute(&mut *transaction)
            .await?;
        }

        sqlx::query!(
            "DELETE FROM server_allocations
            WHERE server_allocations.uuid = ANY($1)",
            &allocations.into_iter().map(|a| a.uuid).collect::<Vec<_>>()
        )
        .execute(&mut *transaction)
        .await?;

        let on_mesh =
            shared::tunnel::bump_epoch_if_server_on_mesh(&mut transaction, server.uuid).await?;

        transaction.commit().await?;

        Server::invalidate_cached(&state.database, server.uuid).await;

        if on_mesh {
            shared::tunnel::poke_nodes(&state.database).await;
        }

        if let Err(err) = server
            .node
            .fetch_cached(&state.database)
            .await?
            .api_client(&state.database)
            .await?
            .delete_servers_server(server.uuid)
            .await
        {
            tracing::error!("failed to delete server on source node: {:?}", err);
        }

        if let Ok(destination_node) = destination_node.fetch_cached(&state.database).await {
            Server::get_event_emitter().emit(
                state.0,
                ServerEvent::TransferCompleted {
                    server: Box::new(server.0),
                    destination_node: Box::new(destination_node),
                    successful: true,
                },
            );
        }

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
