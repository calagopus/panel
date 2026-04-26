use super::State;
use crate::routes::api::admin::nests::_nest_::GetNest;
use axum::{
    extract::{Path, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{
    GetState,
    models::{nest_egg::NestEgg, user::GetPermissionManager},
    response::ApiResponse,
};
use utoipa_axum::{router::OpenApiRouter, routes};

mod export;
mod mounts;
mod r#move;
mod servers;
mod update;
mod variables;

pub type GetNestEgg = shared::extract::ConsumingExtension<NestEgg>;

pub async fn auth(
    state: GetState,
    permissions: GetPermissionManager,
    nest: GetNest,
    Path(egg): Path<Vec<String>>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let egg = match egg.get(1).map(|s| s.parse::<uuid::Uuid>()) {
        Some(Ok(id)) => id,
        _ => {
            return Ok(ApiResponse::error("invalid egg id")
                .with_status(StatusCode::BAD_REQUEST)
                .into_response());
        }
    };

    if let Err(err) = permissions.has_admin_permission("eggs.read") {
        return Ok(err.into_response());
    }

    let egg = NestEgg::by_nest_uuid_uuid(&state.database, nest.uuid, egg).await;
    let egg = match egg {
        Ok(Some(egg)) => egg,
        Ok(None) => {
            return Ok(ApiResponse::error("egg not found")
                .with_status(StatusCode::NOT_FOUND)
                .into_response());
        }
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    req.extensions_mut().insert(nest.0);
    req.extensions_mut().insert(egg);

    Ok(next.run(req).await)
}

mod get {
    use crate::routes::api::admin::nests::_nest_::eggs::_egg_::GetNestEgg;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{IntoAdminApiObject, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        egg: shared::models::nest_egg::AdminApiNestEgg,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "nest" = uuid::Uuid,
            description = "The nest ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "egg" = uuid::Uuid,
            description = "The egg ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        egg: GetNestEgg,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("eggs.read")?;

        ApiResponse::new_serialized(Response {
            egg: egg.0.into_admin_api_object(&state, ()).await?,
        })
        .ok()
    }
}

mod delete {
    use crate::routes::api::admin::nests::_nest_::{GetNest, eggs::_egg_::GetNestEgg};
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
        (status = CONFLICT, body = ApiError),
    ), params(
        (
            "nest" = uuid::Uuid,
            description = "The nest ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "egg" = uuid::Uuid,
            description = "The egg ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        nest: GetNest,
        egg: GetNestEgg,
        activity_logger: GetAdminActivityLogger,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("eggs.delete")?;

        if Server::count_by_egg_uuid(&state.database, egg.uuid).await > 0 {
            return ApiResponse::error("egg has servers, cannot delete")
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        egg.delete(&state, ()).await?;

        activity_logger
            .log(
                "nest:egg.delete",
                serde_json::json!({
                    "uuid": egg.uuid,
                    "nest_uuid": nest.uuid,

                    "author": egg.author,
                    "name": egg.name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod patch {
    use crate::routes::api::admin::nests::_nest_::{GetNest, eggs::_egg_::GetNestEgg};
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            UpdatableModel, admin_activity::GetAdminActivityLogger, nest_egg::UpdateNestEggOptions,
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
            "nest" = uuid::Uuid,
            description = "The nest ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "egg" = uuid::Uuid,
            description = "The egg ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(UpdateNestEggOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        nest: GetNest,
        mut egg: GetNestEgg,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<UpdateNestEggOptions>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("eggs.update")?;

        match egg.update(&state, data).await {
            Ok(_) => {}
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("egg with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        }

        activity_logger
            .log(
                "nest:egg.update",
                serde_json::json!({
                    "uuid": egg.uuid,
                    "nest_uuid": nest.uuid,
                    "egg_repository_egg_uuid": egg.egg_repository_egg.as_ref().map(|e| e.uuid),

                    "author": egg.author,
                    "name": egg.name,
                    "description": egg.description,

                    "config_files": egg.config_files,
                    "config_startup": egg.config_startup,
                    "config_stop": egg.config_stop,
                    "config_script": egg.config_script,

                    "startup": egg.startup,
                    "force_outgoing_ip": egg.force_outgoing_ip,
                    "separate_port": egg.separate_port,

                    "features": egg.features,
                    "docker_images": egg.docker_images,
                    "file_denylist": egg.file_denylist,
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
        .nest("/servers", servers::router(state))
        .nest("/update", update::router(state))
        .nest("/variables", variables::router(state))
        .nest("/move", r#move::router(state))
        .nest("/mounts", mounts::router(state))
        .nest("/export", export::router(state))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
