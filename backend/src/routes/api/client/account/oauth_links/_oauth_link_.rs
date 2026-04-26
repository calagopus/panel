use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoApiObject,
            user::{GetPermissionManager, GetUser},
            user_oauth_link::UserOAuthLink,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        oauth_link: shared::models::user_oauth_link::ApiUserOAuthLink,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "oauth_link" = uuid::Uuid,
            description = "The oauth link ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        Path(oauth_link): Path<uuid::Uuid>,
    ) -> ApiResponseResult {
        permissions.has_user_permission("users.oauth-links")?;

        let oauth_link =
            match UserOAuthLink::by_user_uuid_uuid(&state.database, user.uuid, oauth_link).await? {
                Some(oauth_link) => oauth_link,
                None => {
                    return ApiResponse::error("oauth link not found")
                        .with_status(StatusCode::NOT_FOUND)
                        .ok();
                }
            };

        ApiResponse::new_serialized(Response {
            oauth_link: oauth_link.into_api_object(&state, ()).await?,
        })
        .ok()
    }
}

mod delete {
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel,
            user::{GetPermissionManager, GetUser},
            user_activity::GetUserActivityLogger,
            user_oauth_link::UserOAuthLink,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "oauth_link" = uuid::Uuid,
            description = "The oauth link ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        activity_logger: GetUserActivityLogger,
        Path(oauth_link): Path<uuid::Uuid>,
    ) -> ApiResponseResult {
        permissions.has_user_permission("oauth-links.delete")?;

        let oauth_link =
            match UserOAuthLink::by_user_uuid_uuid(&state.database, user.uuid, oauth_link).await? {
                Some(oauth_link) => oauth_link,
                None => {
                    return ApiResponse::error("oauth link not found")
                        .with_status(StatusCode::NOT_FOUND)
                        .ok();
                }
            };

        oauth_link.delete(&state, ()).await?;

        activity_logger
            .log(
                "oauth-link:delete",
                serde_json::json!({
                    "uuid": oauth_link.uuid,
                    "oauth_provider": oauth_link.oauth_provider.fetch_cached(&state.database).await?.name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(delete::route))
        .with_state(state.clone())
}
