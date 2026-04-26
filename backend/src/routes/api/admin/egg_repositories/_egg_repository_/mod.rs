use super::State;
use axum::{
    extract::{Path, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{
    GetState,
    models::{ByUuid, egg_repository::EggRepository, user::GetPermissionManager},
    response::ApiResponse,
};
use utoipa_axum::{router::OpenApiRouter, routes};

mod eggs;
mod sync;

pub type GetEggRepository = shared::extract::ConsumingExtension<EggRepository>;

pub async fn auth(
    state: GetState,
    permissions: GetPermissionManager,
    Path(egg_repository): Path<Vec<String>>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let egg_repository = match egg_repository.first().map(|s| s.parse::<uuid::Uuid>()) {
        Some(Ok(id)) => id,
        _ => {
            return Ok(ApiResponse::error("invalid egg repository id")
                .with_status(StatusCode::BAD_REQUEST)
                .into_response());
        }
    };

    if let Err(err) = permissions.has_admin_permission("egg-repositories.read") {
        return Ok(err.into_response());
    }

    let egg_repository = EggRepository::by_uuid_optional(&state.database, egg_repository).await;
    let egg_repository = match egg_repository {
        Ok(Some(egg_repository)) => egg_repository,
        Ok(None) => {
            return Ok(ApiResponse::error("egg repository not found")
                .with_status(StatusCode::NOT_FOUND)
                .into_response());
        }
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    req.extensions_mut().insert(egg_repository);

    Ok(next.run(req).await)
}

mod get {
    use crate::routes::api::admin::egg_repositories::_egg_repository_::GetEggRepository;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{IntoAdminApiObject, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        egg_repository: shared::models::egg_repository::AdminApiEggRepository,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "egg_repository" = uuid::Uuid,
            description = "The egg repository ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        egg_repository: GetEggRepository,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("egg-repositories.read")?;

        ApiResponse::new_serialized(Response {
            egg_repository: egg_repository.0.into_admin_api_object(&state, ()).await?,
        })
        .ok()
    }
}

mod delete {
    use crate::routes::api::admin::egg_repositories::_egg_repository_::GetEggRepository;
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
            "egg_repository" = uuid::Uuid,
            description = "The egg repository ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        egg_repository: GetEggRepository,
        activity_logger: GetAdminActivityLogger,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("egg-repositories.delete")?;

        egg_repository.delete(&state, ()).await?;

        activity_logger
            .log(
                "egg-repository:delete",
                serde_json::json!({
                    "uuid": egg_repository.uuid,
                    "name": egg_repository.name,
                    "git_repository": egg_repository.git_repository,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod patch {
    use crate::routes::api::admin::egg_repositories::_egg_repository_::GetEggRepository;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            UpdatableModel, admin_activity::GetAdminActivityLogger,
            egg_repository::UpdateEggRepositoryOptions, user::GetPermissionManager,
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
            "egg_repository" = uuid::Uuid,
            description = "The egg repository ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(UpdateEggRepositoryOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        mut egg_repository: GetEggRepository,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<UpdateEggRepositoryOptions>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("egg-repositories.update")?;

        match egg_repository.update(&state, data).await {
            Ok(_) => {}
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error(
                    "egg repository with name/git repository already exists",
                )
                .with_status(StatusCode::CONFLICT)
                .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        }

        activity_logger
            .log(
                "egg_repository:update",
                serde_json::json!({
                    "uuid": egg_repository.uuid,
                    "name": egg_repository.name,
                    "description": egg_repository.description,
                    "git_repository": egg_repository.git_repository,
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
        .nest("/eggs", eggs::router(state))
        .nest("/sync", sync::router(state))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
