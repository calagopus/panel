use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod delete {
    use crate::routes::api::client::servers::_server_::databases::instances::_instance_::GetServerDatabaseInstance;
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{server::GetServerActivityLogger, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = BAD_REQUEST, body = ApiError),
        (status = CONFLICT, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "database_instance" = uuid::Uuid,
            description = "The database instance ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "operation" = uuid::Uuid,
            description = "The operation ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        database_instance: GetServerDatabaseInstance,
        activity_logger: GetServerActivityLogger,
        Path((_server, _database_instance, operation)): Path<(String, uuid::Uuid, uuid::Uuid)>,
    ) -> ApiResponseResult {
        permissions.has_server_permission("database-instances.import")?;

        tokio::spawn(async move {
            match database_instance
                .database_agent_host
                .api_client(&state.database)
                .await?
                .delete_instances_instance_operations_operation(database_instance.uuid, operation)
                .await
            {
                Ok(_) => {}
                Err(db_agent_api::client::ApiHttpError::Http(
                    status @ (StatusCode::NOT_FOUND
                    | StatusCode::BAD_REQUEST
                    | StatusCode::CONFLICT
                    | StatusCode::EXPECTATION_FAILED),
                    err,
                )) => {
                    return ApiResponse::new_serialized(ApiError::new_database_agent_value(err))
                        .with_status(status)
                        .ok();
                }
                Err(err) => return Err(err.into()),
            }

            activity_logger
                .log(
                    "server:database-instance.operation.cancel",
                    serde_json::json!({
                        "uuid": database_instance.uuid,
                        "name": database_instance.name,
                        "operation_uuid": operation,
                    }),
                )
                .await;

            ApiResponse::new_serialized(Response {}).ok()
        })
        .await?
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(delete::route))
        .with_state(state.clone())
}
