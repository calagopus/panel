use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use serde::Serialize;
    use shared::{
        GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct ResponseStats {
        users: i64,
        servers: i64,
        locations: i64,
        nodes: i64,
        nest_eggs: i64,
        database_hosts: i64,
        backup_configurations: i64,
        roles: i64,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        stats: ResponseStats,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route(state: GetState, permissions: GetPermissionManager) -> ApiResponseResult {
        permissions.has_admin_permission("stats.read")?;

        let stats = sqlx::query_as_unchecked!(
            ResponseStats,
            "SELECT
                (SELECT COUNT(*) FROM users) as users,
                (SELECT COUNT(*) FROM servers) as servers,
                (SELECT COUNT(*) FROM locations) as locations,
                (SELECT COUNT(*) FROM nodes) as nodes,
                (SELECT COUNT(*) FROM nest_eggs) as nest_eggs,
                (SELECT COUNT(*) FROM database_hosts) as database_hosts,
                (SELECT COUNT(*) FROM backup_configurations) as backup_configurations,
                (SELECT COUNT(*) FROM roles) as roles"
        )
        .fetch_one(state.database.read())
        .await?;

        ApiResponse::new_serialized(Response { stats }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
