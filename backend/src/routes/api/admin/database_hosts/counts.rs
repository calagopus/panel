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
        database_host_server_databases: i64,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        database_hosts: IndexMap<uuid::Uuid, ResponseCounts>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route(state: GetState, permissions: GetPermissionManager) -> ApiResponseResult {
        permissions.has_admin_permission("database-hosts.read")?;

        let database_hosts = state
            .cache
            .cached("database-hosts::counts", 30, || async {
                let rows = sqlx::query!(
                    r#"SELECT
                        server_databases.database_host_uuid,
                        COUNT(*) AS "database_host_server_databases!"
                    FROM server_databases
                    GROUP BY server_databases.database_host_uuid"#
                )
                .fetch_all(state.database.read())
                .await?;

                Ok::<_, sqlx::Error>(
                    rows.into_iter()
                        .map(|row| {
                            (
                                row.database_host_uuid,
                                ResponseCounts {
                                    database_host_server_databases: row
                                        .database_host_server_databases,
                                },
                            )
                        })
                        .collect::<IndexMap<_, _>>(),
                )
            })
            .await?;

        ApiResponse::new_serialized(Response { database_hosts }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
