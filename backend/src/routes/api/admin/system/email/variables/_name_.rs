use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod put {
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        extensions::email_templates::UpdateEmailVariable,
        models::{admin_activity::GetAdminActivityLogger, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(put, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "name" = String,
            description = "The email variable name",
            example = "footer",
        ),
    ), request_body = inline(UpdateEmailVariable))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        Path(name): Path<String>,
        shared::Payload(data): shared::Payload<UpdateEmailVariable>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("settings.read")?;
        permissions.has_admin_permission("email-templates.update")?;

        let Some(variable) = state
            .mail
            .templates
            .get_variables(&state, None)
            .await?
            .into_iter()
            .find(|variable| variable.name == name)
        else {
            return ApiResponse::error("email variable not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        };

        if !variable.is_system() && matches!(data.value, Some(None)) {
            return ApiResponse::error("custom email variables must have a value")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        state
            .mail
            .templates
            .update_variable(&state, &variable, data)
            .await?;

        activity_logger
            .log(
                "email:variables.update",
                serde_json::json!({
                    "template_identifier": null,
                    "name": name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod delete {
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{admin_activity::GetAdminActivityLogger, user::GetPermissionManager},
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
            "name" = String,
            description = "The email variable name",
            example = "footer",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        Path(name): Path<String>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("settings.read")?;
        permissions.has_admin_permission("email-templates.update")?;

        let Some(variable) = state
            .mail
            .templates
            .get_variables(&state, None)
            .await?
            .into_iter()
            .find(|variable| variable.name == name)
        else {
            return ApiResponse::error("email variable not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        };

        state
            .mail
            .templates
            .delete_variable(&state, &variable)
            .await?;

        activity_logger
            .log(
                if variable.is_system() {
                    "email:variables.reset"
                } else {
                    "email:variables.delete"
                },
                serde_json::json!({
                    "template_identifier": null,
                    "name": name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(put::route))
        .routes(routes!(delete::route))
        .with_state(state.clone())
}
