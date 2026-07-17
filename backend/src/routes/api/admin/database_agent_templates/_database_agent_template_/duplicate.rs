use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::admin::database_agent_templates::_database_agent_template_::GetDatabaseAgentTemplate;
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            DuplicableModel, IntoAdminApiObject, admin_activity::GetAdminActivityLogger,
            database_agent_template::DuplicateDatabaseAgentTemplateOptions,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        name: compact_str::CompactString,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        database_agent_template:
            shared::models::database_agent_template::AdminApiDatabaseAgentTemplate,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), params(
        (
            "database_agent_template" = uuid::Uuid,
            description = "The database agent template ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        database_agent_template: GetDatabaseAgentTemplate,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("database-agent-templates.create")?;

        let options = DuplicateDatabaseAgentTemplateOptions { name: data.name };
        let duplicated =
            match DuplicableModel::duplicate(&database_agent_template.0, &state, options).await {
                Ok(database_agent_template) => database_agent_template,
                Err(err) if err.is_unique_violation() => {
                    return ApiResponse::error("database agent template with name already exists")
                        .with_status(StatusCode::CONFLICT)
                        .ok();
                }
                Err(err) => return ApiResponse::from(err).ok(),
            };

        activity_logger
            .log(
                "database-agent-template:duplicate",
                serde_json::json!({
                    "source_uuid": database_agent_template.uuid,
                    "source_name": database_agent_template.name,
                    "uuid": duplicated.uuid,
                    "name": duplicated.name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            database_agent_template: duplicated.into_admin_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
