use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod delete {
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel, admin_activity::GetAdminActivityLogger, server::GetServer,
            server_allocation::ServerAllocation, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "allocation" = uuid::Uuid,
            description = "The allocation ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        activity_logger: GetAdminActivityLogger,
        Path((_server, allocation)): Path<(String, uuid::Uuid)>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("servers.allocations")?;

        let allocation =
            match ServerAllocation::by_server_uuid_uuid(&state.database, server.uuid, allocation)
                .await?
            {
                Some(allocation) => allocation,
                None => {
                    return ApiResponse::error("allocation not found")
                        .with_status(StatusCode::NOT_FOUND)
                        .ok();
                }
            };

        allocation.delete(&state, ()).await?;

        activity_logger
            .log(
                "server:allocation.delete",
                serde_json::json!({
                    "uuid": allocation.uuid,
                    "server_uuid": server.uuid,

                    "ip": allocation.allocation.ip,
                    "ip_alias": allocation.allocation.ip_alias,
                    "port": allocation.allocation.port,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod patch {
    use axum::{extract::Path, http::StatusCode};
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            ByUuid, UpdatableModel,
            admin_activity::GetAdminActivityLogger,
            server::{GetServer, Server},
            server_allocation::{ServerAllocation, UpdateServerAllocationOptions},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(min = 1, max = 1024))]
        #[schema(min_length = 1, max_length = 1024)]
        #[serde(default, with = "::serde_with::rust::double_option")]
        notes: Option<Option<compact_str::CompactString>>,

        #[garde(skip)]
        primary: Option<bool>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(patch, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = BAD_REQUEST, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "allocation" = uuid::Uuid,
            description = "The allocation ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        activity_logger: GetAdminActivityLogger,
        Path((_server, allocation)): Path<(String, uuid::Uuid)>,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("servers.allocations")?;

        let mut allocation =
            match ServerAllocation::by_server_uuid_uuid(&state.database, server.uuid, allocation)
                .await?
            {
                Some(allocation) => allocation,
                None => {
                    return ApiResponse::error("allocation not found")
                        .with_status(StatusCode::NOT_FOUND)
                        .ok();
                }
            };

        let mut transaction = state.database.write().begin().await?;

        allocation
            .update_with_transaction(
                &state,
                UpdateServerAllocationOptions { notes: data.notes },
                &mut transaction,
            )
            .await?;
        if let Some(primary) = data.primary {
            if server
                .allocation
                .as_ref()
                .is_some_and(|a| a.uuid == allocation.uuid)
            {
                if !primary {
                    sqlx::query!(
                        "UPDATE servers
                        SET allocation_uuid = NULL
                        WHERE servers.uuid = $1",
                        server.uuid,
                    )
                    .execute(&mut *transaction)
                    .await?;
                } else {
                    sqlx::query!(
                        "UPDATE servers
                        SET allocation_uuid = $1
                        WHERE servers.uuid = $2",
                        allocation.uuid,
                        server.uuid,
                    )
                    .execute(&mut *transaction)
                    .await?;
                }
            } else if primary {
                sqlx::query!(
                    "UPDATE servers
                    SET allocation_uuid = $1
                    WHERE servers.uuid = $2",
                    allocation.uuid,
                    server.uuid,
                )
                .execute(&mut *transaction)
                .await?;
            }
        }

        transaction.commit().await?;

        Server::invalidate_cached(&state.database, server.uuid).await;

        activity_logger
            .log(
                "server:allocation.update",
                serde_json::json!({
                    "uuid": allocation.uuid,
                    "server_uuid": server.uuid,

                    "ip": allocation.allocation.ip,
                    "ip_alias": allocation.allocation.ip_alias,
                    "port": allocation.allocation.port,

                    "notes": allocation.notes,
                    "primary": data.primary,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(delete::route))
        .routes(routes!(patch::route))
        .with_state(state.clone())
}
