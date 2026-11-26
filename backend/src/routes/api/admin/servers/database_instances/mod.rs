use super::State;
use utoipa_axum::router::OpenApiRouter;

mod _instance_;

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest("/{instance}", _instance_::router(state))
        .with_state(state.clone())
}
