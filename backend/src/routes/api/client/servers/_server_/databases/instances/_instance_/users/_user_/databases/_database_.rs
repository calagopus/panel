use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod put {
    use crate::routes::api::client::servers::_server_::databases::instances::_instance_::GetServerDatabaseInstance;
    use axum::extract::Path;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            server::GetServerActivityLogger,
            server_database_instance::ApiServerDatabaseInstanceUserDatabase,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        permission: db_agent_api::DatabasePermission,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        database: Option<ApiServerDatabaseInstanceUserDatabase>,
    }

    #[utoipa::path(put, path = "/", responses(
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
        (
            "database" = uuid::Uuid,
            description = "The database ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetServerActivityLogger,
        database_instance: GetServerDatabaseInstance,
        Path((_server, _database_instance, user, database)): Path<(
            String,
            uuid::Uuid,
            uuid::Uuid,
            uuid::Uuid,
        )>,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_server_permission("database-instances.users")?;

        let response = database_instance
            .database_agent_host
            .api_client(&state.database)
            .await?
            .put_instances_instance_users_user_databases_database(
                database_instance.uuid,
                user,
                database,
                &db_agent_api::instances_instance_users_user_databases_database::put::RequestBody {
                    permission: data.permission,
                },
            )
            .await?;

        activity_logger
            .log(
                "server:database-instance.user.permission-update",
                serde_json::json!({
                    "uuid": database_instance.uuid,
                    "name": database_instance.name,
                    "user_uuid": user,
                    "database_uuid": database,
                    "permission": data.permission,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            database: response
                .database
                .map(ApiServerDatabaseInstanceUserDatabase::from),
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(put::route))
        .with_state(state.clone())
}
