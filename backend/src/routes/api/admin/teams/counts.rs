use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use indexmap::IndexMap;
    use serde::{Deserialize, Serialize};
    use shared::{
        GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize, Deserialize)]
    struct ResponseCounts {
        team_servers: i64,
        team_members: i64,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        teams: IndexMap<uuid::Uuid, ResponseCounts>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route(state: GetState, permissions: GetPermissionManager) -> ApiResponseResult {
        permissions.has_admin_permission("teams.read")?;

        let teams = state
            .cache
            .cached("teams::counts", 30, || async {
                let rows = sqlx::query!(
                    r#"SELECT
                        teams.uuid,
                        COALESCE(team_servers.count, 0) AS "team_servers!",
                        COALESCE(team_members.count, 0) AS "team_members!"
                    FROM teams
                    LEFT JOIN (
                        SELECT servers.team_uuid, COUNT(*) AS count
                        FROM servers
                        WHERE servers.team_uuid IS NOT NULL
                        GROUP BY servers.team_uuid
                    ) AS team_servers ON team_servers.team_uuid = teams.uuid
                    LEFT JOIN (
                        SELECT team_members.team_uuid, COUNT(*) AS count
                        FROM team_members
                        GROUP BY team_members.team_uuid
                    ) AS team_members ON team_members.team_uuid = teams.uuid
                    WHERE team_servers.count IS NOT NULL OR team_members.count IS NOT NULL"#
                )
                .fetch_all(state.database.read())
                .await?;

                Ok::<_, sqlx::Error>(
                    rows.into_iter()
                        .map(|row| {
                            (
                                row.uuid,
                                ResponseCounts {
                                    team_servers: row.team_servers,
                                    team_members: row.team_members,
                                },
                            )
                        })
                        .collect::<IndexMap<_, _>>(),
                )
            })
            .await?;

        ApiResponse::new_serialized(Response { teams }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
