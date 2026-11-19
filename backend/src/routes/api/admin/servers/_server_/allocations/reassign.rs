use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            ByUuid,
            admin_activity::GetAdminActivityLogger,
            egg_configuration::{EggConfiguration, EggConfigurationTarget},
            nest_egg_variable::NestEggVariable,
            node_allocation::NodeAllocation,
            server::{GetServer, Server},
            server_variable::ServerVariable,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use std::collections::HashMap;
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = UNAUTHORIZED, body = ApiError),
        (status = CONFLICT, body = ApiError),
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
        server: GetServer,
        activity_logger: GetAdminActivityLogger,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("servers.allocations")?;

        if let Some(reason) = server.unavailable_reason() {
            return ApiResponse::error(reason)
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        let node = server.node.fetch_cached(&state.database).await?;

        let egg_configuration = EggConfiguration::merged_for_target(
            &state.database,
            &EggConfigurationTarget::new(&server.egg, &node),
        )
        .await?;

        let Some(deployment) = egg_configuration
            .config_allocations
            .map(|allocations| allocations.deployment)
            .filter(|deployment| deployment.primary.is_some() || !deployment.additional.is_empty())
        else {
            return ApiResponse::error(
                "egg configuration does not have any configured allocations for deployment",
            )
            .with_status(StatusCode::BAD_REQUEST)
            .ok();
        };

        let egg_variables =
            NestEggVariable::all_by_egg_uuid(&state.database, server.egg.uuid).await?;

        let mut attempts = 0;

        let (allocation_uuid, allocation_uuids, deployment_variables) = loop {
            let mut deployment_variables = HashMap::new();

            let (allocation_uuid, allocation_uuids) = match NodeAllocation::get_from_deployment(
                &state,
                &deployment,
                &node,
                &mut deployment_variables,
                Some(server.uuid),
            )
            .await
            {
                Ok(result) => result,
                Err(shared::database::DatabaseError::Any(err)) => {
                    return ApiResponse::error(format!("could not reassign allocations: {err}"))
                        .with_status(StatusCode::BAD_REQUEST)
                        .ok();
                }
                Err(err) => return ApiResponse::from(err).ok(),
            };

            if allocation_uuids.len() != deployment.additional.len() {
                return ApiResponse::error(format!(
                    "could not reassign allocations: the node could only satisfy {} of the {} required additional allocations",
                    allocation_uuids.len(),
                    deployment.additional.len()
                ))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
            }

            let mut transaction = state.database.write().begin().await?;

            sqlx::query!(
                "DELETE FROM server_allocations
                WHERE server_allocations.server_uuid = $1",
                server.uuid
            )
            .execute(&mut *transaction)
            .await?;

            let mut conflict = false;

            let primary_uuid = match allocation_uuid {
                Some(allocation_uuid) => {
                    let primary_uuid = sqlx::query_scalar!(
                        "INSERT INTO server_allocations (server_uuid, allocation_uuid)
                        VALUES ($1, $2)
                        ON CONFLICT DO NOTHING
                        RETURNING uuid",
                        server.uuid,
                        allocation_uuid
                    )
                    .fetch_optional(&mut *transaction)
                    .await?;
                    conflict |= primary_uuid.is_none();

                    primary_uuid
                }
                None => None,
            };

            if !allocation_uuids.is_empty() {
                let inserted = sqlx::query_scalar!(
                    "INSERT INTO server_allocations (server_uuid, allocation_uuid)
                    SELECT $1, UNNEST($2::uuid[])
                    ON CONFLICT DO NOTHING
                    RETURNING uuid",
                    server.uuid,
                    &allocation_uuids
                )
                .fetch_all(&mut *transaction)
                .await?;
                conflict |= inserted.len() != allocation_uuids.len();
            }

            if conflict {
                transaction.rollback().await?;

                if attempts < 3 {
                    attempts += 1;
                    continue;
                }

                return ApiResponse::error(
                    "allocations were assigned to another server during reassignment",
                )
                .with_status(StatusCode::CONFLICT)
                .ok();
            };

            sqlx::query!(
                "UPDATE servers
                SET allocation_uuid = $1
                WHERE servers.uuid = $2",
                primary_uuid,
                server.uuid
            )
            .execute(&mut *transaction)
            .await?;

            for (env_variable, value) in &deployment_variables {
                let Some(variable) = egg_variables
                    .iter()
                    .find(|v| v.env_variable == *env_variable)
                else {
                    continue;
                };

                ServerVariable::create_with_transaction(
                    &mut transaction,
                    server.uuid,
                    variable.uuid,
                    value,
                )
                .await?;
            }

            transaction.commit().await?;

            break (allocation_uuid, allocation_uuids, deployment_variables);
        };

        Server::invalidate_cached(&state.database, server.uuid).await;

        activity_logger
            .log(
                "server:allocation.reassign",
                serde_json::json!({
                    "server_uuid": server.uuid,

                    "allocation_uuid": allocation_uuid,
                    "allocation_uuids": allocation_uuids,
                    "variables": deployment_variables,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
