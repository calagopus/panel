use super::State;
use utoipa_axum::router::OpenApiRouter;

mod verify;

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest("/verify", verify::router(state))
        .with_state(state.clone())
}
