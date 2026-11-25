use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            team::GetTeam,
            team_activity::GetTeamActivityLogger,
            team_member::TeamMember,
            user::{GetPermissionManager, GetUser},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), params(
        (
            "team" = uuid::Uuid,
            description = "The team ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        team: GetTeam,
        activity_logger: GetTeamActivityLogger,
    ) -> ApiResponseResult {
        permissions.has_user_permission("teams.membership")?;

        let Some(mut member) =
            TeamMember::by_team_uuid_user_uuid(&state.database, team.uuid, user.uuid).await?
        else {
            return ApiResponse::error("you are not invited to this team")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        };

        if member.accepted.is_some() {
            return ApiResponse::error("team invite has already been accepted")
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        member.accept(&state).await?;

        activity_logger
            .log("team:member.accept", serde_json::json!({}))
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
