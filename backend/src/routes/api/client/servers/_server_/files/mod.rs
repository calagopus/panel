use super::State;
use utoipa_axum::router::OpenApiRouter;

mod chmod;
mod compress;
mod contents;
mod copy;
mod copy_many;
mod copy_remote;
mod create_directory;
mod decompress;
mod delete;
mod download;
mod fingerprint;
mod largest_directories;
mod list;
mod operations;
mod pull;
mod rename;
mod revisions;
mod search;
mod upload;
mod write;

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest("/list", list::router(state))
        .nest("/contents", contents::router(state))
        .nest("/fingerprint", fingerprint::router(state))
        .nest("/download", download::router(state))
        .nest("/upload", upload::router(state))
        .nest("/rename", rename::router(state))
        .nest("/copy", copy::router(state))
        .nest("/copy-many", copy_many::router(state))
        .nest("/copy-remote", copy_remote::router(state))
        .nest("/write", write::router(state))
        .nest("/compress", compress::router(state))
        .nest("/decompress", decompress::router(state))
        .nest("/delete", delete::router(state))
        .nest("/create-directory", create_directory::router(state))
        .nest("/largest-directories", largest_directories::router(state))
        .nest("/chmod", chmod::router(state))
        .nest("/search", search::router(state))
        .nest("/pull", pull::router(state))
        .nest("/operations", operations::router(state))
        .nest("/revisions", revisions::router(state))
        .with_state(state.clone())
}
