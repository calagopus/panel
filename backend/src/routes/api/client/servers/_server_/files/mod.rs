use super::State;
use utoipa_axum::router::OpenApiRouter;

mod chmod;
mod compress;
mod contents;
mod copy;
mod copy_many;
mod copy_remote;
mod copy_remote_many;
mod create_directory;
mod create_symlink;
mod decompress;
mod delete;
mod directory_sizes;
mod download;
mod fingerprint;
mod ignore_matches;
mod largest_directories;
mod lines;
mod list;
mod operations;
mod patch;
mod pull;
mod rename;
mod revisions;
mod search;
mod sqlite_query;
mod stat;
mod trash;
mod upload;
mod write;

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest("/list", list::router(state))
        .nest("/contents", contents::router(state))
        .nest("/lines", lines::router(state))
        .nest("/fingerprint", fingerprint::router(state))
        .nest("/download", download::router(state))
        .nest("/upload", upload::router(state))
        .nest("/rename", rename::router(state))
        .nest("/copy", copy::router(state))
        .nest("/copy-many", copy_many::router(state))
        .nest("/copy-remote", copy_remote::router(state))
        .nest("/copy-remote-many", copy_remote_many::router(state))
        .nest("/write", write::router(state))
        .nest("/compress", compress::router(state))
        .nest("/decompress", decompress::router(state))
        .nest("/delete", delete::router(state))
        .nest("/create-directory", create_directory::router(state))
        .nest("/create-symlink", create_symlink::router(state))
        .nest("/largest-directories", largest_directories::router(state))
        .nest("/directory-sizes", directory_sizes::router(state))
        .nest("/chmod", chmod::router(state))
        .nest("/search", search::router(state))
        .nest("/ignore-matches", ignore_matches::router(state))
        .nest("/sqlite-query", sqlite_query::router(state))
        .nest("/stat", stat::router(state))
        .nest("/trash", trash::router(state))
        .nest("/patch", patch::router(state))
        .nest("/pull", pull::router(state))
        .nest("/operations", operations::router(state))
        .nest("/revisions", revisions::router(state))
        .with_state(state.clone())
}
