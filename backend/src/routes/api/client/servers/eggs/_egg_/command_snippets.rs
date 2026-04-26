use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use axum::extract::Path;
    use serde::Serialize;
    use shared::{
        GetState,
        models::{
            IntoApiObject,
            user::{GetPermissionManager, GetUser},
            user_command_snippet::UserCommandSnippet,
        },
        prelude::AsyncIteratorExt,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        command_snippets: Vec<shared::models::user_command_snippet::ApiUserCommandSnippet>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        Path(egg): Path<uuid::Uuid>,
    ) -> ApiResponseResult {
        permissions.has_user_permission("servers.read")?;

        let command_snippets =
            UserCommandSnippet::all_by_user_uuid_nest_egg_uuid(&state.database, user.uuid, egg)
                .await?;

        ApiResponse::new_serialized(Response {
            command_snippets: command_snippets
                .into_iter()
                .map(|command_snippet| command_snippet.into_api_object(&state, ()))
                .try_collect_async_vec()
                .await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
