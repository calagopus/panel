use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _database_agent_template_;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoAdminApiObject, Pagination, PaginationParamsWithSearch,
            database_agent_template::DatabaseAgentTemplate, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        database_agent_templates:
            Pagination<shared::models::database_agent_template::AdminApiDatabaseAgentTemplate>,
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

        permissions.has_admin_permission("database-agent-templates.read")?;

        let database_agent_templates = DatabaseAgentTemplate::all_with_pagination(
            &state.database,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        ApiResponse::new_serialized(Response {
            database_agent_templates: database_agent_templates
                .try_async_map(|template| template.into_admin_api_object(&state, ()))
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
            database_agent_template::{CreateDatabaseAgentTemplateOptions, DatabaseAgentTemplate},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        database_agent_template:
            shared::models::database_agent_template::AdminApiDatabaseAgentTemplate,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), request_body = inline(CreateDatabaseAgentTemplateOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<CreateDatabaseAgentTemplateOptions>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("database-agent-templates.create")?;

        let database_agent_template = match DatabaseAgentTemplate::create(&state, data).await {
            Ok(template) => template,
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("database agent template with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        };

        activity_logger
            .log(
                "database-agent-template:create",
                serde_json::json!({
                    "uuid": database_agent_template.uuid,
                    "name": database_agent_template.name,
                    "type": database_agent_template.r#type,
                    "deployment_enabled": database_agent_template.deployment_enabled,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            database_agent_template: database_agent_template
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
            "/{database_agent_template}",
            _database_agent_template_::router(state),
        )
        .with_state(state.clone())
}
