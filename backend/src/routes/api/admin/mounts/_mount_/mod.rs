use super::State;
use axum::{
    extract::{Path, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{
    GetState,
    models::{ByUuid, mount::Mount, user::GetPermissionManager},
    response::ApiResponse,
};
use utoipa_axum::{router::OpenApiRouter, routes};

mod nest_eggs;
mod nodes;
mod servers;

pub type GetMount = shared::extract::ConsumingExtension<Mount>;

pub async fn auth(
    state: GetState,
    permissions: GetPermissionManager,
    Path(mount): Path<uuid::Uuid>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    if let Err(err) = permissions.has_admin_permission("mounts.read") {
        return Ok(err.into_response());
    }

    let mount = Mount::by_uuid_optional(&state.database, mount).await;
    let mount = match mount {
        Ok(Some(mount)) => mount,
        Ok(None) => {
            return Ok(ApiResponse::error("mount not found")
                .with_status(StatusCode::NOT_FOUND)
                .into_response());
        }
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    req.extensions_mut().insert(mount);

    Ok(next.run(req).await)
}

mod get {
    use crate::routes::api::admin::mounts::_mount_::GetMount;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{IntoAdminApiObject, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        mount: shared::models::mount::AdminApiMount,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "mount" = uuid::Uuid,
            description = "The mount ID",
            example = "1",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        mount: GetMount,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("mounts.read")?;

        ApiResponse::new_serialized(Response {
            mount: mount.0.into_admin_api_object(&state, ()).await?,
        })
        .ok()
    }
}

mod delete {
    use crate::routes::api::admin::mounts::_mount_::GetMount;
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
        (status = CONFLICT, body = ApiError),
    ), params(
        (
            "mount" = uuid::Uuid,
            description = "The mount ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        mount: GetMount,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("mounts.delete")?;

        mount.delete(&state, ()).await?;

        activity_logger
            .log(
                "mount:delete",
                serde_json::json!({
                    "uuid": mount.uuid,
                    "name": mount.name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod patch {
    use crate::routes::api::admin::mounts::_mount_::GetMount;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            UpdatableModel, admin_activity::GetAdminActivityLogger, mount::UpdateMountOptions,
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
            "mount" = uuid::Uuid,
            description = "The mount ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(UpdateMountOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        mut mount: GetMount,
        shared::Payload(data): shared::Payload<UpdateMountOptions>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("mounts.update")?;

        match mount.update(&state, data).await {
            Ok(_) => {}
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("mount with name/source/target already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        }

        activity_logger
            .log(
                "mount:update",
                serde_json::json!({
                    "uuid": mount.uuid,
                    "name": mount.name,
                    "description": mount.description,

                    "source": mount.source,
                    "target": mount.target,

                    "read_only": mount.read_only,
                    "user_mountable": mount.user_mountable,
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
        .nest("/nest-eggs", nest_eggs::router(state))
        .nest("/nodes", nodes::router(state))
        .nest("/servers", servers::router(state))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
