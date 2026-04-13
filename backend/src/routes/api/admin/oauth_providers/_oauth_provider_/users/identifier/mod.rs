use super::State;
use utoipa_axum::router::OpenApiRouter;

mod _identifier_;

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest("/{identifier}", _identifier_::router(state))
        .with_state(state.clone())
}
