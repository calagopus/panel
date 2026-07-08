use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _database_agent_host_;
mod config;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoAdminApiObject, Pagination, PaginationParamsWithSearch,
            database_agent_host::DatabaseAgentHost, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        database_agent_hosts:
            Pagination<shared::models::database_agent_host::AdminApiDatabaseAgentHost>,
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

        permissions.has_admin_permission("database-agent-hosts.read")?;

        let database_agent_hosts = DatabaseAgentHost::all_with_pagination(
            &state.database,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        ApiResponse::new_serialized(Response {
            database_agent_hosts: database_agent_hosts
                .try_async_map(|host| host.into_admin_api_object(&state, ()))
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
            database_agent_host::{CreateDatabaseAgentHostOptions, DatabaseAgentHost},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        database_agent_host: shared::models::database_agent_host::AdminApiDatabaseAgentHost,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), request_body = inline(CreateDatabaseAgentHostOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<CreateDatabaseAgentHostOptions>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("database-agent-hosts.create")?;

        let database_agent_host = match DatabaseAgentHost::create(&state, data).await {
            Ok(host) => host,
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("database agent host with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        };

        activity_logger
            .log(
                "database-agent-host:create",
                serde_json::json!({
                    "uuid": database_agent_host.uuid,
                    "name": database_agent_host.name,
                    "url": database_agent_host.url,
                    "deployment_enabled": database_agent_host.deployment_enabled,
                    "maintenance_enabled": database_agent_host.maintenance_enabled,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            database_agent_host: database_agent_host
                .into_admin_api_object(&state, ())
                .await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest(
            "/{database_agent_host}",
            _database_agent_host_::router(state),
        )
        .nest("/config", config::router(state))
        .with_state(state.clone())
}
