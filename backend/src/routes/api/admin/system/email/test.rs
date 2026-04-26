use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{admin_activity::GetAdminActivityLogger, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
        settings::MailMode,
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(email, length(max = 255))]
        #[schema(format = "email", max_length = 255)]
        email: compact_str::CompactString,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("settings.read")?;

        let (subject, is_none) = state
            .settings
            .get_as(|s| {
                (
                    format!("{} - Email Connection Test", s.app.name),
                    matches!(s.mail_mode, MailMode::None),
                )
            })
            .await?;

        if is_none {
            return ApiResponse::error("email functionality is disabled in settings")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        if let Err(err) = state
            .mail
            .send_foreground(
                data.email.clone(),
                subject.into(),
                shared::mail::MAIL_CONNECTION_TEST,
                minijinja::context! {},
            )
            .await
        {
            return ApiResponse::error(format!("failed to send test email: {err}"))
                .with_status(StatusCode::INTERNAL_SERVER_ERROR)
                .ok();
        }

        activity_logger
            .log(
                "email:connection-test",
                serde_json::json!({
                    "email": data.email,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
