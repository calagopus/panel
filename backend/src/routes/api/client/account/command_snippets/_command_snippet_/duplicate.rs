use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::{extract::Path, http::StatusCode};
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            DuplicableModel, IntoApiObject,
            user::{GetPermissionManager, GetUser},
            user_activity::GetUserActivityLogger,
            user_command_snippet::{DuplicateUserCommandSnippetOptions, UserCommandSnippet},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(chars, min = 1, max = 31))]
        #[schema(min_length = 1, max_length = 31)]
        name: compact_str::CompactString,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        command_snippet: shared::models::user_command_snippet::ApiUserCommandSnippet,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), params(
        (
            "command_snippet" = uuid::Uuid,
            description = "The command snippet identifier",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        activity_logger: GetUserActivityLogger,
        Path(command_snippet): Path<uuid::Uuid>,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_user_permission("command-snippets.create")?;

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

        let options = DuplicateUserCommandSnippetOptions {
            user_uuid: user.uuid,
            name: data.name,
        };
        let duplicated = match DuplicableModel::duplicate(&command_snippet, &state, options).await {
            Ok(command_snippet) => command_snippet,
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("command snippet with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        };

        activity_logger
            .log(
                "user:command-snippet.duplicate",
                serde_json::json!({
                    "source_uuid": command_snippet.uuid,
                    "source_name": command_snippet.name,
                    "uuid": duplicated.uuid,
                    "name": duplicated.name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            command_snippet: duplicated.into_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
