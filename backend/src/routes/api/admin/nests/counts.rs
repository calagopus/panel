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
        nest_eggs: i64,
        nest_servers: i64,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        nests: IndexMap<uuid::Uuid, ResponseCounts>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route(state: GetState, permissions: GetPermissionManager) -> ApiResponseResult {
        permissions.has_admin_permission("nests.read")?;

        let nests = state
            .cache
            .cached("nests::counts", 30, || async {
                let rows = sqlx::query!(
                    r#"SELECT
                        nest_eggs.nest_uuid,
                        COUNT(*) AS "nest_eggs!",
                        COALESCE(SUM(egg_servers.servers), 0)::int8 AS "nest_servers!"
                    FROM nest_eggs
                    LEFT JOIN (
                        SELECT servers.egg_uuid, COUNT(*) AS servers
                        FROM servers
                        GROUP BY servers.egg_uuid
                    ) AS egg_servers ON egg_servers.egg_uuid = nest_eggs.uuid
                    GROUP BY nest_eggs.nest_uuid"#
                )
                .fetch_all(state.database.read())
                .await?;

                Ok::<_, sqlx::Error>(
                    rows.into_iter()
                        .map(|row| {
                            (
                                row.nest_uuid,
                                ResponseCounts {
                                    nest_eggs: row.nest_eggs,
                                    nest_servers: row.nest_servers,
                                },
                            )
                        })
                        .collect::<IndexMap<_, _>>(),
                )
            })
            .await?;

        ApiResponse::new_serialized(Response { nests }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
