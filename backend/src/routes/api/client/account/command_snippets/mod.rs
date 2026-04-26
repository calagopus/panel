use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _command_snippet_;

mod get {
    use axum::extract::Query;
    use serde::Serialize;
    use shared::{
        GetState,
        models::{
            IntoApiObject, Pagination, PaginationParamsWithSearch,
            user::{GetPermissionManager, GetUser},
            user_command_snippet::UserCommandSnippet,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        command_snippets: Pagination<shared::models::user_command_snippet::ApiUserCommandSnippet>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ), params(
        (
            "page" = i64, Query,
            description = "The page number",
            example = "1",
        ),
        (
            "per_page" = i64, Query,
            description = "The number of items per page",
            example = "10",
        ),
        (
            "search" = Option<String>, Query,
            description = "Search term for items",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        Query(params): Query<PaginationParamsWithSearch>,
    ) -> ApiResponseResult {
        permissions.has_user_permission("command-snippets.read")?;

        let command_snippets = UserCommandSnippet::by_user_uuid_with_pagination(
            &state.database,
            user.uuid,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        ApiResponse::new_serialized(Response {
            command_snippets: command_snippets
                .try_async_map(|command_snippet| command_snippet.into_api_object(&state, ()))
                .await?,
        })
        .ok()
    }
}

mod post {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel, IntoApiObject,
            user::{GetPermissionManager, GetUser},
            user_activity::GetUserActivityLogger,
            user_command_snippet::UserCommandSnippet,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(chars, min = 1, max = 31))]
        #[schema(min_length = 1, max_length = 31)]
        name: compact_str::CompactString,

        #[garde(length(max = 100))]
        #[schema(max_length = 100)]
        eggs: Vec<uuid::Uuid>,
        #[garde(length(min = 1, max = 1024))]
        #[schema(min_length = 1, max_length = 1024)]
        command: compact_str::CompactString,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        command_snippet: shared::models::user_command_snippet::ApiUserCommandSnippet,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        activity_logger: GetUserActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_user_permission("command-snippets.create")?;

        let command_snippets =
            UserCommandSnippet::count_by_user_uuid(&state.database, user.uuid).await;
        if command_snippets >= 100 {
            return ApiResponse::error("maximum number of command snippets reached")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let options = shared::models::user_command_snippet::CreateUserCommandSnippetOptions {
            user_uuid: user.uuid,
            name: data.name,
            command: data.command,
            eggs: data.eggs,
        };
        let command_snippet = match UserCommandSnippet::create(&state, options).await {
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
                "user:command-snippet.create",
                serde_json::json!({
                    "uuid": command_snippet.uuid,
                    "name": command_snippet.name,
                    "eggs": command_snippet.eggs,
                    "command": command_snippet.command,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            command_snippet: command_snippet.into_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/{command_snippet}", _command_snippet_::router(state))
        .with_state(state.clone())
}
