use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod rotate_password;

mod delete {
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
            "database_instance" = uuid::Uuid,
            description = "The database instance ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "user" = uuid::Uuid,
            description = "The user ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetServerActivityLogger,
        database_instance: GetServerDatabaseInstance,
        Path((_server, _database_instance, user)): Path<(String, uuid::Uuid, uuid::Uuid)>,
    ) -> ApiResponseResult {
        permissions.has_server_permission("database-instances.users")?;

        database_instance
            .database_agent_host
            .api_client(&state.database)
            .await?
            .delete_instances_instance_users_user(database_instance.uuid, user)
            .await?;

        activity_logger
            .log(
                "server:database-instance.user.delete",
                serde_json::json!({
                    "uuid": database_instance.uuid,
                    "name": database_instance.name,
                    "user_uuid": user,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(delete::route))
        .nest("/rotate-password", rotate_password::router(state))
        .with_state(state.clone())
}
