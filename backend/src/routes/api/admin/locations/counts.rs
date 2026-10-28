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
        location_nodes: i64,
        location_servers: i64,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        locations: IndexMap<uuid::Uuid, ResponseCounts>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route(state: GetState, permissions: GetPermissionManager) -> ApiResponseResult {
        permissions.has_admin_permission("locations.read")?;

        let locations = state
            .cache
            .cached("locations::counts", 30, || async {
                let rows = sqlx::query!(
                    r#"SELECT
                        nodes.location_uuid,
                        COUNT(*) AS "location_nodes!",
                        COALESCE(SUM(node_servers.servers), 0)::int8 AS "location_servers!"
                    FROM nodes
                    LEFT JOIN (
                        SELECT servers.node_uuid, COUNT(*) AS servers
                        FROM servers
                        GROUP BY servers.node_uuid
                    ) AS node_servers ON node_servers.node_uuid = nodes.uuid
                    GROUP BY nodes.location_uuid"#
                )
                .fetch_all(state.database.read())
                .await?;

                Ok::<_, sqlx::Error>(
                    rows.into_iter()
                        .map(|row| {
                            (
                                row.location_uuid,
                                ResponseCounts {
                                    location_nodes: row.location_nodes,
                                    location_servers: row.location_servers,
                                },
                            )
                        })
                        .collect::<IndexMap<_, _>>(),
                )
            })
            .await?;

        ApiResponse::new_serialized(Response { locations }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
