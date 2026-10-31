use super::State;
use axum::{
    extract::{Path, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{
    GetState,
    models::{ByUuid, oauth_provider::OAuthProvider, user::GetPermissionManager},
    response::ApiResponse,
};
use utoipa_axum::{router::OpenApiRouter, routes};

mod duplicate;
mod mappings;
mod users;

pub type GetOAuthProvider = shared::extract::ConsumingExtension<OAuthProvider>;

pub async fn auth(
    state: GetState,
    permissions: GetPermissionManager,
    Path(oauth_provider): Path<Vec<String>>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    if let Err(err) = permissions.has_admin_permission("oauth-providers.read") {
        return Ok(err.into_response());
    }

    let oauth_provider = match uuid::Uuid::parse_str(&oauth_provider[0]) {
        Ok(uuid) => uuid,
        Err(_) => {
            return Ok(ApiResponse::error("invalid oauth provider uuid")
                .with_status(StatusCode::BAD_REQUEST)
                .into_response());
        }
    };
    let oauth_provider = OAuthProvider::by_uuid_optional(&state.database, oauth_provider).await;
    let oauth_provider = match oauth_provider {
        Ok(Some(oauth_provider)) => oauth_provider,
        Ok(None) => {
            return Ok(ApiResponse::error("oauth provider not found")
                .with_status(StatusCode::NOT_FOUND)
                .into_response());
        }
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    req.extensions_mut().insert(oauth_provider);

    Ok(next.run(req).await)
}

mod get {
    use crate::routes::api::admin::oauth_providers::_oauth_provider_::GetOAuthProvider;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{IntoAdminApiObject, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        oauth_provider: shared::models::oauth_provider::AdminApiOAuthProvider,
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
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        oauth_provider: GetOAuthProvider,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("oauth-providers.read")?;

        ApiResponse::new_serialized(Response {
            oauth_provider: oauth_provider.0.into_admin_api_object(&state, ()).await?,
        })
        .ok()
    }
}

mod delete {
    use crate::routes::api::admin::oauth_providers::_oauth_provider_::GetOAuthProvider;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel, admin_activity::GetAdminActivityLogger, oauth_provider::OAuthProvider,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), params(
        (
            "oauth_provider" = uuid::Uuid,
            description = "The oauth provider ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        oauth_provider: GetOAuthProvider,
        activity_logger: GetAdminActivityLogger,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("oauth-providers.delete")?;

        if !state
            .settings
            .get_as(|s| s.app.password_login_enabled)
            .await?
            && !OAuthProvider::exists_usable_except(&state.database, Some(oauth_provider.uuid))
                .await?
        {
            return ApiResponse::error(
                "password login is disabled, cannot delete the last enabled oauth provider",
            )
            .with_status(StatusCode::CONFLICT)
            .ok();
        }

        oauth_provider.delete(&state, ()).await?;

        activity_logger
            .log(
                "oauth-provider:delete",
                serde_json::json!({
                    "uuid": oauth_provider.uuid,
                    "name": oauth_provider.name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod patch {
    use crate::routes::api::admin::oauth_providers::_oauth_provider_::GetOAuthProvider;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            UpdatableModel,
            admin_activity::GetAdminActivityLogger,
            oauth_provider::{OAuthProvider, UpdateOAuthProviderOptions},
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
        (status = CONFLICT, body = ApiError),
    ), params(
        (
            "oauth_provider" = uuid::Uuid,
            description = "The oauth provider ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(UpdateOAuthProviderOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        mut oauth_provider: GetOAuthProvider,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<UpdateOAuthProviderOptions>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("oauth-providers.update")?;

        if !permissions.is_unrestricted_admin() && data.changes_identity(&oauth_provider) {
            return ApiResponse::error(
                "only administrators can change how an oauth provider identifies users, how they may sign in with it or who may link accounts to it",
            )
            .with_status(StatusCode::FORBIDDEN)
            .ok();
        }

        if data.enabled == Some(false)
            && !state
                .settings
                .get_as(|s| s.app.password_login_enabled)
                .await?
            && !OAuthProvider::exists_usable_except(&state.database, Some(oauth_provider.uuid))
                .await?
        {
            return ApiResponse::error(
                "password login is disabled, cannot disable the last enabled oauth provider",
            )
            .with_status(StatusCode::CONFLICT)
            .ok();
        }

        match oauth_provider.update(&state, data).await {
            Ok(_) => {}
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("oauth provider with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        }

        activity_logger
            .log(
                "oauth-provider:update",
                serde_json::json!({
                    "name": oauth_provider.name,
                    "description": oauth_provider.description,
                    "icon": oauth_provider.icon,
                    "enabled": oauth_provider.enabled,
                    "login_viewable": oauth_provider.login_viewable,
                    "login_only": oauth_provider.login_only,
                    "login_bypass_two_factor": oauth_provider.login_bypass_two_factor,
                    "link_viewable": oauth_provider.link_viewable,
                    "api_linkable": oauth_provider.api_linkable,
                    "user_manageable": oauth_provider.user_manageable,
                    "basic_auth": oauth_provider.basic_auth,
                    "pkce": oauth_provider.pkce,

                    "client_id": oauth_provider.client_id,

                    "auth_url": oauth_provider.auth_url,
                    "token_url": oauth_provider.token_url,
                    "info_url": oauth_provider.info_url,
                    "info_urls": oauth_provider.info_urls,
                    "scopes": oauth_provider.scopes,

                    "identifier_path": oauth_provider.identifier_path,
                    "email_path": oauth_provider.email_path,
                    "username_path": oauth_provider.username_path,
                    "name_first_path": oauth_provider.name_first_path,
                    "name_last_path": oauth_provider.name_last_path,
                    "avatar_url_template": oauth_provider.avatar_url_template,
                    "avatar_overwrite": oauth_provider.avatar_overwrite,
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
        .routes(routes!(patch::route))
        .nest("/duplicate", duplicate::router(state))
        .nest("/mappings", mappings::router(state))
        .nest("/users", users::router(state))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
