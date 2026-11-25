use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod delete {
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel,
            admin_activity::GetAdminActivityLogger,
            team::GetTeam,
            team_member::{DeleteTeamMemberOptions, TeamMember},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "team" = uuid::Uuid,
            description = "The team ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "member" = uuid::Uuid,
            description = "The user ID of the member",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        team: GetTeam,
        activity_logger: GetAdminActivityLogger,
        Path((_team, member)): Path<(uuid::Uuid, uuid::Uuid)>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("teams.update")?;
        permissions.can_modify_user(&team.owner)?;

        let member =
            match TeamMember::by_team_uuid_user_uuid(&state.database, team.uuid, member).await? {
                Some(member) => member,
                None => {
                    return ApiResponse::error("member not found")
                        .with_status(StatusCode::NOT_FOUND)
                        .ok();
                }
            };

        permissions.can_modify_user(&member.user)?;

        member
            .delete(&state, DeleteTeamMemberOptions { notify: true })
            .await?;

        activity_logger
            .log(
                "team:member.delete",
                serde_json::json!({
                    "team_uuid": team.uuid,
                    "user_uuid": member.user.uuid,
                    "username": member.user.username,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(delete::route))
        .with_state(state.clone())
}
