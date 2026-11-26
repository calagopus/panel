use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{IntoAdminApiObject, server_database::ServerDatabase, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        database: shared::models::server_database::AdminApiServerDatabase,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "database" = String,
            description = "The database name or username",
            example = "u1a2b3c4d_AbCdEfGhIj",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        Path(database): Path<String>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("servers.read")?;
        permissions.has_admin_permission("database-hosts.read")?;

        let database = match ServerDatabase::by_name_or_username(&state.database, &database).await?
        {
            Some(database) => database,
            None => {
                return ApiResponse::error("database not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        };

        ApiResponse::new_serialized(Response {
            database: database
                .into_admin_api_object(&state, &state.storage.retrieve_urls().await?)
                .await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
