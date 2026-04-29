use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _identifier_;

mod get {
    use serde::Serialize;
    use shared::{
        GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct ResponseTemplate<'a> {
        identifier: &'static str,
        available_variables: &'a [&'static str],
    }

    #[derive(ToSchema, Serialize)]
    struct Response<'a> {
        #[schema(inline)]
        email_templates: Vec<ResponseTemplate<'a>>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route(state: GetState, permissions: GetPermissionManager) -> ApiResponseResult {
        permissions.has_admin_permission("email-templates.read")?;

        let mut email_templates = Vec::new();
        let templates = state.mail.templates.get_templates();

        for template in templates.iter() {
            email_templates.push(ResponseTemplate {
                identifier: template.identifier,
                available_variables: &template.available_variables,
            });
        }

        ApiResponse::new_serialized(Response { email_templates }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .nest("/{identifier}", _identifier_::router(state))
        .with_state(state.clone())
}
