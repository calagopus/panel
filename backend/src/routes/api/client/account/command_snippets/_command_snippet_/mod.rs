use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod duplicate;

mod patch {
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        GetState,
        models::{
            UpdatableModel,
            user::{GetPermissionManager, GetUser},
            user_activity::GetUserActivityLogger,
            user_command_snippet::{UpdateUserCommandSnippetOptions, UserCommandSnippet},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(patch, path = "/", responses(
        (status = OK, body = inline(Response)),
    ), params(
        (
            "command_snippet" = uuid::Uuid,
            description = "The command snippet identifier",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(UpdateUserCommandSnippetOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        activity_logger: GetUserActivityLogger,
        Path(command_snippet): Path<uuid::Uuid>,
        shared::Payload(data): shared::Payload<UpdateUserCommandSnippetOptions>,
    ) -> ApiResponseResult {
        permissions.has_user_permission("command-snippets.update")?;

        let mut command_snippet = match UserCommandSnippet::by_user_uuid_uuid(
            &state.database,
            user.uuid,
            command_snippet,
        )
        .await?
        {
            Some(command_snippet) => command_snippet,
            None => {
                return ApiResponse::error("command snippet not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        };

        match command_snippet.update(&state, data).await {
            Ok(_) => {}
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("command snippet with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        }

        activity_logger
            .log(
                "user:command-snippet.update",
                serde_json::json!({
                    "uuid": command_snippet.uuid,
                    "name": command_snippet.name,
                    "eggs": command_snippet.eggs,
                    "command": command_snippet.command,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod delete {
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        GetState,
        models::{
            DeletableModel,
            user::{GetPermissionManager, GetUser},
            user_activity::GetUserActivityLogger,
            user_command_snippet::UserCommandSnippet,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
    ), params(
        (
            "command_snippet" = uuid::Uuid,
            description = "The command snippet identifier",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        activity_logger: GetUserActivityLogger,
        Path(command_snippet): Path<uuid::Uuid>,
    ) -> ApiResponseResult {
        permissions.has_user_permission("command-snippets.delete")?;

        let command_snippet = match UserCommandSnippet::by_user_uuid_uuid(
            &state.database,
            user.uuid,
            command_snippet,
        )
        .await?
        {
            Some(command_snippet) => command_snippet,
            None => {
                return ApiResponse::error("command snippet not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        };

        command_snippet.delete(&state, ()).await?;

        activity_logger
            .log(
                "user:command-snippet.delete",
                serde_json::json!({
                    "uuid": command_snippet.uuid,
                    "name": command_snippet.name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(patch::route))
        .routes(routes!(delete::route))
        .nest("/duplicate", duplicate::router(state))
        .with_state(state.clone())
}
