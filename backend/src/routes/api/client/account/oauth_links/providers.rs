use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use serde::Serialize;
    use shared::{
        GetState,
        models::{
            IntoApiObject,
            oauth_provider::{ApiOAuthProvider, OAuthProvider},
            user::GetPermissionManager,
        },
        prelude::AsyncIteratorExt,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        oauth_providers: Vec<ApiOAuthProvider>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route(state: GetState, permissions: GetPermissionManager) -> ApiResponseResult {
        permissions.has_user_permission("oauth-links.read")?;

        let oauth_providers = state
            .cache
            .cached("oauth_providers::usable", 60, || async {
                OAuthProvider::all_by_usable(&state.database).await
            })
            .await?;

        ApiResponse::new_serialized(Response {
            oauth_providers: oauth_providers
                .into_iter()
                .map(|oauth_provider| oauth_provider.into_api_object(&state, ()))
                .try_collect_async_vec()
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
