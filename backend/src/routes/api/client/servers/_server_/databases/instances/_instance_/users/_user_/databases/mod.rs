use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _database_;

mod put {
    use crate::routes::api::client::servers::_server_::databases::instances::_instance_::GetServerDatabaseInstance;
    use axum::{extract::Path, http::StatusCode};
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            server::GetServerActivityLogger,
            server_database_instance::{
                ApiServerDatabaseInstanceUserDatabase, ServerDatabaseInstanceUserDatabaseGrant,
            },
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[serde(default)]
        #[garde(dive)]
        databases: Vec<ServerDatabaseInstanceUserDatabaseGrant>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        databases: Vec<ApiServerDatabaseInstanceUserDatabase>,
    }

    #[utoipa::path(put, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
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
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetServerActivityLogger,
        database_instance: GetServerDatabaseInstance,
        Path((_server, _database_instance, user)): Path<(String, uuid::Uuid, uuid::Uuid)>,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("database-instances.users")?;

        let databases: Vec<_> = data
            .databases
            .into_iter()
            .map(ServerDatabaseInstanceUserDatabaseGrant::into_api)
            .collect();

        let response = database_instance
            .database_agent_host
            .api_client(&state.database)
            .await?
            .put_instances_instance_users_user_databases(
                database_instance.uuid,
                user,
                &db_agent_api::instances_instance_users_user_databases::put::RequestBody {
                    databases,
                },
            )
            .await?;

        activity_logger
            .log(
                "server:database-instance.user.permissions-update",
                serde_json::json!({
                    "uuid": database_instance.uuid,
                    "name": database_instance.name,
                    "user_uuid": user,
                    "databases": response.databases.iter().map(|database| serde_json::json!({
                        "database_uuid": database.database_uuid,
                        "permission": database.permission,
                    })).collect::<Vec<_>>(),
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            databases: response
                .databases
                .into_iter()
                .map(ApiServerDatabaseInstanceUserDatabase::from)
                .collect(),
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(put::route))
        .nest("/{database}", _database_::router(state))
        .with_state(state.clone())
}
