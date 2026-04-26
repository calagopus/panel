use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _api_key_;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoApiObject, Pagination, PaginationParamsWithSearch,
            user::{GetPermissionManager, GetUser},
            user_api_key::UserApiKey,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        api_keys: Pagination<shared::models::user_api_key::ApiUserApiKey>,
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

        permissions.has_user_permission("api-keys.read")?;

        let api_keys = UserApiKey::by_user_uuid_with_pagination(
            &state.database,
            user.uuid,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        ApiResponse::new_serialized(Response {
            api_keys: api_keys
                .try_async_map(|api_key| api_key.into_api_object(&state, ()))
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
            user::{AuthMethod, GetAuthMethod, GetPermissionManager, GetUser},
            user_activity::GetUserActivityLogger,
            user_api_key::{CreateUserApiKeyOptions, UserApiKey},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(chars, min = 3, max = 31))]
        #[schema(min_length = 3, max_length = 31)]
        name: compact_str::CompactString,
        #[garde(skip)]
        #[schema(value_type = Vec<String>)]
        allowed_ips: Vec<sqlx::types::ipnetwork::IpNetwork>,

        #[garde(custom(shared::permissions::validate_user_permissions))]
        user_permissions: Vec<compact_str::CompactString>,
        #[garde(custom(shared::permissions::validate_admin_permissions))]
        admin_permissions: Vec<compact_str::CompactString>,
        #[garde(custom(shared::permissions::validate_server_permissions))]
        server_permissions: Vec<compact_str::CompactString>,

        #[garde(inner(custom(shared::utils::validate_time_in_future)))]
        expires: Option<chrono::DateTime<chrono::Utc>>,
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
        (status = CONFLICT, body = ApiError),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        auth: GetAuthMethod,
        user: GetUser,
        activity_logger: GetUserActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_user_permission("api-keys.create")?;

        if let AuthMethod::ApiKey(api_key) = &*auth
            && (!data
                .user_permissions
                .iter()
                .all(|p| api_key.user_permissions.contains(p))
                || !data
                    .admin_permissions
                    .iter()
                    .all(|p| api_key.admin_permissions.contains(p))
                || !data
                    .server_permissions
                    .iter()
                    .all(|p| api_key.server_permissions.contains(p)))
        {
            return ApiResponse::error("permissions: more permissions than self")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let options = CreateUserApiKeyOptions {
            user_uuid: user.uuid,
            name: data.name,
            allowed_ips: data.allowed_ips,
            user_permissions: data.user_permissions,
            admin_permissions: data.admin_permissions,
            server_permissions: data.server_permissions,
            expires: data.expires,
        };
        let (key, api_key) = match UserApiKey::create(&state, options).await {
            Ok(result) => result,
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("api key with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        };

        activity_logger
            .log(
                "api-key:create",
                serde_json::json!({
                    "uuid": api_key.uuid,
                    "identifier": api_key.key_start,
                    "name": api_key.name,
                    "allowed_ips": api_key.allowed_ips,
                    "user_permissions": api_key.user_permissions,
                    "admin_permissions": api_key.admin_permissions,
                    "server_permissions": api_key.server_permissions,
                    "expires": api_key.expires,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            api_key: api_key.into_api_object(&state, ()).await?,
            key,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/{api_key}", _api_key_::router(state))
        .with_state(state.clone())
}
