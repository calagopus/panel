use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _security_key_;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoApiObject, Pagination, PaginationParamsWithSearch,
            user::{GetPermissionManager, GetUser},
            user_security_key::UserSecurityKey,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        security_keys: Pagination<shared::models::user_security_key::ApiUserSecurityKey>,
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
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_user_permission("security-keys.read")?;

        let security_keys = UserSecurityKey::by_user_uuid_with_pagination(
            &state.database,
            user.uuid,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        ApiResponse::new_serialized(Response {
            security_keys: security_keys
                .try_async_map(|security_key| security_key.into_api_object(&state, ()))
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
            user_security_key::UserSecurityKey,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;
    use webauthn_rs::prelude::CreationChallengeResponse;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(chars, min = 3, max = 31))]
        #[schema(min_length = 3, max_length = 31)]
        name: compact_str::CompactString,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        security_key: shared::models::user_security_key::ApiUserSecurityKey,
        #[schema(value_type = serde_json::Value)]
        options: CreationChallengeResponse,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_user_permission("security-keys.create")?;

        let webauthn = state.settings.get_webauthn().await?;

        let credential_ids = sqlx::query!(
            "SELECT user_security_keys.credential_id
            FROM user_security_keys
            WHERE user_security_keys.user_uuid = $1 AND user_security_keys.passkey IS NOT NULL",
            user.uuid
        )
        .fetch_all(state.database.read())
        .await?;

        let (webauthn_options, registration) = webauthn.start_passkey_registration(
            user.uuid,
            &user.email,
            &user.username,
            Some(
                credential_ids
                    .into_iter()
                    .map(|id| id.credential_id.into())
                    .collect(),
            ),
        )?;

        UserSecurityKey::delete_unconfigured_by_user_uuid_name(
            &state.database,
            user.uuid,
            &data.name,
        )
        .await?;

        let options = shared::models::user_security_key::CreateUserSecurityKeyOptions {
            user_uuid: user.uuid,
            name: data.name,
            registration,
        };
        let security_key = match UserSecurityKey::create(&state, options).await {
            Ok(security_key) => security_key,
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("security key with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        };

        ApiResponse::new_serialized(Response {
            security_key: security_key.into_api_object(&state, ()).await?,
            options: webauthn_options,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/{security_key}", _security_key_::router(state))
        .with_state(state.clone())
}
