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

        ApiResponse::new_serialized(Response {
            email_template: ResponseTemplate {
                available_variables: &template.available_variables,
                default_content: template.default_content,
                content: match template.get_content(&state).await? {
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
    use serde::{Deserialize, Serialize};
    use shared::{
        GetState,
        models::{admin_activity::GetAdminActivityLogger, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        content: Option<String>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(put, path = "/", responses(
        (status = OK, body = inline(Response)),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        Path(identifier): Path<String>,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("email-templates.update")?;

        let Ok(template) = state.mail.templates.get_template(&identifier) else {
            return ApiResponse::error("email template not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        };

        if let Some(content) = data.content {
            template.set_content(&state, &content).await?;
        } else {
            template.reset_content(&state).await?;
        }

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
