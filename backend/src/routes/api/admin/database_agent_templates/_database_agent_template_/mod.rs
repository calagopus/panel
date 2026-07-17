use super::State;
use axum::{
    extract::{Path, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{
    GetState,
    models::{ByUuid, database_agent_template::DatabaseAgentTemplate, user::GetPermissionManager},
    response::ApiResponse,
};
use utoipa_axum::{router::OpenApiRouter, routes};

mod duplicate;
mod instances;

pub type GetDatabaseAgentTemplate = shared::extract::ConsumingExtension<DatabaseAgentTemplate>;

pub async fn auth(
    state: GetState,
    permissions: GetPermissionManager,
    Path(database_agent_template): Path<Vec<String>>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let database_agent_template = match database_agent_template
        .first()
        .map(|s| s.parse::<uuid::Uuid>())
    {
        Some(Ok(id)) => id,
        _ => {
            return Ok(ApiResponse::error("invalid database agent template uuid")
                .with_status(StatusCode::BAD_REQUEST)
                .into_response());
        }
    };

    if let Err(err) = permissions.has_admin_permission("database-agent-templates.read") {
        return Ok(err.into_response());
    }

    let database_agent_template =
        DatabaseAgentTemplate::by_uuid_optional(&state.database, database_agent_template).await;
    let database_agent_template = match database_agent_template {
        Ok(Some(database_agent_template)) => database_agent_template,
        Ok(None) => {
            return Ok(ApiResponse::error("database agent template not found")
                .with_status(StatusCode::NOT_FOUND)
                .into_response());
        }
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    req.extensions_mut().insert(database_agent_template);

    Ok(next.run(req).await)
}

mod get {
    use crate::routes::api::admin::database_agent_templates::_database_agent_template_::GetDatabaseAgentTemplate;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{IntoAdminApiObject, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        database_agent_template:
            shared::models::database_agent_template::AdminApiDatabaseAgentTemplate,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "database_agent_template" = uuid::Uuid,
            description = "The database agent template ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        database_agent_template: GetDatabaseAgentTemplate,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("database-agent-templates.read")?;

        ApiResponse::new_serialized(Response {
            database_agent_template: database_agent_template
                .0
                .into_admin_api_object(&state, ())
                .await?,
        })
        .ok()
    }
}

mod delete {
    use crate::routes::api::admin::database_agent_templates::_database_agent_template_::GetDatabaseAgentTemplate;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel, admin_activity::GetAdminActivityLogger, user::GetPermissionManager,
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
            "database_agent_template" = uuid::Uuid,
            description = "The database agent template ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        database_agent_template: GetDatabaseAgentTemplate,
        activity_logger: GetAdminActivityLogger,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("database-agent-templates.delete")?;

        database_agent_template.delete(&state, ()).await?;

        activity_logger
            .log(
                "database-agent-template:delete",
                serde_json::json!({
                    "uuid": database_agent_template.uuid,
                    "name": database_agent_template.name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod patch {
    use crate::routes::api::admin::database_agent_templates::_database_agent_template_::GetDatabaseAgentTemplate;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            UpdatableModel, admin_activity::GetAdminActivityLogger,
            database_agent_template::UpdateDatabaseAgentTemplateOptions,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(patch, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
        (status = BAD_REQUEST, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), params(
        (
            "database_agent_template" = uuid::Uuid,
            description = "The database agent template ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(UpdateDatabaseAgentTemplateOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        mut database_agent_template: GetDatabaseAgentTemplate,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<UpdateDatabaseAgentTemplateOptions>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("database-agent-templates.update")?;

        match database_agent_template.update(&state, data).await {
            Ok(_) => {}
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("database agent template with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        }

        activity_logger
            .log(
                "database-agent-template:update",
                serde_json::json!({
                    "uuid": database_agent_template.uuid,
                    "name": database_agent_template.name,
                    "type": database_agent_template.r#type,
                    "deployment_enabled": database_agent_template.deployment_enabled,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(delete::route))
        .routes(routes!(patch::route))
        .nest("/duplicate", duplicate::router(state))
        .nest("/instances", instances::router(state))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
