use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use crate::routes::api::admin::oauth_providers::_oauth_provider_::GetOAuthProvider;
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoAdminApiObject, oauth_provider_mapping::OAuthProviderMapping,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        oauth_mapping: shared::models::oauth_provider_mapping::AdminApiOAuthProviderMapping,
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
            "mapping" = uuid::Uuid,
            description = "The oauth mapping ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        oauth_provider: GetOAuthProvider,
        Path((_oauth_provider, oauth_mapping)): Path<(uuid::Uuid, uuid::Uuid)>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("oauth-providers.read")?;

        let oauth_mapping = match OAuthProviderMapping::by_oauth_provider_uuid_uuid(
            &state.database,
            oauth_provider.uuid,
            oauth_mapping,
        )
        .await?
        {
            Some(mapping) => mapping,
            None => {
                return ApiResponse::error("oauth mapping not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        };

        ApiResponse::new_serialized(Response {
            oauth_mapping: oauth_mapping.into_admin_api_object(&state, ()).await?,
        })
        .ok()
    }
}

mod patch {
    use crate::routes::api::admin::oauth_providers::_oauth_provider_::GetOAuthProvider;
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            UpdatableModel,
            admin_activity::GetAdminActivityLogger,
            oauth_provider_mapping::{OAuthProviderMapping, UpdateOAuthProviderMappingOptions},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(patch, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
        (status = BAD_REQUEST, body = ApiError),
    ), params(
        (
            "oauth_provider" = uuid::Uuid,
            description = "The oauth provider ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "mapping" = uuid::Uuid,
            description = "The oauth mapping ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(UpdateOAuthProviderMappingOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        oauth_provider: GetOAuthProvider,
        activity_logger: GetAdminActivityLogger,
        Path((_oauth_provider, oauth_mapping)): Path<(uuid::Uuid, uuid::Uuid)>,
        shared::Payload(data): shared::Payload<UpdateOAuthProviderMappingOptions>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("oauth-providers.update")?;

        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let mut oauth_mapping = match OAuthProviderMapping::by_oauth_provider_uuid_uuid(
            &state.database,
            oauth_provider.uuid,
            oauth_mapping,
        )
        .await?
        {
            Some(oauth_mapping) => oauth_mapping,
            None => {
                return ApiResponse::error("oauth mapping not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        };

        oauth_mapping.update(&state, data).await?;

        activity_logger
            .log(
                "oauth-provider:mapping.update",
                serde_json::json!({
                    "uuid": oauth_mapping.uuid,
                    "oauth_provider_uuid": oauth_provider.uuid,
                    "scopes": oauth_mapping.scopes,
                    "mapping": oauth_mapping.mapping,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod delete {
    use crate::routes::api::admin::oauth_providers::_oauth_provider_::GetOAuthProvider;
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel, admin_activity::GetAdminActivityLogger,
            oauth_provider_mapping::OAuthProviderMapping, user::GetPermissionManager,
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
            "oauth_provider" = uuid::Uuid,
            description = "The oauth provider ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "mapping" = uuid::Uuid,
            description = "The oauth mapping ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        oauth_provider: GetOAuthProvider,
        activity_logger: GetAdminActivityLogger,
        Path((_oauth_provider, oauth_mapping)): Path<(uuid::Uuid, uuid::Uuid)>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("oauth-providers.update")?;

        let oauth_mapping = match OAuthProviderMapping::by_oauth_provider_uuid_uuid(
            &state.database,
            oauth_provider.uuid,
            oauth_mapping,
        )
        .await?
        {
            Some(oauth_mapping) => oauth_mapping,
            None => {
                return ApiResponse::error("oauth mapping not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        };

        oauth_mapping.delete(&state, ()).await?;

        activity_logger
            .log(
                "oauth-provider:mapping.delete",
                serde_json::json!({
                    "uuid": oauth_mapping.uuid,
                    "oauth_provider_uuid": oauth_provider.uuid,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(patch::route))
        .routes(routes!(delete::route))
        .with_state(state.clone())
}
