use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _name_;

mod get {
    use serde::Serialize;
    use shared::{
        GetState,
        extensions::email_templates::AdminApiEmailVariable,
        models::{IntoAdminApiObject, user::GetPermissionManager},
        prelude::AsyncIteratorExt,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        email_variables: Vec<AdminApiEmailVariable>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route(state: GetState, permissions: GetPermissionManager) -> ApiResponseResult {
        permissions.has_admin_permission("email-templates.read")?;

        let email_variables = state
            .mail
            .templates
            .get_variables(&state, None)
            .await?
            .into_iter()
            .map(|variable| variable.into_admin_api_object(&state, ()))
            .try_collect_async_vec()
            .await?;

        ApiResponse::new_serialized(Response { email_variables }).ok()
    }
}

mod post {
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        extensions::email_templates::CreateEmailVariable,
        models::{admin_activity::GetAdminActivityLogger, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), request_body = inline(CreateEmailVariable))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<CreateEmailVariable>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("settings.read")?;
        permissions.has_admin_permission("email-templates.update")?;

        if state
            .mail
            .templates
            .get_variables(&state, None)
            .await?
            .iter()
            .any(|variable| variable.name == data.name)
        {
            return ApiResponse::error("email variable with name already exists")
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        let name = data.name.clone();
        match state
            .mail
            .templates
            .create_variable(&state, None, data)
            .await
        {
            Ok(()) => {}
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("email variable with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        }

        activity_logger
            .log(
                "email:variables.create",
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
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/{name}", _name_::router(state))
        .with_state(state.clone())
}
