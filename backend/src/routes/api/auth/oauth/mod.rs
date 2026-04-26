use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _oauth_provider_;
mod redirect;

mod get {
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoApiObject,
            oauth_provider::{ApiOAuthProvider, OAuthProvider},
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
        (status = NOT_FOUND, body = ApiError),
    ))]
    pub async fn route(state: GetState, ip: shared::GetIp) -> ApiResponseResult {
        state
            .cache
            .ratelimit("auth/oauth", 12, 60, ip.to_string())
            .await?;

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
        .nest("/redirect", redirect::router(state))
        .nest("/{oauth_provider}", _oauth_provider_::router(state))
        .with_state(state.clone())
}
