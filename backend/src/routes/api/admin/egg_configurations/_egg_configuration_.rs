use super::State;
use axum::{
    extract::{Path, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{
    GetState,
    models::{ByUuid, egg_configuration::EggConfiguration, user::GetPermissionManager},
    response::ApiResponse,
};
use utoipa_axum::{router::OpenApiRouter, routes};

pub type GetEggConfiguration = shared::extract::ConsumingExtension<EggConfiguration>;

pub async fn auth(
    state: GetState,
    permissions: GetPermissionManager,
    Path(egg_configuration): Path<uuid::Uuid>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    if let Err(err) = permissions.has_admin_permission("egg-configurations.read") {
        return Ok(err.into_response());
    }

    let egg_configuration =
        EggConfiguration::by_uuid_optional(&state.database, egg_configuration).await;
    let egg_configuration = match egg_configuration {
        Ok(Some(egg_configuration)) => egg_configuration,
        Ok(None) => {
            return Ok(ApiResponse::error("egg configuration not found")
                .with_status(StatusCode::NOT_FOUND)
                .into_response());
        }
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    req.extensions_mut().insert(egg_configuration);

    Ok(next.run(req).await)
}

mod get {
    use crate::routes::api::admin::egg_configurations::_egg_configuration_::GetEggConfiguration;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{IntoAdminApiObject, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        egg_configuration: shared::models::egg_configuration::AdminApiEggConfiguration,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "egg_configuration" = uuid::Uuid,
            description = "The egg configuration ID",
            example = "1",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        egg_configuration: GetEggConfiguration,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("egg-configurations.read")?;

        ApiResponse::new_serialized(Response {
            egg_configuration: egg_configuration
                .0
                .into_admin_api_object(&state, ())
                .await?,
        })
        .ok()
    }
}

mod delete {
    use crate::routes::api::admin::egg_configurations::_egg_configuration_::GetEggConfiguration;
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
            "egg_configuration" = uuid::Uuid,
            description = "The egg configuration ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        egg_configuration: GetEggConfiguration,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("egg-configurations.delete")?;

        egg_configuration.delete(&state, ()).await?;

        activity_logger
            .log(
                "egg-configuration:delete",
                serde_json::json!({
                    "uuid": egg_configuration.uuid,
                    "name": egg_configuration.name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod patch {
    use crate::routes::api::admin::egg_configurations::_egg_configuration_::GetEggConfiguration;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            UpdatableModel, admin_activity::GetAdminActivityLogger,
            egg_configuration::UpdateEggConfigurationOptions, user::GetPermissionManager,
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
            "egg_configuration" = uuid::Uuid,
            description = "The egg configuration ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(UpdateEggConfigurationOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        mut egg_configuration: GetEggConfiguration,
        shared::Payload(data): shared::Payload<UpdateEggConfigurationOptions>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("egg-configurations.update")?;

        match egg_configuration.update(&state, data).await {
            Ok(_) => {}
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("egg configuration with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        }

        activity_logger
            .log(
                "egg-configuration:update",
                serde_json::json!({
                    "uuid": egg_configuration.uuid,
                    "name": egg_configuration.name,
                    "description": egg_configuration.description,
                    "order": egg_configuration.order,

                    "eggs": egg_configuration.eggs,

                    "config_allocations": egg_configuration.config_allocations,
                    "config_routes": egg_configuration.config_routes,
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
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
