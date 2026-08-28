use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use serde::Serialize;
    use shared::{
        GetState,
        models::user::{GetPermissionManager, GetUser, settings::UserSettings},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(value_type = std::collections::BTreeMap<String, serde_json::Value>)]
        settings: UserSettings,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
    ) -> ApiResponseResult {
        permissions.has_user_permission("settings.read")?;

        ApiResponse::new_serialized(Response {
            settings: user.get_settings(&state.database).await?,
        })
        .ok()
    }
}

mod patch {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::user::{
            GetPermissionManager, GetUser, GetUserImpersonator, settings::UserSettingsMap,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(custom(shared::models::user::settings::validate_settings_keys))]
        #[schema(value_type = std::collections::BTreeMap<String, serde_json::Value>)]
        settings: UserSettingsMap,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(patch, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = CONFLICT, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        user_impersonator: GetUserImpersonator,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_user_permission("settings.update")?;

        if user_impersonator.is_some() {
            return ApiResponse::error("user settings cannot be modified while impersonating")
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        if data.settings.is_empty() {
            return ApiResponse::new_serialized(Response {}).ok();
        }

        let settings = state.settings.get().await?;
        let max_settings_count = settings.user.max_settings_count as usize;
        let max_settings_value_bytes = settings.user.max_settings_value_bytes as usize;
        drop(settings);

        for value in data.settings.values() {
            if !value.is_null() && serde_json::to_vec(value)?.len() > max_settings_value_bytes {
                return ApiResponse::error("maximum setting value size exceeded")
                    .with_status(StatusCode::EXPECTATION_FAILED)
                    .ok();
            }
        }

        let mut user_settings = user.get_settings_mut(&state.database).await?;
        for (key, value) in data.settings {
            if value.is_null() {
                user_settings.remove(&key);
            } else {
                user_settings.insert(key, value);
            }
        }

        if user_settings.len() > max_settings_count {
            return ApiResponse::error("maximum number of settings reached")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        user_settings.save(&state.database).await?;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(patch::route))
        .with_state(state.clone())
}
