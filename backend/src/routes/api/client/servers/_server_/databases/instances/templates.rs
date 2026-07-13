use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoApiObject, database_agent_host::DatabaseAgentHost,
            database_agent_template::DatabaseAgentTemplate, server::GetServer,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        templates: Vec<shared::models::database_agent_template::ApiDatabaseAgentTemplate>,
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
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
    ) -> ApiResponseResult {
        permissions.has_server_permission("database-instances.create")?;

        let location_uuid = server
            .node
            .fetch_cached(&state.database)
            .await?
            .location
            .uuid;

        let mut templates = Vec::new();
        for template in DatabaseAgentTemplate::all_deployment_enabled(&state.database).await? {
            let hosts = DatabaseAgentHost::by_location_uuid_most_eligible(
                &state.database,
                location_uuid,
                template.r#type,
                template.memory,
                template.disk,
            )
            .await?;

            if !hosts.is_empty() {
                templates.push(template.into_api_object(&state, ()).await?);
            }
        }

        ApiResponse::new_serialized(Response { templates }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
