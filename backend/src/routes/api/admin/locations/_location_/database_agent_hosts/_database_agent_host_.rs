use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod delete {
    use crate::routes::api::admin::locations::_location_::GetLocation;
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel, admin_activity::GetAdminActivityLogger,
            location_database_agent_host::LocationDatabaseAgentHost, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "location" = uuid::Uuid,
            description = "The location ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "database_agent_host" = uuid::Uuid,
            description = "The database agent host ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        location: GetLocation,
        activity_logger: GetAdminActivityLogger,
        Path((_location, database_agent_host)): Path<(uuid::Uuid, uuid::Uuid)>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("locations.database-agent-hosts")?;

        let location_database_agent_host =
            match LocationDatabaseAgentHost::by_location_uuid_database_agent_host_uuid(
                &state.database,
                location.uuid,
                database_agent_host,
            )
            .await?
            {
                Some(host) => host,
                None => {
                    return ApiResponse::error("database agent host not found")
                        .with_status(StatusCode::NOT_FOUND)
                        .ok();
                }
            };

        location_database_agent_host.delete(&state, ()).await?;

        activity_logger
            .log(
                "location:database-agent-host.delete",
                serde_json::json!({
                    "location_uuid": location.uuid,
                    "database_agent_host_uuid": location_database_agent_host.database_agent_host.uuid,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(delete::route))
        .with_state(state.clone())
}
