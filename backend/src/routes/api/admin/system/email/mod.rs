use super::State;
use utoipa_axum::router::OpenApiRouter;

mod templates;
mod test;
mod variables;

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest("/test", test::router(state))
        .nest("/templates", templates::router(state))
        .nest("/variables", variables::router(state))
        .with_state(state.clone())
}
