use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod delete {
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            ByUuid, admin_activity::GetAdminActivityLogger, server::Server, team::GetTeam,
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
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        team: GetTeam,
        activity_logger: GetAdminActivityLogger,
        Path((_team, server)): Path<(uuid::Uuid, uuid::Uuid)>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("teams.update")?;
        permissions.can_modify_user(&team.owner)?;

        let server = match Server::by_uuid_optional_cached(&state.database, server).await? {
            Some(server) if server.team_uuid == Some(team.uuid) => server,
            _ => {
                return ApiResponse::error("server not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        };

        team.detach_server(&state, &server).await?;

        activity_logger
            .log(
                "team:server.detach",
                serde_json::json!({
                    "team_uuid": team.uuid,
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
        .routes(routes!(delete::route))
        .with_state(state.clone())
}
