use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use std::borrow::Cow;
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct ResponseTemplate<'a> {
        available_variables: &'a [&'static str],
        default_enabled: bool,
        enabled: bool,
        default_subject: &'static str,
        subject: Option<String>,
        default_content: &'static str,
        content: Option<String>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response<'a> {
        #[schema(inline)]
        email_template: ResponseTemplate<'a>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        Path(identifier): Path<String>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("email-templates.read")?;

        let Ok(template) = state.mail.templates.get_template(&identifier) else {
            return ApiResponse::error("email template not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        };
        let fetched_template = template.get(&state).await?;

        ApiResponse::new_serialized(Response {
            email_template: ResponseTemplate {
                available_variables: &template.available_variables,
                default_enabled: template.default_enabled,
                enabled: fetched_template.enabled,
                default_subject: template.default_subject,
                subject: match fetched_template.subject {
                    Cow::Owned(subject) => Some(subject),
                    Cow::Borrowed(_) => None,
                },
                default_content: template.default_content,
                content: match fetched_template.content {
                    Cow::Owned(content) => Some(content),
                    Cow::Borrowed(_) => None,
                },
            },
        })
        .ok()
    }
}

mod put {
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        GetState,
        extensions::email_templates::UpdateEmailTemplate,
        models::{admin_activity::GetAdminActivityLogger, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(put, path = "/", responses(
        (status = OK, body = inline(Response)),
    ), request_body = inline(UpdateEmailTemplate))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        Path(identifier): Path<String>,
        shared::Payload(data): shared::Payload<UpdateEmailTemplate>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("settings.read")?;
        permissions.has_admin_permission("email-templates.update")?;

        let Ok(template) = state.mail.templates.get_template(&identifier) else {
            return ApiResponse::error("email template not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        };

        template.update(&state, data).await?;

        activity_logger
            .log(
                "email:templates.update",
                serde_json::json!({
                    "identifier": identifier,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(put::route))
        .with_state(state.clone())
}
