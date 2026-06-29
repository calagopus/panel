use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _revision_;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            ByUuid, IntoApiObject,
            server::GetServer,
            user::{GetPermissionManager, User},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Revision {
        id: i64,
        user: Option<shared::models::user::ApiUser>,

        size: u64,
        is_snapshot: bool,

        created: chrono::DateTime<chrono::Utc>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        revisions: Vec<Revision>,
    }

    #[derive(ToSchema, Deserialize)]
    pub struct Params {
        file: compact_str::CompactString,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "file" = String, Query,
            description = "The file to retrieve revisions from",
            example = "/path/to/file.txt",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        mut server: GetServer,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        permissions.has_server_permission("files.read-content")?;

        if server.is_ignored(&params.file, false) {
            return ApiResponse::error("file not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        }

        let response = server
            .node
            .fetch_cached(&state.database)
            .await?
            .api_client(&state.database)
            .await?
            .get_servers_server_files_revisions(server.uuid, &params.file)
            .await?;

        let mut revisions = Vec::new();
        revisions.reserve_exact(response.revisions.len());

        let storage_url_retriever = state.storage.retrieve_urls().await?;

        for revision in response.revisions {
            revisions.push(Revision {
                id: revision.id,
                user: if let Some(user) = revision.user {
                    if let Some(user) = User::by_uuid_optional_cached(&state.database, user).await?
                    {
                        Some(user.into_api_object(&state, &storage_url_retriever).await?)
                    } else {
                        None
                    }
                } else {
                    None
                },

                size: revision.size,
                is_snapshot: revision.is_snapshot,

                created: revision.created.to_utc(),
            });
        }

        ApiResponse::new_serialized(Response { revisions }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest("/{revision}", _revision_::router(state))
        .routes(routes!(get::route))
        .with_state(state.clone())
}
