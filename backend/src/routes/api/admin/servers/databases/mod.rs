use super::State;
use utoipa_axum::router::OpenApiRouter;

mod _database_;

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest("/{database}", _database_::router(state))
        .with_state(state.clone())
}
