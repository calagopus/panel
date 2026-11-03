use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use axum::{extract::Query, http::StatusCode};
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::server::GetServer,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Params {
        #[garde(skip)]
        pub start: chrono::DateTime<chrono::Utc>,
        #[garde(skip)]
        pub end: chrono::DateTime<chrono::Utc>,
        #[garde(range(min = 1, max = 2000))]
        pub points: u64,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        history: wings_api::History,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "start" = chrono::DateTime<chrono::Utc>, Query,
            description = "Start of the range, inclusive",
            example = "2026-01-01T00:00:00Z",
        ),
        (
            "end" = chrono::DateTime<chrono::Utc>, Query,
            description = "End of the range, exclusive",
            example = "2026-01-02T00:00:00Z",
        ),
        (
            "points" = u64, Query,
            description = "Number of equally wide points to split the range into",
            example = "48",
            minimum = 1,
            maximum = 2000,
        ),
    ))]
    pub async fn route(
        state: GetState,
        server: GetServer,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        if params.end <= params.start {
            return ApiResponse::error("end must be after start")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let history = match server
            .node
            .fetch_cached(&state.database)
            .await?
            .api_client(&state.database)
            .await?
            .get_servers_server_utilization_history(
                server.uuid,
                &wings_api::servers_server_utilization_history::get::Query {
                    start: Some(params.start.into()),
                    end: Some(params.end.into()),
                    points: Some(params.points),
                    ..Default::default()
                },
            )
            .await
        {
            Ok(history) => history,
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

        ApiResponse::new_serialized(Response { history }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
