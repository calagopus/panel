use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use axum::{body::Body, extract::Path, http::StatusCode};
    use oauth2::{AuthUrl, ClientId, CsrfToken, RedirectUrl, Scope, basic::BasicClient};
    use shared::{
        ApiError, GetState,
        models::{ByUuid, oauth_provider::OAuthProvider},
        response::{ApiResponse, ApiResponseResult},
    };
    use tower_cookies::{Cookie, Cookies, cookie::SameSite};

    #[utoipa::path(get, path = "/", responses(
        (status = TEMPORARY_REDIRECT, body = String),
        (status = NOT_FOUND, body = ApiError),
    ))]
    pub async fn route(
        state: GetState,
        ip: shared::GetIp,
        cookies: Cookies,
        Path(oauth_provider): Path<uuid::Uuid>,
    ) -> ApiResponseResult {
        state
            .cache
            .ratelimit(
                format!("auth/oauth/redirect/{}", oauth_provider),
                6,
                300,
                ip.to_string(),
            )
            .await?;

        let oauth_provider =
            match OAuthProvider::by_uuid_optional_cached(&state.database, oauth_provider).await? {
                Some(oauth_provider) => oauth_provider,
                None => {
                    return ApiResponse::error("oauth provider not found")
                        .with_status(StatusCode::NOT_FOUND)
                        .ok();
                }
            };

        if !oauth_provider.enabled {
            return ApiResponse::error("oauth provider not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        }

        let settings = state.settings.get().await?;

        let client = BasicClient::new(ClientId::new(oauth_provider.client_id.to_string()))
            .set_auth_uri(AuthUrl::new(oauth_provider.auth_url.clone())?)
            .set_redirect_uri(RedirectUrl::new(format!(
                "{}/api/auth/oauth/{}",
                settings.app.url.trim_end_matches('/'),
                oauth_provider.uuid
            ))?);

        let secure = settings.app.url.starts_with("https://");
        let provider_uuid = oauth_provider.uuid;

        drop(settings);

        let mut url = client.authorize_url(CsrfToken::new_random);
        for scope in oauth_provider.scopes {
            url = url.add_scope(Scope::new(scope.into()));
        }

        let (authorization_url, csrf_state) = url.url();

        state
            .cache
            .set(
                &format!("oauth_state::{}::{}", provider_uuid, csrf_state.secret()),
                10 * 60,
                &0u16,
            )
            .await?;

        cookies.add(
            Cookie::build(("oauth_state", csrf_state.secret().to_owned()))
                .http_only(true)
                .same_site(SameSite::Lax)
                .secure(secure)
                .path("/api/auth/oauth")
                .max_age(tower_cookies::cookie::time::Duration::minutes(10))
                .build(),
        );

        ApiResponse::new(Body::empty())
            .with_header("Location", authorization_url.as_ref())
            .with_status(StatusCode::TEMPORARY_REDIRECT)
            .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
