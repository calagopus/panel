use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _database_host_;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoAdminApiObject, Pagination, PaginationParamsWithSearch,
            database_host::DatabaseHost, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        database_hosts: Pagination<shared::models::database_host::AdminApiDatabaseHost>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ), params(
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
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        Query(params): Query<PaginationParamsWithSearch>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("database-hosts.read")?;

        let database_hosts = DatabaseHost::all_with_pagination(
            &state.database,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        ApiResponse::new_serialized(Response {
            database_hosts: database_hosts
                .try_async_map(|database_host| database_host.into_admin_api_object(&state, ()))
                .await?,
        })
        .ok()
    }
}

mod post {
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel, IntoAdminApiObject,
            admin_activity::GetAdminActivityLogger,
            database_host::{CreateDatabaseHostOptions, DatabaseHost},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        database_host: shared::models::database_host::AdminApiDatabaseHost,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), request_body = inline(CreateDatabaseHostOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<CreateDatabaseHostOptions>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("database-hosts.create")?;

        let mut database_host = match DatabaseHost::create(&state, data).await {
            Ok(database_host) => database_host,
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("database host with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        };

        database_host.credentials.censor();

        activity_logger
            .log(
                "database-host:create",
                serde_json::json!({
                    "uuid": database_host.uuid,
                    "name": database_host.name,
                    "type": database_host.r#type,

                    "deployment_enabled": database_host.deployment_enabled,
                    "maintenance_enabled": database_host.maintenance_enabled,

                    "public_host": database_host.public_host,
                    "public_port": database_host.public_port,

                    "credentials": database_host.credentials,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            database_host: database_host.into_admin_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/{database_host}", _database_host_::router(state))
        .with_state(state.clone())
}
