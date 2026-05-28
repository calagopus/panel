use super::{GetState, State};
use axum::routing::get;
use shared::response::ApiResponse;
use utoipa_axum::router::OpenApiRouter;

pub mod admin;
mod announcements;
pub mod auth;
pub mod client;
mod languages;
pub mod remote;
mod settings;

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .route(
            "/",
            get(|state: GetState| async move {
                let settings = state.settings.get().await?;

                let mut environment = minijinja::Environment::new();
                environment.set_auto_escape_callback(|_| minijinja::AutoEscape::Html);
                environment.add_global("settings", minijinja::Value::from_serialize(&*settings));
                drop(settings);

                let api_html = environment.render_str(
                    include_str!("../../../static/api.html"),
                    minijinja::Value::default(),
                )?;

                ApiResponse::new(axum::body::Body::from(api_html))
                    .with_header("Content-Type", "text/html")
                    .ok()
            }),
        )
        .nest("/settings", settings::router(state))
        .nest("/announcements", announcements::router(state))
        .nest("/languages", languages::router(state))
        .nest("/auth", auth::router(state))
        .nest("/client", client::router(state))
        .nest("/admin", admin::router(state))
        .nest("/remote", remote::router(state))
        .with_state(state.clone())
}
