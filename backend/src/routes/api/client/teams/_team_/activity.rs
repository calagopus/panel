use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoApiObject, Pagination, PaginationParamsWithSearch,
            team::{GetTeam, GetTeamActor},
            team_activity::TeamActivity,
            user::GetUser,
        },
        response::{ApiResponse, ApiResponseResult},
        settings::activity::ActivityIpHiding,
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        activities: Pagination<shared::models::team_activity::ApiTeamActivity>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "team" = uuid::Uuid,
            description = "The team ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
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
        user: GetUser,
        actor: GetTeamActor,
        team: GetTeam,
        Query(params): Query<PaginationParamsWithSearch>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        actor.can_manage()?;

        let activities = TeamActivity::by_team_uuid_with_pagination(
            &state.database,
            team.uuid,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        let storage_url_retriever = state.storage.retrieve_urls().await?;
        let hide_ips = state
            .settings
            .get_as(|s| s.activity.team_hide_activity_ips)
            .await?;

        ApiResponse::new_serialized(Response {
            activities: activities
                .try_async_map(|activity| {
                    let is_own_activity = activity.impersonator.is_none()
                        && activity.user.as_ref().is_some_and(|u| u.uuid == user.uuid);
                    let show_ip = is_own_activity
                        || (actor.is_owner()
                            && match hide_ips {
                                ActivityIpHiding::None => true,
                                ActivityIpHiding::Admins => {
                                    !(activity.impersonator.is_some()
                                        || activity.user.as_ref().is_some_and(|u| u.admin))
                                }
                                ActivityIpHiding::AllUsers => false,
                            });

                    activity.into_api_object(&state, (&storage_url_retriever, show_ip))
                })
                .await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
