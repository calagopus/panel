use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::client::servers::_server_::databases::instances::_instance_::GetServerDatabaseInstance;
    use axum::extract::Path;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{server::GetServerActivityLogger, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
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
            "database_instance" = uuid::Uuid,
            description = "The database instance ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "database" = uuid::Uuid,
            description = "The database ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetServerActivityLogger,
        database_instance: GetServerDatabaseInstance,
        Path((_server, _database_instance, database)): Path<(String, uuid::Uuid, uuid::Uuid)>,
    ) -> ApiResponseResult {
        permissions.has_server_permission("database-instances.recreate")?;

        database_instance
            .database_agent_host
            .api_client(&state.database)
            .await?
            .post_instances_instance_databases_database_recreate(database_instance.uuid, database)
            .await?;

        activity_logger
            .log(
                "server:database-instance.database.recreate",
                serde_json::json!({
                    "uuid": database_instance.uuid,
                    "name": database_instance.name,
                    "database_uuid": database,
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
