use super::State;
use axum::{
    extract::{Path, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{
    GetState,
    models::{ByUuid, role::Role, user::GetPermissionManager},
    response::ApiResponse,
};
use utoipa_axum::{router::OpenApiRouter, routes};

mod users;

pub type GetRole = shared::extract::ConsumingExtension<Role>;

pub async fn auth(
    state: GetState,
    permissions: GetPermissionManager,
    Path(role): Path<uuid::Uuid>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    if let Err(err) = permissions.has_admin_permission("roles.read") {
        return Ok(err.into_response());
    }

    let role = Role::by_uuid_optional(&state.database, role).await;
    let role = match role {
        Ok(Some(role)) => role,
        Ok(None) => {
            return Ok(ApiResponse::error("role not found")
                .with_status(StatusCode::NOT_FOUND)
                .into_response());
        }
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    req.extensions_mut().insert(role);

    Ok(next.run(req).await)
}

mod get {
    use crate::routes::api::admin::roles::_role_::GetRole;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{IntoAdminApiObject, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        role: shared::models::role::AdminApiRole,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "role" = uuid::Uuid,
            description = "The role ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        role: GetRole,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("roles.read")?;

        ApiResponse::new_serialized(Response {
            role: role.0.into_admin_api_object(&state, ()).await?,
        })
        .ok()
    }
}

mod delete {
    use crate::routes::api::admin::roles::_role_::GetRole;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel, admin_activity::GetAdminActivityLogger, user::GetPermissionManager,
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
            "role" = uuid::Uuid,
            description = "The role ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        role: GetRole,
        activity_logger: GetAdminActivityLogger,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("roles.delete")?;

        role.delete(&state, ()).await?;

        activity_logger
            .log(
                "role:delete",
                serde_json::json!({
                    "uuid": role.uuid,
                    "name": role.name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod patch {
    use crate::routes::api::admin::roles::_role_::GetRole;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            UpdatableModel, admin_activity::GetAdminActivityLogger, role::UpdateRoleOptions,
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
            "user" = uuid::Uuid,
            description = "The user ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(UpdateRoleOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        mut role: GetRole,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<UpdateRoleOptions>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("roles.update")?;

        match role.update(&state, data).await {
            Ok(_) => {}
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("role with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        }

        activity_logger
            .log(
                "role:update",
                serde_json::json!({
                    "uuid": role.uuid,
                    "name": role.name,
                    "description": role.description,
                    "require_two_factor": role.require_two_factor,
                    "admin_permissions": role.admin_permissions,
                    "server_permissions": role.server_permissions,
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
        .nest("/users", users::router(state))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
