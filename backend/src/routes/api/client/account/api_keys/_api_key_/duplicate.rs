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
            user_api_key::{DuplicateUserApiKeyOptions, UserApiKey},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(chars, min = 3, max = 31))]
        #[schema(min_length = 3, max_length = 31)]
        name: compact_str::CompactString,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        api_key: shared::models::user_api_key::ApiUserApiKey,
        key: String,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "api_key" = uuid::Uuid,
            description = "The API key ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        activity_logger: GetUserActivityLogger,
        Path(api_key): Path<uuid::Uuid>,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_user_permission("api-keys.create")?;
        permissions.deny_while_impersonating()?;

        let api_key =
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
                "unable to duplicate api key with more permissions than self",
            )
            .with_status(StatusCode::BAD_REQUEST)
            .ok();
        }

        if api_key.unrestricted_admin && !permissions.is_unrestricted_admin() {
            return ApiResponse::error(
                "only administrators can duplicate an api key with unrestricted admin access",
            )
            .with_status(StatusCode::FORBIDDEN)
            .ok();
        }

        let api_keys_lock = state
            .cache
            .lock(
                format!("users::{}::api_keys", user.uuid),
                Some(30),
                Some(5000),
            )
            .await?;

        let api_keys = UserApiKey::count_by_user_uuid(&state.database, user.uuid).await?;
        if api_keys >= state.settings.get().await?.user.max_api_key_count as i64 {
            return ApiResponse::error("maximum number of api keys reached")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let options = DuplicateUserApiKeyOptions {
            user_uuid: user.uuid,
            name: data.name,
        };
        let (key, duplicated) = match DuplicableModel::duplicate(&api_key, &state, options).await {
            Ok(result) => result,
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("api key with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        };

        drop(api_keys_lock);

        activity_logger
            .log(
                "api-key:duplicate",
                serde_json::json!({
                    "source_uuid": api_key.uuid,
                    "source_name": api_key.name,
                    "uuid": duplicated.uuid,
                    "identifier": duplicated.key_start,
                    "name": duplicated.name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            api_key: duplicated.into_api_object(&state, ()).await?,
            key,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
