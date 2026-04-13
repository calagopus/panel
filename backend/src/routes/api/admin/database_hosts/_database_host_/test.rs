use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::admin::database_hosts::_database_host_::GetDatabaseHost;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "database_host" = uuid::Uuid,
            description = "The database host ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        mut database_host: GetDatabaseHost,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("database-hosts.test")?;

        match database_host.get_connection(&state.database).await {
            Ok(pool) => match pool {
                shared::models::database_host::DatabasePool::Mysql(pool) => {
                    if let Err(err) = sqlx::query("SELECT 1").execute(&pool).await {
                        return ApiResponse::error(err.to_string())
                            .with_status(StatusCode::EXPECTATION_FAILED)
                            .ok();
                    }
                }
                shared::models::database_host::DatabasePool::Postgres(pool) => {
                    if let Err(err) = sqlx::query("SELECT 1").execute(&pool).await {
                        return ApiResponse::error(err.to_string())
                            .with_status(StatusCode::EXPECTATION_FAILED)
                            .ok();
                    }
                }
                shared::models::database_host::DatabasePool::Mongodb(client) => {
                    if let Err(err) = client.list_databases().await {
                        return ApiResponse::error(err.to_string())
                            .with_status(StatusCode::EXPECTATION_FAILED)
                            .ok();
                    }
                }
            },
            Err(err) => {
                return ApiResponse::error(err.to_string())
                    .with_status(StatusCode::EXPECTATION_FAILED)
                    .ok();
            }
        }

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
