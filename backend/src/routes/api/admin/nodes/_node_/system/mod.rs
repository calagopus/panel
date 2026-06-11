use super::State;
use utoipa_axum::router::OpenApiRouter;

mod logs;
mod overview;
mod stats;

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest("/logs", logs::router(state))
        .nest("/overview", overview::router(state))
        .nest("/stats", stats::router(state))
        .with_state(state.clone())
}
