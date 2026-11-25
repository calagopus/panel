use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _server_;
mod available;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoApiObject, Pagination, PaginationParamsWithSearch, server::Server, team::GetTeam,
            user::GetUser,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        servers: Pagination<shared::models::server::ApiServer>,
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
        team: GetTeam,
        Query(params): Query<PaginationParamsWithSearch>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let servers = Server::by_team_uuid_with_pagination(
            &state.database,
            team.uuid,
            user.uuid,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        ApiResponse::new_serialized(Response {
            servers: servers
                .try_async_map(|server| server.into_api_object(&state, &user))
                .await?,
        })
        .ok()
    }
}

mod post {
    use axum::http::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            ByUuid,
            server::Server,
            team::{GetTeam, GetTeamActor},
            team_activity::GetTeamActivityLogger,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        server_uuid: uuid::Uuid,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), params(
        (
            "team" = uuid::Uuid,
            description = "The team ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        actor: GetTeamActor,
        team: GetTeam,
        activity_logger: GetTeamActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_user_permission("teams.update")?;
        actor.can_manage_team()?;

        let server = Server::by_uuid_optional_cached(&state.database, data.server_uuid)
            .await?
            .filter(|server| server.owner.uuid == team.owner.uuid);
        let Some(server) = server else {
            return ApiResponse::error("server not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        };

        if server.team_uuid == Some(team.uuid) {
            return ApiResponse::error("server is already part of this team")
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        match team.attach_server(&state, &server).await {
            Ok(_) => {}
            Err(shared::database::DatabaseError::Sqlx(sqlx::Error::InvalidArgument(err))) => {
                return ApiResponse::error(&err)
                    .with_status(StatusCode::BAD_REQUEST)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        }

        activity_logger
            .log(
                "team:server.attach",
                serde_json::json!({
                    "server_uuid": server.uuid,
                    "name": server.name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/available", available::router(state))
        .nest("/{server}", _server_::router(state))
        .with_state(state.clone())
}
