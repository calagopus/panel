use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _oauth_provider_;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoAdminApiObject, Pagination, PaginationParamsWithSearch,
            oauth_provider::OAuthProvider, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        oauth_providers: Pagination<shared::models::oauth_provider::AdminApiOAuthProvider>,
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
        Query(params): Query<PaginationParamsWithSearch>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("oauth-providers.read")?;

        let oauth_providers = OAuthProvider::all_with_pagination(
            &state.database,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        ApiResponse::new_serialized(Response {
            oauth_providers: oauth_providers
                .try_async_map(|oauth_provider| oauth_provider.into_admin_api_object(&state, ()))
                .await?,
        })
        .ok()
    }
}

mod post {
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel, IntoAdminApiObject,
            admin_activity::GetAdminActivityLogger,
            oauth_provider::{CreateOAuthProviderOptions, OAuthProvider},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        oauth_provider: shared::models::oauth_provider::AdminApiOAuthProvider,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), request_body = inline(CreateOAuthProviderOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<CreateOAuthProviderOptions>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("oauth-providers.create")?;

        let oauth_provider = match OAuthProvider::create(&state, data).await {
            Ok(oauth_provider) => oauth_provider,
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("oauth provider with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        };

        activity_logger
            .log(
                "oauth-provider:create",
                serde_json::json!({
                    "name": oauth_provider.name,
                    "description": oauth_provider.description,
                    "enabled": oauth_provider.enabled,
                    "login_only": oauth_provider.login_only,
                    "login_bypass_2fa": oauth_provider.login_bypass_2fa,
                    "link_viewable": oauth_provider.link_viewable,
                    "user_manageable": oauth_provider.user_manageable,
                    "basic_auth": oauth_provider.basic_auth,

                    "client_id": oauth_provider.client_id,
                    "client_secret": oauth_provider.client_secret,

                    "auth_url": oauth_provider.auth_url,
                    "token_url": oauth_provider.token_url,
                    "info_url": oauth_provider.info_url,
                    "scopes": oauth_provider.scopes,

                    "identifier_path": oauth_provider.identifier_path,
                    "email_path": oauth_provider.email_path,
                    "username_path": oauth_provider.username_path,
                    "name_first_path": oauth_provider.name_first_path,
                    "name_last_path": oauth_provider.name_last_path,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            oauth_provider: oauth_provider.into_admin_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/{oauth_provider}", _oauth_provider_::router(state))
        .with_state(state.clone())
}
