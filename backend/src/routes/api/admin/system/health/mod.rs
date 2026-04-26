use super::State;
use utoipa_axum::router::OpenApiRouter;

mod general;
mod nodes;

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest("/general", general::router(state))
        .nest("/nodes", nodes::router(state))
        .with_state(state.clone())
}
