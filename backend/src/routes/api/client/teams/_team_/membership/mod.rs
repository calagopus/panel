use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod accept;

mod delete {
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel,
            team::GetTeam,
            team_activity::GetTeamActivityLogger,
            team_member::{DeleteTeamMemberOptions, TeamMember},
            user::{GetPermissionManager, GetUser},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
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

        let Some(member) =
            TeamMember::by_team_uuid_user_uuid(&state.database, team.uuid, user.uuid).await?
        else {
            return ApiResponse::error("you are not a member of this team")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        };

        member
            .delete(&state, DeleteTeamMemberOptions::default())
            .await?;

        activity_logger
            .log(
                if member.accepted.is_some() {
                    "team:member.leave"
                } else {
                    "team:member.decline"
                },
                serde_json::json!({}),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(delete::route))
        .nest("/accept", accept::router(state))
        .with_state(state.clone())
}
