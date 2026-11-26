use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            ByUuid, IntoAdminApiObject, server_database_instance::ServerDatabaseInstance,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        database_instance: shared::models::server_database_instance::AdminApiServerDatabaseInstance,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "instance" = String,
            description = "The database instance ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        Path(instance): Path<String>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("servers.read")?;
        permissions.has_admin_permission("database-agent-hosts.read")?;

        let instance = match uuid::Uuid::parse_str(&instance) {
            Ok(uuid) => ServerDatabaseInstance::by_uuid_optional(&state.database, uuid).await?,
            Err(_) => None,
        };

        let instance = match instance {
            Some(instance) => instance,
            None => {
                return ApiResponse::error("database instance not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        };

        ApiResponse::new_serialized(Response {
            database_instance: instance
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
