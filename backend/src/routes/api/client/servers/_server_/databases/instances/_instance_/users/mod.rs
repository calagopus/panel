use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _user_;

mod get {
    use crate::routes::api::client::servers::_server_::databases::instances::_instance_::GetServerDatabaseInstance;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            server_database_instance::ApiServerDatabaseInstanceUser, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        users: Vec<ApiServerDatabaseInstanceUser>,
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
        permissions.has_server_permission("database-instances.users")?;

        let users = database_instance
            .database_agent_host
            .api_client(&state.database)
            .await?
            .get_instances_instance_users(database_instance.uuid)
            .await?
            .users;

        ApiResponse::new_serialized(Response {
            users: users
                .into_iter()
                .map(ApiServerDatabaseInstanceUser::from)
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
            server_database_instance::ApiServerDatabaseInstanceUser, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(chars, min = 2, max = 23), pattern("^[a-zA-Z0-9]+$"))]
        #[schema(min_length = 2, max_length = 23, pattern = "^[a-zA-Z0-9]+$")]
        username: compact_str::CompactString,

        #[garde(skip)]
        database_uuid: Option<uuid::Uuid>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        user: ApiServerDatabaseInstanceUser,
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

        permissions.has_server_permission("database-instances.users")?;

        let response = database_instance
            .database_agent_host
            .api_client(&state.database)
            .await?
            .post_instances_instance_users(
                database_instance.uuid,
                &db_agent_api::instances_instance_users::post::RequestBody {
                    username: data.username,
                    database_uuid: data.database_uuid,
                },
            )
            .await?;

        activity_logger
            .log(
                "server:database-instance.user.create",
                serde_json::json!({
                    "uuid": database_instance.uuid,
                    "name": database_instance.name,
                    "username": response.username,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            user: response.user.into(),
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/{user}", _user_::router(state))
        .with_state(state.clone())
}
