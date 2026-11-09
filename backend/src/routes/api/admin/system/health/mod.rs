use super::State;
use utoipa_axum::router::OpenApiRouter;

mod general;
mod nodes;
mod proxies;

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest("/general", general::router(state))
        .nest("/nodes", nodes::router(state))
        .nest("/proxies", proxies::router(state))
        .with_state(state.clone())
}
