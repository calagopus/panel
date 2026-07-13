use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _database_;

mod get {
    use crate::routes::api::client::servers::_server_::databases::instances::_instance_::GetServerDatabaseInstance;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            server_database_instance::ApiServerDatabaseInstanceDatabase, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        databases: Vec<ApiServerDatabaseInstanceDatabase>,
    }

    #[utoipa::path(get, path = "/", responses(
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
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        database_instance: GetServerDatabaseInstance,
    ) -> ApiResponseResult {
        permissions.has_server_permission("database-instances.databases")?;

        let databases = database_instance
            .database_agent_host
            .api_client(&state.database)
            .await?
            .get_instances_instance_databases(database_instance.uuid)
            .await?
            .databases;

        ApiResponse::new_serialized(Response {
            databases: databases
                .into_iter()
                .map(ApiServerDatabaseInstanceDatabase::from)
                .collect(),
        })
        .ok()
    }
}

mod post {
    use crate::routes::api::client::servers::_server_::databases::instances::_instance_::GetServerDatabaseInstance;
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            server::GetServerActivityLogger,
            server_database_instance::ApiServerDatabaseInstanceDatabase,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(chars, min = 2, max = 23), pattern("^[a-zA-Z0-9]+$"))]
        #[schema(min_length = 2, max_length = 23, pattern = "^[a-zA-Z0-9]+$")]
        name: compact_str::CompactString,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        database: ApiServerDatabaseInstanceDatabase,
    }

    #[utoipa::path(post, path = "/", responses(
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
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetServerActivityLogger,
        database_instance: GetServerDatabaseInstance,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("database-instances.databases")?;

        let api_client = database_instance
            .database_agent_host
            .api_client(&state.database)
            .await?;

        let databases_lock = state
            .cache
            .lock(
                format!("database-instances::{}::databases", database_instance.uuid),
                Some(30),
                Some(5),
            )
            .await?;

        let databases = api_client
            .get_instances_instance_databases(database_instance.uuid)
            .await?
            .databases;
        if databases.len() as u64
            >= state
                .settings
                .get()
                .await?
                .server
                .max_database_instance_database_count
        {
            return ApiResponse::error("maximum number of databases reached")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let response = api_client
            .post_instances_instance_databases(
                database_instance.uuid,
                &db_agent_api::instances_instance_databases::post::RequestBody { name: data.name },
            )
            .await?;

        drop(databases_lock);

        activity_logger
            .log(
                "server:database-instance.database.create",
                serde_json::json!({
                    "uuid": database_instance.uuid,
                    "name": database_instance.name,
                    "database": response.database.name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            database: response.database.into(),
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/{database}", _database_::router(state))
        .with_state(state.clone())
}
