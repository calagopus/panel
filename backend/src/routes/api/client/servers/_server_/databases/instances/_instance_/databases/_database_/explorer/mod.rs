use super::State;
use utoipa_axum::router::OpenApiRouter;

mod query;
mod rows;
mod schema;
mod tables;

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest("/query", query::router(state))
        .nest("/rows", rows::router(state))
        .nest("/schema", schema::router(state))
        .nest("/tables", tables::router(state))
        .with_state(state.clone())
}
