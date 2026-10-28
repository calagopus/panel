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
        egg_repository_eggs: i64,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        egg_repositories: IndexMap<uuid::Uuid, ResponseCounts>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route(state: GetState, permissions: GetPermissionManager) -> ApiResponseResult {
        permissions.has_admin_permission("egg-repositories.read")?;

        let egg_repositories = state
            .cache
            .cached("egg-repositories::counts", 30, || async {
                let rows = sqlx::query!(
                    r#"SELECT
                        egg_repository_eggs.egg_repository_uuid,
                        COUNT(*) AS "egg_repository_eggs!"
                    FROM egg_repository_eggs
                    GROUP BY egg_repository_eggs.egg_repository_uuid"#
                )
                .fetch_all(state.database.read())
                .await?;

                Ok::<_, sqlx::Error>(
                    rows.into_iter()
                        .map(|row| {
                            (
                                row.egg_repository_uuid,
                                ResponseCounts {
                                    egg_repository_eggs: row.egg_repository_eggs,
                                },
                            )
                        })
                        .collect::<IndexMap<_, _>>(),
                )
            })
            .await?;

        ApiResponse::new_serialized(Response { egg_repositories }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
