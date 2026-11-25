use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::{extract::Path, http::StatusCode};
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        mail::EmailTemplatePreview,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(
            length(chars, min = 2, max = 15),
            custom(shared::utils::validate_language)
        )]
        #[schema(min_length = 2, max_length = 15)]
        language: compact_str::CompactString,
        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        subject: Option<String>,
        #[garde(length(chars, min = 1))]
        #[schema(min_length = 1)]
        content: Option<String>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        subject: String,
        body: String,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "identifier" = String,
            description = "The email template identifier",
            example = "password_reset",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        Path(identifier): Path<String>,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("settings.read")?;
        permissions.has_admin_permission("email-templates.update")?;

        if state.mail.templates.get_template(&identifier).is_err() {
            return ApiResponse::error("email template not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        }

        match state
            .mail
            .preview_template(
                &state,
                &identifier,
                &data.language,
                data.subject,
                data.content,
            )
            .await?
        {
            EmailTemplatePreview::Rendered { subject, body } => {
                ApiResponse::new_serialized(Response { subject, body }).ok()
            }
            EmailTemplatePreview::Failed(err) => ApiResponse::error(err)
                .with_status(StatusCode::BAD_REQUEST)
                .ok(),
            EmailTemplatePreview::Unavailable => {
                ApiResponse::error("this email template does not provide preview data")
                    .with_status(StatusCode::BAD_REQUEST)
                    .ok()
            }
        }
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
