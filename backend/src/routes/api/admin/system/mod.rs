use super::State;
use utoipa_axum::router::OpenApiRouter;

mod email;
mod health;
mod overview;
mod telemetry;
mod updates;

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest("/overview", overview::router(state))
        .nest("/telemetry", telemetry::router(state))
        .nest("/updates", updates::router(state))
        .nest("/health", health::router(state))
        .nest("/email", email::router(state))
        .with_state(state.clone())
}
