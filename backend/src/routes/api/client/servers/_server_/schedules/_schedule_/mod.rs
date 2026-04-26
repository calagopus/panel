use super::State;
use axum::{
    extract::{Path, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{
    GetState,
    models::{server::GetServer, server_schedule::ServerSchedule, user::GetPermissionManager},
    response::ApiResponse,
};
use utoipa_axum::{router::OpenApiRouter, routes};

mod abort;
mod export;
mod status;
mod steps;
mod trigger;

pub type GetServerSchedule = shared::extract::ConsumingExtension<ServerSchedule>;

pub async fn auth(
    state: GetState,
    permissions: GetPermissionManager,
    server: GetServer,
    Path(schedule): Path<Vec<String>>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let schedule = match schedule.get(1).map(|s| s.parse::<uuid::Uuid>()) {
        Some(Ok(id)) => id,
        _ => {
            return Ok(ApiResponse::error("invalid schedule uuid")
                .with_status(StatusCode::BAD_REQUEST)
                .into_response());
        }
    };

    if let Err(err) = permissions.has_server_permission("schedules.read") {
        return Ok(err.into_response());
    }

    let schedule =
        ServerSchedule::by_server_uuid_uuid(&state.database, server.uuid, schedule).await;
    let schedule = match schedule {
        Ok(Some(schedule)) => schedule,
        Ok(None) => {
            return Ok(ApiResponse::error("schedule not found")
                .with_status(StatusCode::NOT_FOUND)
                .into_response());
        }
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    req.extensions_mut().insert(server.0);
    req.extensions_mut().insert(schedule);

    Ok(next.run(req).await)
}

mod get {
    use crate::routes::api::client::servers::_server_::schedules::_schedule_::GetServerSchedule;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{IntoApiObject, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    pub struct Response {
        schedule: shared::models::server_schedule::ApiServerSchedule,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "schedule" = uuid::Uuid,
            description = "The schedule ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        schedule: GetServerSchedule,
    ) -> ApiResponseResult {
        permissions.has_server_permission("schedules.read")?;

        ApiResponse::new_serialized(Response {
            schedule: schedule.0.into_api_object(&state, ()).await?,
        })
        .ok()
    }
}

mod delete {
    use crate::routes::api::client::servers::_server_::schedules::_schedule_::GetServerSchedule;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel,
            server::{GetServer, GetServerActivityLogger},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "schedule" = uuid::Uuid,
            description = "The schedule ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        activity_logger: GetServerActivityLogger,
        schedule: GetServerSchedule,
    ) -> ApiResponseResult {
        permissions.has_server_permission("schedules.delete")?;

        schedule.delete(&state, ()).await?;

        activity_logger
            .log(
                "server:schedule.delete",
                serde_json::json!({
                    "uuid": schedule.uuid,
                    "name": schedule.name,
                }),
            )
            .await;

        server.0.batch_sync(&state.database).await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod patch {
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            UpdatableModel,
            server::{GetServer, GetServerActivityLogger},
            server_schedule::UpdateServerScheduleOptions,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    use crate::routes::api::client::servers::_server_::schedules::_schedule_::GetServerSchedule;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(patch, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = BAD_REQUEST, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "schedule" = uuid::Uuid,
            description = "The schedule ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(UpdateServerScheduleOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        activity_logger: GetServerActivityLogger,
        mut schedule: GetServerSchedule,
        shared::Payload(data): shared::Payload<UpdateServerScheduleOptions>,
    ) -> ApiResponseResult {
        permissions.has_server_permission("schedules.update")?;

        schedule.update(&state, data).await?;

        activity_logger
            .log(
                "server:schedule.update",
                serde_json::json!({
                    "uuid": schedule.uuid,
                    "name": schedule.name,
                    "enabled": schedule.enabled,
                    "triggers": schedule.triggers,
                    "condition": schedule.condition,
                }),
            )
            .await;

        server.0.batch_sync(&state.database).await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(delete::route))
        .routes(routes!(patch::route))
        .nest("/steps", steps::router(state))
        .nest("/status", status::router(state))
        .nest("/export", export::router(state))
        .nest("/abort", abort::router(state))
        .nest("/trigger", trigger::router(state))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
