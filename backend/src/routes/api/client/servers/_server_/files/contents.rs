use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        jwt::BasePayload,
        models::{
            server::{GetServer, GetServerActivityLogger},
            user::{GetPermissionManager, GetUser},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Params {
        file: compact_str::CompactString,
    }

    #[derive(Serialize)]
    struct FileDownloadJwt {
        #[serde(flatten)]
        base: BasePayload,

        file_path: std::path::PathBuf,
        server_uuid: uuid::Uuid,
        unique_id: uuid::Uuid,
    }

    fn limit_range_header(range_str: &str, chunk_size: u64) -> String {
        if let Some(stripped) = range_str.strip_prefix("bytes=") {
            let parts: Vec<&str> = stripped.split(',').collect();
            if parts.len() == 1 {
                let part = parts[0];
                let bounds: Vec<&str> = part.split('-').collect();
                if bounds.len() == 2 {
                    let start_str = bounds[0].trim();
                    let end_str = bounds[1].trim();
                    if !start_str.is_empty() && end_str.is_empty() {
                        if let Ok(start) = start_str.parse::<u64>() {
                            return format!("bytes={}-{}", start, start + chunk_size - 1);
                        }
                    }
                }
            }
        }
        range_str.to_string()
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = String),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "file" = String, Query,
            description = "The file to retrieve contents from",
            example = "/path/to/file.txt",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        mut server: GetServer,
        activity_logger: GetServerActivityLogger,
        headers: axum::http::HeaderMap,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        permissions.has_server_permission("files.read-content")?;

        if server.is_ignored(&params.file, false) {
            return ApiResponse::error("file not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        }

        let ext = std::path::Path::new(params.file.as_str())
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or_default()
            .to_lowercase();

        let is_video_audio = matches!(
            ext.as_str(),
            "mp4" | "webm" | "ogg" | "mp3" | "wav" | "flac" | "aac"
        );
        let is_image = matches!(
            ext.as_str(),
            "png" | "jpg" | "jpeg" | "gif" | "svg" | "webp"
        );
        let is_media = is_video_audio || is_image;

        let max_file_manager_view_size = if is_media {
            53_687_091_200
        } else {
            state
                .settings
                .get_as(|s| s.server.max_file_manager_view_size)
                .await?
        };

        let mut wings_headers = reqwest::header::HeaderMap::new();
        let range_header_val = headers.get(axum::http::header::RANGE);

        let range_to_send = match range_header_val {
            Some(range_val) => {
                if let Ok(range_str) = range_val.to_str() {
                    if is_video_audio {
                        Some(limit_range_header(range_str, 10_000_000))
                    } else {
                        Some(range_str.to_string())
                    }
                } else {
                    None
                }
            }
            None => None,
        };

        if let Some(range_str) = range_to_send {
            if let Ok(reqwest_range_val) = reqwest::header::HeaderValue::from_str(&range_str) {
                wings_headers.insert(reqwest::header::RANGE, reqwest_range_val);
            }
        }

        let contents = if is_video_audio {
            let node = server
                .node
                .fetch_cached(&state.database)
                .await?;

            use compact_str::ToCompactString;
            let token = node.create_jwt(
                &state.database,
                &state.jwt,
                &FileDownloadJwt {
                    base: BasePayload {
                        scope: "file-download".into(),
                        issuer: "panel".into(),
                        subject: None,
                        audience: Vec::new(),
                        expiration_time: Some(chrono::Utc::now().timestamp() + 900),
                        not_before: None,
                        issued_at: Some(chrono::Utc::now().timestamp()),
                        jwt_id: user.uuid.to_compact_string(),
                    },
                    file_path: std::path::PathBuf::from(params.file.as_str()),
                    server_uuid: server.uuid,
                    unique_id: uuid::Uuid::new_v4(),
                },
            )?;

            match node
                .api_client(&state.database)
                .await?
                .get_download_stream(&token, Some(wings_headers))
                .await
            {
                Ok(data) => data,
                Err(wings_api::client::ApiHttpError::Http(StatusCode::NOT_FOUND, err)) => {
                    return ApiResponse::new_serialized(ApiError::new_wings_value(err))
                        .with_status(StatusCode::NOT_FOUND)
                        .ok();
                }
                Err(wings_api::client::ApiHttpError::Http(StatusCode::PAYLOAD_TOO_LARGE, _)) => {
                    return ApiResponse::error("file size exceeds limit")
                        .with_status(StatusCode::PAYLOAD_TOO_LARGE)
                        .ok();
                }
                Err(err) => return Err(err.into()),
            }
        } else {
            match server
                .node
                .fetch_cached(&state.database)
                .await?
                .api_client(&state.database)
                .await?
                .get_servers_server_files_contents(
                    server.uuid,
                    &params.file,
                    false,
                    max_file_manager_view_size,
                    Some(wings_headers),
                )
                .await
            {
                Ok(data) => data,
                Err(wings_api::client::ApiHttpError::Http(StatusCode::NOT_FOUND, err)) => {
                    return ApiResponse::new_serialized(ApiError::new_wings_value(err))
                        .with_status(StatusCode::NOT_FOUND)
                        .ok();
                }
                Err(wings_api::client::ApiHttpError::Http(StatusCode::PAYLOAD_TOO_LARGE, _)) => {
                    return ApiResponse::error("file size exceeds limit")
                        .with_status(StatusCode::PAYLOAD_TOO_LARGE)
                        .ok();
                }
                Err(err) => return Err(err.into()),
            }
        };

        activity_logger
            .log(
                "server:file.read-content",
                serde_json::json!({
                    "file": params.file,
                }),
            )
            .await;

        let mut response = ApiResponse::new_stream(contents.stream)
            .with_status(contents.status);

        for (name, value) in contents.headers.iter() {
            let name_str = name.as_str().to_lowercase();
            if name_str == "content-range"
                || name_str == "content-length"
                || name_str == "content-type"
                || name_str == "accept-ranges"
            {
                if let Ok(name_parsed) = axum::http::header::HeaderName::from_bytes(name.as_str().as_bytes()) {
                    if let Ok(value_parsed) = axum::http::HeaderValue::from_bytes(value.as_bytes()) {
                        response.headers.insert(name_parsed, value_parsed);
                    }
                }
            }
        }

        response.ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
