use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use axum::{
        extract::{Path, Query},
        http::StatusCode,
    };
    use serde::Deserialize;
    use shared::{
        ApiError, GetState,
        models::{server::GetServer, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Params {
        file: compact_str::CompactString,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = String),
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
            "revision" = i64,
            description = "The revision ID",
            example = "1",
        ),
        (
            "file" = String, Query,
            description = "The file the revision belongs to",
            example = "/path/to/file.txt",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        mut server: GetServer,
        Path((_server, revision)): Path<(String, i64)>,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        permissions.has_server_permission("files.read-content")?;

        if server.is_ignored(&params.file, false) {
            return ApiResponse::error("revision not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        }

        let contents = match server
            .node
            .fetch_cached(&state.database)
            .await?
            .api_client(&state.database)
            .await?
            .get_servers_server_files_revisions_revision(
                server.uuid,
                revision,
                &wings_api::servers_server_files_revisions_revision::get::Query {
                    file: Some(params.file),
                    ignored: server.0.subuser_ignored_files,
                    ..Default::default()
                },
            )
            .await
        {
            Ok(data) => data,
            Err(wings_api::client::ApiHttpError::Http(StatusCode::NOT_FOUND, err)) => {
                return ApiResponse::new_serialized(ApiError::new_wings_value(err))
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
            Err(err) => return Err(err.into()),
        };

        ApiResponse::new_stream(contents)
            .with_header("Content-Type", "application/octet-stream")
            .with_header("Content-Disposition", "attachment")
            .with_header("Content-Security-Policy", "sandbox")
            .with_header("X-Content-Type-Options", "nosniff")
            .with_header("X-Frame-Options", "SAMEORIGIN")
            .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
