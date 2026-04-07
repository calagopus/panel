use super::State;
use axum::{
    extract::{Path, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{
    GetState,
    models::{
        ByUuid,
        user::{GetPermissionManager, User},
    },
    response::ApiResponse,
};
use std::ops::{Deref, DerefMut};
use utoipa_axum::{router::OpenApiRouter, routes};

mod activity;
mod email;
mod oauth_links;
mod servers;
mod two_factor;

#[derive(Clone)]
pub struct ParamUser(pub User);

impl Deref for ParamUser {
    type Target = User;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for ParamUser {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

pub type GetParamUser = shared::extract::ConsumingExtension<ParamUser>;

pub async fn auth(
    state: GetState,
    permissions: GetPermissionManager,
    Path(user): Path<Vec<String>>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    if let Err(err) = permissions.has_admin_permission("users.read") {
        return Ok(err.into_response());
    }

    let user = match uuid::Uuid::parse_str(&user[0]) {
        Ok(user) => user,
        Err(_) => {
            return Ok(ApiResponse::error("invalid user uuid")
                .with_status(StatusCode::BAD_REQUEST)
                .into_response());
        }
    };
    let user = User::by_uuid_optional(&state.database, user).await;
    let user = match user {
        Ok(Some(user)) => user,
        Ok(None) => {
            return Ok(ApiResponse::error("user not found")
                .with_status(StatusCode::NOT_FOUND)
                .into_response());
        }
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    req.extensions_mut().insert(ParamUser(user));

    Ok(next.run(req).await)
}

mod get {
    use crate::routes::api::admin::users::_user_::GetParamUser;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        user: shared::models::user::AdminApiUser,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "user" = uuid::Uuid,
            description = "The user ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetParamUser,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("users.read")?;

        ApiResponse::new_serialized(Response {
            user: user
                .0
                .0
                .into_admin_api_object(&state.storage.retrieve_urls().await?),
        })
        .ok()
    }
}

mod delete {
    use crate::routes::api::admin::users::_user_::GetParamUser;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel, admin_activity::GetAdminActivityLogger, server::Server,
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
    ), params(
        (
            "user" = uuid::Uuid,
            description = "The user ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetParamUser,
        activity_logger: GetAdminActivityLogger,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("users.delete")?;

        let servers = Server::count_by_user_uuid(&state.database, user.uuid).await;
        if servers > 0 {
            return ApiResponse::error("user has servers, cannot delete")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        user.delete(&state, ()).await?;

        activity_logger
            .log(
                "user:delete",
                serde_json::json!({
                    "uuid": user.uuid,
                    "username": user.username,
                    "email": user.email,
                    "name_first": user.name_first,
                    "name_last": user.name_last,
                    "admin": user.admin,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod patch {
    use crate::routes::api::admin::users::_user_::GetParamUser;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            UpdatableModel,
            admin_activity::GetAdminActivityLogger,
            user::{GetPermissionManager, UpdateUserOptions},
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
            "user" = uuid::Uuid,
            description = "The user ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(UpdateUserOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        mut user: GetParamUser,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<UpdateUserOptions>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("users.update")?;

        match user.update(&state, data).await {
            Ok(_) => {}
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("user with email/username/external_id already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        }

        activity_logger
            .log(
                "user:update",
                serde_json::json!({
                    "uuid": user.uuid,
                    "role_uuid": user.role.as_ref().map(|r| r.uuid),
                    "username": user.username,
                    "email": user.email,
                    "name_first": user.name_first,
                    "name_last": user.name_last,
                    "admin": user.admin,
                    "language": user.language,
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
        .nest("/two-factor", two_factor::router(state))
        .nest("/servers", servers::router(state))
        .nest("/activity", activity::router(state))
        .nest("/oauth-links", oauth_links::router(state))
        .nest("/email", email::router(state))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
