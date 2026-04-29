use super::State;
use utoipa_axum::router::OpenApiRouter;

mod templates;
mod test;

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest("/test", test::router(state))
        .nest("/templates", templates::router(state))
        .with_state(state.clone())
}
