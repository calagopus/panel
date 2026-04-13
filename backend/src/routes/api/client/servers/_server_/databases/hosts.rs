use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use futures_util::StreamExt;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            location_database_host::LocationDatabaseHost, server::GetServer,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        database_hosts: Vec<shared::models::database_host::ApiDatabaseHost>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
    ) -> ApiResponseResult {
        permissions.has_server_permission("databases.read")?;

        let database_hosts = LocationDatabaseHost::all_public_by_location_uuid(
            &state.database,
            server
                .node
                .fetch_cached(&state.database)
                .await?
                .location
                .uuid,
        )
        .await?;

        let mut response_database_hosts = Vec::new();
        response_database_hosts.reserve_exact(database_hosts.len());

        let mut stream = futures_util::stream::iter(
            database_hosts
                .into_iter()
                .map(|database_host| database_host.database_host.into_api_object(&state.database)),
        )
        .buffered(10);

        while let Some(database_host) = stream.next().await {
            response_database_hosts.push(database_host?);
        }

        ApiResponse::new_serialized(Response {
            database_hosts: response_database_hosts,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
