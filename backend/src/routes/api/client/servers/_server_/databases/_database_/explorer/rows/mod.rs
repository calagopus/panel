use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod delete;
mod insert;
mod update;

mod post {
    use crate::routes::api::client::servers::_server_::databases::_database_::GetServerDatabase;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            server_database::{BrowseOptions, QueryResultSet},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        result: QueryResultSet,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "database" = uuid::Uuid,
            description = "The database ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(BrowseOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        mut database: GetServerDatabase,
        shared::Payload(data): shared::Payload<BrowseOptions>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("databases.query")?;

        if database.database_host.maintenance_enabled {
            return ApiResponse::error(
                "cannot browse database while database host is in maintenance mode",
            )
            .with_status(StatusCode::EXPECTATION_FAILED)
            .ok();
        }

        let result = match database.browse_rows(&state.database, &data).await {
            Ok(result) => result,
            Err(err) => return ApiResponse::from(err).ok(),
        };

        ApiResponse::new_serialized(Response { result }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .nest("/insert", insert::router(state))
        .nest("/update", update::router(state))
        .nest("/delete", delete::router(state))
        .with_state(state.clone())
}
