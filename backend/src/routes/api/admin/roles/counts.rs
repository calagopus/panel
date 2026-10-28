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
        role_users: i64,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        roles: IndexMap<uuid::Uuid, ResponseCounts>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route(state: GetState, permissions: GetPermissionManager) -> ApiResponseResult {
        permissions.has_admin_permission("roles.read")?;

        let roles = state
            .cache
            .cached("roles::counts", 30, || async {
                let rows = sqlx::query!(
                    r#"SELECT
                        users.role_uuid AS "role_uuid!",
                        COUNT(*) AS "role_users!"
                    FROM users
                    WHERE users.role_uuid IS NOT NULL
                    GROUP BY users.role_uuid"#
                )
                .fetch_all(state.database.read())
                .await?;

                Ok::<_, sqlx::Error>(
                    rows.into_iter()
                        .map(|row| {
                            (
                                row.role_uuid,
                                ResponseCounts {
                                    role_users: row.role_users,
                                },
                            )
                        })
                        .collect::<IndexMap<_, _>>(),
                )
            })
            .await?;

        ApiResponse::new_serialized(Response { roles }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
