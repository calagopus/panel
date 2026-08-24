use super::State;
use utoipa_axum::router::OpenApiRouter;

mod reset_password;
mod verify;

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest("/reset-password", reset_password::router(state))
        .nest("/verify", verify::router(state))
        .with_state(state.clone())
}
