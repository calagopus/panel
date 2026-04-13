use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use crate::routes::api::admin::oauth_providers::_oauth_provider_::GetOAuthProvider;
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{user::GetPermissionManager, user_oauth_link::UserOAuthLink},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        user_oauth_link: shared::models::user_oauth_link::AdminApiUserOAuthLink,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "oauth_provider" = uuid::Uuid,
            description = "The oauth provider ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "identifier" = String,
            description = "The identifier of the user oauth link (e.g. email or username)",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        oauth_provider: GetOAuthProvider,
        Path((_oauth_provider, identifier)): Path<(uuid::Uuid, String)>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("oauth-providers.read")?;

        let user_oauth_link = match UserOAuthLink::by_oauth_provider_uuid_identifier(
            &state.database,
            oauth_provider.uuid,
            &identifier,
        )
        .await?
        {
            Some(link) => link,
            None => {
                return ApiResponse::error("user oauth link not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        };

        ApiResponse::new_serialized(Response {
            user_oauth_link: user_oauth_link
                .into_admin_api_object(&state.database, &state.storage.retrieve_urls().await?)
                .await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
