use super::State;
use utoipa_axum::router::OpenApiRouter;

mod restore;
mod restore_target;
mod source;

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest("/source", source::router(state))
        .nest("/restore-target", restore_target::router(state))
        .nest("/restore", restore::router(state))
        .with_state(state.clone())
}
