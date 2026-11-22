use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            user::{GetAuthMethod, GetPermissionManager, GetUser},
            user_activity::GetUserActivityLogger,
            user_api_key::UserApiKey,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        key: String,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "api_key" = uuid::Uuid,
            description = "The API key ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        auth: GetAuthMethod,
        user: GetUser,
        activity_logger: GetUserActivityLogger,
        Path(api_key): Path<uuid::Uuid>,
    ) -> ApiResponseResult {
        permissions.has_user_permission("api-keys.recreate")?;
        permissions.deny_while_impersonating()?;

        if auth.api_key_uuid() == Some(api_key) {
            return ApiResponse::error("unable to recreate the api key currently in use")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let mut api_key =
            match UserApiKey::by_user_uuid_uuid(&state.database, user.uuid, api_key).await? {
                Some(api_key) => api_key,
                None => {
                    return ApiResponse::error("api key not found")
                        .with_status(StatusCode::NOT_FOUND)
                        .ok();
                }
            };

        if !permissions.scope().covers(
            &api_key.user_permissions,
            &api_key.admin_permissions,
            &api_key.server_permissions,
        ) {
            return ApiResponse::error(
                "unable to recreate api key with more permissions than self",
            )
            .with_status(StatusCode::BAD_REQUEST)
            .ok();
        }

        if api_key.unrestricted_admin && !permissions.is_unrestricted_admin() {
            return ApiResponse::error(
                "only administrators can recreate an api key with unrestricted admin access",
            )
            .with_status(StatusCode::FORBIDDEN)
            .ok();
        }

        let key = api_key.recreate(&state.database).await?;

        activity_logger
            .log(
                "api-key:recreate",
                serde_json::json!({
                    "uuid": api_key.uuid,
                    "identifier": api_key.key_start,
                    "name": api_key.name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response { key }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
