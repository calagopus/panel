use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _mapping_;

mod get {
    use crate::routes::api::admin::oauth_providers::_oauth_provider_::GetOAuthProvider;
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoAdminApiObject, Pagination, PaginationParams,
            oauth_provider_mapping::OAuthProviderMapping, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        oauth_mappings:
            Pagination<shared::models::oauth_provider_mapping::AdminApiOAuthProviderMapping>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "oauth_provider" = uuid::Uuid,
            description = "The oauth provider ID",
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
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        oauth_provider: GetOAuthProvider,
        Query(params): Query<PaginationParams>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("oauth-providers.read")?;

        let oauth_mappings = OAuthProviderMapping::by_oauth_provider_uuid_with_pagination(
            &state.database,
            oauth_provider.uuid,
            params.page,
            params.per_page,
        )
        .await?;

        ApiResponse::new_serialized(Response {
            oauth_mappings: oauth_mappings
                .try_async_map(|mapping| mapping.into_admin_api_object(&state, ()))
                .await?,
        })
        .ok()
    }
}

mod post {
    use crate::routes::api::admin::oauth_providers::_oauth_provider_::GetOAuthProvider;
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel, IntoAdminApiObject,
            admin_activity::GetAdminActivityLogger,
            oauth_provider_mapping::{
                CreateOAuthProviderMappingOptions, OAuthProviderMapping,
                OAuthProviderMappingMatcher, OAuthProviderMappingType,
            },
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(dive, custom(OAuthProviderMappingMatcher::validate_nesting))]
        matcher: OAuthProviderMappingMatcher,
        #[garde(dive)]
        mapping: OAuthProviderMappingType,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        oauth_mapping: shared::models::oauth_provider_mapping::AdminApiOAuthProviderMapping,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
        (status = BAD_REQUEST, body = ApiError),
    ), params(
        (
            "oauth_provider" = uuid::Uuid,
            description = "The oauth provider ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        oauth_provider: GetOAuthProvider,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("oauth-providers.update")?;

        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let options = CreateOAuthProviderMappingOptions {
            oauth_provider_uuid: oauth_provider.uuid,
            matcher: data.matcher,
            mapping: data.mapping,
        };
        let oauth_mapping = OAuthProviderMapping::create(&state, options).await?;

        activity_logger
            .log(
                "oauth-provider:mapping.create",
                serde_json::json!({
                    "uuid": oauth_mapping.uuid,
                    "oauth_provider_uuid": oauth_provider.uuid,
                    "matcher": oauth_mapping.matcher,
                    "mapping": oauth_mapping.mapping,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            oauth_mapping: oauth_mapping.into_admin_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/{mapping}", _mapping_::router(state))
        .with_state(state.clone())
}
