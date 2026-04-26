use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _database_;
mod hosts;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            IntoApiObject, Pagination, server::GetServer, server_database::ServerDatabase,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Params {
        #[garde(range(min = 1))]
        #[serde(default = "Pagination::default_page")]
        page: i64,
        #[garde(range(min = 1, max = 100))]
        #[serde(default = "Pagination::default_per_page")]
        per_page: i64,
        #[garde(length(chars, min = 1, max = 100))]
        #[serde(
            default,
            deserialize_with = "shared::deserialize::deserialize_string_option"
        )]
        search: Option<compact_str::CompactString>,

        #[garde(skip)]
        #[serde(default)]
        include_password: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        databases: Pagination<shared::models::server_database::ApiServerDatabase>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "page" = i64, Query,
            description = "The page number",
            example = "1",
        ),
        (
            "per_page" = i64, Query,
            description = "The number of items per page",
            example = "10",
        ),
        (
            "search" = Option<String>, Query,
            description = "Search term for items",
        ),
        (
            "include_password" = bool, Query,
            description = "Whether to include the database password in the response",
            example = "true",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("databases.read")?;

        let databases = ServerDatabase::by_server_uuid_with_pagination(
            &state.database,
            server.uuid,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        let can_read_password = permissions
            .has_server_permission("databases.read-password")
            .is_ok();

        ApiResponse::new_serialized(Response {
            databases: databases
                .try_async_map(|database| {
                    database.into_api_object(&state, params.include_password && can_read_password)
                })
                .await?,
        })
        .ok()
    }
}

mod post {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel, IntoApiObject,
            database_host::DatabaseHost,
            server::{GetServer, GetServerActivityLogger},
            server_database::ServerDatabase,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(skip)]
        database_host_uuid: uuid::Uuid,

        #[garde(length(chars, min = 3, max = 31), pattern("^[a-zA-Z0-9_]+$"))]
        #[schema(min_length = 3, max_length = 31, pattern = "^[a-zA-Z0-9_]+$")]
        name: compact_str::CompactString,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        database: shared::models::server_database::ApiServerDatabase,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        activity_logger: GetServerActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("databases.create")?;

        let database_host = match DatabaseHost::by_location_uuid_uuid(
            &state.database,
            server
                .node
                .fetch_cached(&state.database)
                .await?
                .location
                .uuid,
            data.database_host_uuid,
        )
        .await?
        {
            Some(host) => host,
            None => {
                return ApiResponse::error("database host not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        };

        let databases_lock = state
            .cache
            .lock(
                format!("servers::{}::databases", server.uuid),
                Some(30),
                Some(5),
            )
            .await?;

        let databases = ServerDatabase::count_by_server_uuid(&state.database, server.uuid).await;
        if databases >= server.database_limit as i64 {
            return ApiResponse::error("maximum number of databases reached")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        if database_host.maintenance_enabled {
            return ApiResponse::error(
                "cannot create database while database host is in maintenance mode",
            )
            .with_status(StatusCode::EXPECTATION_FAILED)
            .ok();
        }

        let options = shared::models::server_database::CreateServerDatabaseOptions {
            server: &server,
            database_host: &database_host,
            name: data.name,
        };
        let database = match ServerDatabase::create(&state, options).await {
            Ok(database) => database,
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("database with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        };

        drop(databases_lock);

        activity_logger
            .log(
                "server:database.create",
                serde_json::json!({
                    "uuid": database.uuid,
                    "name": database.name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            database: database
                .into_api_object(
                    &state,
                    permissions
                        .has_server_permission("databases.read-password")
                        .is_ok(),
                )
                .await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/{database}", _database_::router(state))
        .nest("/hosts", hosts::router(state))
        .with_state(state.clone())
}
