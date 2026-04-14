use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{server::GetServer, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(url)]
        #[schema(format = "uri")]
        url: compact_str::CompactString,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        query_result: wings_api::servers_server_files_pull_query::post::Response200,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
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
        server: GetServer,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_server_permission("files.create")?;

        let ratelimit = state
            .settings
            .get_as(|s| s.ratelimits.client_servers_files_pull_query)
            .await?;
        state
            .cache
            .ratelimit(
                "client/servers/files/pull/query",
                ratelimit.hits,
                ratelimit.window_seconds,
                server.uuid.to_string(),
            )
            .await?;

        let query_result = match server
            .node
            .fetch_cached(&state.database)
            .await?
            .api_client(&state.database)
            .await?
            .post_servers_server_files_pull_query(
                server.uuid,
                &wings_api::servers_server_files_pull_query::post::RequestBody { url: data.url },
            )
            .await
        {
            Ok(query_result) => query_result,
            Err(wings_api::client::ApiHttpError::Http(StatusCode::EXPECTATION_FAILED, err)) => {
                return ApiResponse::new_serialized(ApiError::new_wings_value(err))
                    .with_status(StatusCode::EXPECTATION_FAILED)
                    .ok();
            }
            Err(err) => return Err(err.into()),
        };

        ApiResponse::new_serialized(Response { query_result }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
