use super::State;
use utoipa_axum::router::OpenApiRouter;

mod _extension_;
mod add;
mod logs;
mod rebuild;
mod restart;
mod status;

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest("/{extension}", _extension_::router(state))
        .nest("/status", status::router(state))
        .nest("/rebuild", rebuild::router(state))
        .nest("/restart", restart::router(state))
        .nest("/add", add::router(state))
        .nest("/logs", logs::router(state))
        .with_state(state.clone())
}
