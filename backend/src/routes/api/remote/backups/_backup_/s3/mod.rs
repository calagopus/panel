use super::State;
use utoipa_axum::router::OpenApiRouter;

mod parts;

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest("/parts", parts::router(state))
        .with_state(state.clone())
}
