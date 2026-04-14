use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod query;

mod post {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            server::{GetServer, GetServerActivityLogger},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(skip)]
        #[serde(default)]
        #[schema(default = "/")]
        root: compact_str::CompactString,

        #[garde(url)]
        #[schema(format = "uri")]
        url: String,
        #[garde(skip)]
        name: Option<compact_str::CompactString>,

        #[garde(skip)]
        #[serde(default)]
        use_header: bool,
        #[garde(skip)]
        #[serde(default)]
        foreground: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[derive(ToSchema, Serialize)]
    struct ResponseAccepted {
        identifier: uuid::Uuid,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = ACCEPTED, body = inline(ResponseAccepted)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        mut server: GetServer,
        activity_logger: GetServerActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_server_permission("files.create")?;

        let ratelimit = state
            .settings
            .get_as(|s| s.ratelimits.client_servers_files_pull)
            .await?;
        state
            .cache
            .ratelimit(
                "client/servers/files/pull",
                ratelimit.hits,
                ratelimit.window_seconds,
                server.uuid.to_string(),
            )
            .await?;

        if let Some(name) = &data.name
            && server.is_ignored(name, false)
        {
            return ApiResponse::error("root directory not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        }

        let request_body = wings_api::servers_server_files_pull::post::RequestBody {
            root: data.root,
            url: data.url.into(),
            file_name: data.name,
            use_header: data.use_header,
            foreground: data.foreground,
        };

        let identifier = match server
            .node
            .fetch_cached(&state.database)
            .await?
            .api_client(&state.database)
            .await?
            .post_servers_server_files_pull(server.uuid, &request_body)
            .await
        {
            Ok(wings_api::servers_server_files_pull::post::Response::Ok(_)) => None,
            Ok(wings_api::servers_server_files_pull::post::Response::Accepted(data)) => {
                Some(data.identifier)
            }
            Err(wings_api::client::ApiHttpError::Http(StatusCode::NOT_FOUND, err)) => {
                return ApiResponse::new_serialized(ApiError::new_wings_value(err))
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
            Err(wings_api::client::ApiHttpError::Http(StatusCode::EXPECTATION_FAILED, err)) => {
                return ApiResponse::new_serialized(ApiError::new_wings_value(err))
                    .with_status(StatusCode::EXPECTATION_FAILED)
                    .ok();
            }
            Err(err) => return Err(err.into()),
        };

        activity_logger
            .log(
                "server:file.pull",
                serde_json::json!({
                    "directory": request_body.root,
                    "url": request_body.url,
                }),
            )
            .await;

        if let Some(identifier) = identifier {
            ApiResponse::new_serialized(ResponseAccepted { identifier })
                .with_status(StatusCode::ACCEPTED)
                .ok()
        } else {
            ApiResponse::new_serialized(Response {}).ok()
        }
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest("/query", query::router(state))
        .routes(routes!(post::route))
        .with_state(state.clone())
}
