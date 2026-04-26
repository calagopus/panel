use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _oauth_link_;

mod get {
    use crate::routes::api::admin::users::_user_::GetParamUser;
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoApiObject, Pagination, PaginationParamsWithSearch, user::GetPermissionManager,
            user_oauth_link::UserOAuthLink,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        oauth_links: Pagination<shared::models::user_oauth_link::ApiUserOAuthLink>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ), params(
        (
            "user" = uuid::Uuid,
            description = "The user ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
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
        user: GetParamUser,
        Query(params): Query<PaginationParamsWithSearch>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("users.oauth-links")?;

        let oauth_links = UserOAuthLink::by_user_uuid_with_pagination(
            &state.database,
            user.uuid,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        ApiResponse::new_serialized(Response {
            oauth_links: oauth_links
                .try_async_map(|oauth_link| oauth_link.into_api_object(&state, ()))
                .await?,
        })
        .ok()
    }
}

mod post {
    use crate::routes::api::admin::users::_user_::GetParamUser;
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            ByUuid, CreatableModel, IntoApiObject, admin_activity::GetAdminActivityLogger,
            oauth_provider::OAuthProvider, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(skip)]
        oauth_provider_uuid: uuid::Uuid,

        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        identifier: String,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        oauth_link: shared::models::user_oauth_link::ApiUserOAuthLink,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), params(
        (
            "user" = uuid::Uuid,
            description = "The user ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetParamUser,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("users.oauth-links")?;

        let oauth_provider =
            match OAuthProvider::by_uuid_optional(&state.database, data.oauth_provider_uuid).await?
            {
                Some(user) => user,
                None => {
                    return ApiResponse::error("oauth provider not found")
                        .with_status(StatusCode::NOT_FOUND)
                        .ok();
                }
            };

        let options = shared::models::user_oauth_link::CreateUserOAuthLinkOptions {
            user_uuid: user.uuid,
            oauth_provider_uuid: oauth_provider.uuid,
            identifier: data.identifier.into(),
        };

        let oauth_link =
            match shared::models::user_oauth_link::UserOAuthLink::create(&state, options).await {
                Ok(oauth_link) => oauth_link,
                Err(err) if err.is_unique_violation() => {
                    return ApiResponse::error(
                        "oauth link with provider + identifier already exists",
                    )
                    .with_status(StatusCode::CONFLICT)
                    .ok();
                }
                Err(err) => return ApiResponse::from(err).ok(),
            };

        activity_logger
            .log(
                "user:oauth-links.create",
                serde_json::json!({
                    "uuid": oauth_link.uuid,
                    "oauth_provider_uuid": oauth_provider.uuid,
                    "identifier": oauth_link.identifier,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            oauth_link: oauth_link.into_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/{oauth_link}", _oauth_link_::router(state))
        .with_state(state.clone())
}
