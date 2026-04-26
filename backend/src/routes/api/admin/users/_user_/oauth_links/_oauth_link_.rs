use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use crate::routes::api::admin::users::_user_::GetParamUser;
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{IntoApiObject, user::GetPermissionManager, user_oauth_link::UserOAuthLink},
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
            "user" = uuid::Uuid,
            description = "The user ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "oauth_link" = uuid::Uuid,
            description = "The oauth link ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetParamUser,
        Path((_user, oauth_link)): Path<(String, uuid::Uuid)>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("users.oauth-links")?;

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
    use crate::routes::api::admin::users::_user_::GetParamUser;
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel, admin_activity::GetAdminActivityLogger, user::GetPermissionManager,
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
            "user" = uuid::Uuid,
            description = "The user ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "oauth_link" = uuid::Uuid,
            description = "The oauth link ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetParamUser,
        activity_logger: GetAdminActivityLogger,
        Path((_user, oauth_link)): Path<(String, uuid::Uuid)>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("users.oauth-links")?;

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
                "server:oauth-link.delete",
                serde_json::json!({
                    "oauth_link_uuid": oauth_link.uuid,
                    "oauth_provider_uuid": oauth_link.oauth_provider.uuid,
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
