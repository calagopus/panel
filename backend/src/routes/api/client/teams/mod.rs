use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _team_;
mod counts;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoApiObject, Pagination, PaginationParamsWithSearch,
            team::Team,
            user::{GetPermissionManager, GetUser},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        teams: Pagination<shared::models::team::ApiTeam>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
    ), params(
        (
            "page" = i64, Query,
            description = "The page number",
            example = "1",
        ),
        (
            "per_page" = i64, Query,
            description = "The number of items per page",
            example = "10",
        ),
        (
            "search" = Option<String>, Query,
            description = "Search term for items",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        Query(params): Query<PaginationParamsWithSearch>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_user_permission("teams.read")?;

        let teams = Team::by_user_uuid_with_pagination(
            &state.database,
            user.uuid,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        let storage_url_retriever = state.storage.retrieve_urls().await?;

        ApiResponse::new_serialized(Response {
            teams: teams
                .try_async_map(|team| team.into_api_object(&state, &storage_url_retriever))
                .await?,
        })
        .ok()
    }
}

mod post {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel, IntoApiObject,
            server::Server,
            team::Team,
            user::{GetPermissionManager, GetUser},
            user_activity::GetUserActivityLogger,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        name: compact_str::CompactString,
        #[garde(length(chars, min = 1, max = 1024))]
        #[schema(min_length = 1, max_length = 1024)]
        description: Option<compact_str::CompactString>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        team: shared::models::team::ApiTeam,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = FORBIDDEN, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        activity_logger: GetUserActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_user_permission("teams.create")?;

        let (allow_creating_teams, max_team_count) = state
            .settings
            .get_as(|s| (s.user.allow_creating_teams, s.user.max_team_count))
            .await?;

        if !allow_creating_teams {
            return ApiResponse::error("creating teams is disabled")
                .with_status(StatusCode::FORBIDDEN)
                .ok();
        }

        // a team only ever manages access to servers of its owner
        if !user.admin && Server::count_by_user_uuid(&state.database, user.uuid).await? == 0 {
            return ApiResponse::error("you need to own a server to create a team")
                .with_status(StatusCode::FORBIDDEN)
                .ok();
        }

        let teams_lock = state
            .cache
            .lock(format!("users::{}::teams", user.uuid), Some(30), Some(5000))
            .await?;

        let teams = Team::count_by_owner_uuid(&state.database, user.uuid).await?;
        if teams >= max_team_count as i64 {
            return ApiResponse::error("maximum number of teams reached")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let options = shared::models::team::CreateTeamOptions {
            owner_uuid: user.uuid,
            name: data.name,
            description: data.description,
        };
        let team = Team::create(&state, options).await?;

        drop(teams_lock);

        activity_logger
            .log(
                "team:create",
                serde_json::json!({
                    "uuid": team.uuid,
                    "name": team.name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            team: team
                .into_api_object(&state, &state.storage.retrieve_urls().await?)
                .await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/{team}", _team_::router(state))
        .nest("/counts", counts::router(state))
        .with_state(state.clone())
}
