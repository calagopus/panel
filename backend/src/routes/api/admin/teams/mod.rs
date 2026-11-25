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
            IntoAdminApiObject, Pagination, PaginationParamsWithSearch, team::Team,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        teams: Pagination<shared::models::team::AdminApiTeam>,
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
        Query(params): Query<PaginationParamsWithSearch>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("teams.read")?;

        let teams = Team::all_with_pagination(
            &state.database,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        let storage_url_retriever = state.storage.retrieve_urls().await?;

        ApiResponse::new_serialized(Response {
            teams: teams
                .try_async_map(|team| team.into_admin_api_object(&state, &storage_url_retriever))
                .await?,
        })
        .ok()
    }
}

mod post {
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            ByUuid, CreatableModel, IntoAdminApiObject,
            admin_activity::GetAdminActivityLogger,
            team::{CreateTeamOptions, Team},
            user::{GetPermissionManager, User},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        team: shared::models::team::AdminApiTeam,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    ), request_body = inline(CreateTeamOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<CreateTeamOptions>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("teams.create")?;

        let Some(owner) = User::by_uuid_optional(&state.database, data.owner_uuid).await? else {
            return ApiResponse::error("user not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        };

        permissions.can_modify_user(&owner)?;

        let team = Team::create(&state, data).await?;

        activity_logger
            .log(
                "team:create",
                serde_json::json!({
                    "uuid": team.uuid,
                    "owner_uuid": team.owner.uuid,
                    "name": team.name,
                    "description": team.description,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            team: team
                .into_admin_api_object(&state, &state.storage.retrieve_urls().await?)
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
