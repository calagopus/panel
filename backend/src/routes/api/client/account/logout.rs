use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel,
            user::{AuthMethod, GetAuthMethod},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use tower_cookies::{Cookie, Cookies};
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
    ))]
    pub async fn route(
        state: GetState,
        auth: GetAuthMethod,
        cookies: Cookies,
    ) -> ApiResponseResult {
        let session = match auth.0 {
            AuthMethod::Session(session) => session,
            _ => {
                return ApiResponse::error(
                    "unable to log out when not using session authentication",
                )
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
            }
        };

        session.delete(&state, ()).await?;

        let settings = state.settings.get().await?;

        cookies.add(
            Cookie::build((settings.app.session_cookie.clone(), ""))
                .http_only(true)
                .same_site(tower_cookies::cookie::SameSite::Lax)
                .secure(settings.app.url.starts_with("https://"))
                .path("/")
                .expires(
                    tower_cookies::cookie::time::OffsetDateTime::now_utc()
                        + tower_cookies::cookie::time::Duration::seconds(2),
                )
                .build(),
        );

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
