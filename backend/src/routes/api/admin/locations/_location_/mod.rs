use super::State;
use axum::{
    extract::{Path, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{
    GetState,
    models::{ByUuid, location::Location, user::GetPermissionManager},
    response::ApiResponse,
};
use utoipa_axum::{router::OpenApiRouter, routes};

mod database_hosts;
mod nodes;

pub type GetLocation = shared::extract::ConsumingExtension<Location>;

pub async fn auth(
    state: GetState,
    permissions: GetPermissionManager,
    Path(location): Path<Vec<String>>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let location = match location.first().map(|s| s.parse::<uuid::Uuid>()) {
        Some(Ok(id)) => id,
        _ => {
            return Ok(ApiResponse::error("invalid location uuid")
                .with_status(StatusCode::BAD_REQUEST)
                .into_response());
        }
    };

    if let Err(err) = permissions.has_admin_permission("locations.read") {
        return Ok(err.into_response());
    }

    let location = Location::by_uuid_optional(&state.database, location).await;
    let location = match location {
        Ok(Some(location)) => location,
        Ok(None) => {
            return Ok(ApiResponse::error("location not found")
                .with_status(StatusCode::NOT_FOUND)
                .into_response());
        }
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    req.extensions_mut().insert(location);

    Ok(next.run(req).await)
}

mod get {
    use crate::routes::api::admin::locations::_location_::GetLocation;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{IntoAdminApiObject, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        location: shared::models::location::AdminApiLocation,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "location" = uuid::Uuid,
            description = "The location ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        location: GetLocation,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("locations.read")?;

        ApiResponse::new_serialized(Response {
            location: location.0.into_admin_api_object(&state, ()).await?,
        })
        .ok()
    }
}

mod delete {
    use crate::routes::api::admin::locations::_location_::GetLocation;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel, admin_activity::GetAdminActivityLogger, node::Node,
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
            "location" = uuid::Uuid,
            description = "The location ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        location: GetLocation,
        activity_logger: GetAdminActivityLogger,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("locations.delete")?;

        if Node::count_by_location_uuid(&state.database, location.uuid).await > 0 {
            return ApiResponse::error("location has nodes, cannot delete")
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        location.delete(&state, ()).await?;

        activity_logger
            .log(
                "location:delete",
                serde_json::json!({
                    "uuid": location.uuid,
                    "name": location.name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod patch {
    use crate::routes::api::admin::locations::_location_::GetLocation;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            UpdatableModel, admin_activity::GetAdminActivityLogger,
            location::UpdateLocationOptions, user::GetPermissionManager,
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
            "location" = uuid::Uuid,
            description = "The location ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(UpdateLocationOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        mut location: GetLocation,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<UpdateLocationOptions>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("locations.update")?;

        match location.update(&state, data).await {
            Ok(_) => {}
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("location with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        }

        activity_logger
            .log(
                "location:update",
                serde_json::json!({
                    "uuid": location.uuid,
                    "name": location.name,
                    "description": location.description,
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
        .nest("/nodes", nodes::router(state))
        .nest("/database-hosts", database_hosts::router(state))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
