use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod patch {
    use crate::routes::api::client::servers::_server_::schedules::_schedule_::GetServerSchedule;
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            UpdatableModel,
            server::{GetServer, GetServerActivityLogger},
            server_schedule_step::{ServerScheduleStep, UpdateServerScheduleStepOptions},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(patch, path = "/", responses(
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
        (
            "step" = uuid::Uuid,
            description = "The schedule step ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(UpdateServerScheduleStepOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        activity_logger: GetServerActivityLogger,
        schedule: GetServerSchedule,
        Path((_server, _schedule, schedule_step)): Path<(String, uuid::Uuid, uuid::Uuid)>,
        shared::Payload(data): shared::Payload<UpdateServerScheduleStepOptions>,
    ) -> ApiResponseResult {
        let mut schedule_step = match ServerScheduleStep::by_schedule_uuid_uuid(
            &state.database,
            schedule.uuid,
            schedule_step,
        )
        .await?
        {
            Some(step) => step,
            None => {
                return ApiResponse::error("schedule step not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        };

        permissions.has_server_permission("schedules.update")?;

        schedule_step.update(&state, data).await?;

        activity_logger
            .log(
                "server:schedule.step.update",
                serde_json::json!({
                    "uuid": schedule_step.uuid,
                    "schedule_uuid": schedule.uuid,

                    "action": schedule_step.action,
                    "order": schedule_step.order,
                }),
            )
            .await;

        server.0.batch_sync(&state.database).await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod delete {
    use crate::routes::api::client::servers::_server_::schedules::_schedule_::GetServerSchedule;
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel,
            server::{GetServer, GetServerActivityLogger},
            server_schedule_step::ServerScheduleStep,
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
        (
            "step" = uuid::Uuid,
            description = "The schedule step ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        activity_logger: GetServerActivityLogger,
        schedule: GetServerSchedule,
        Path((_server, _schedule, schedule_step)): Path<(String, uuid::Uuid, uuid::Uuid)>,
    ) -> ApiResponseResult {
        let schedule_step = match ServerScheduleStep::by_schedule_uuid_uuid(
            &state.database,
            schedule.uuid,
            schedule_step,
        )
        .await?
        {
            Some(step) => step,
            None => {
                return ApiResponse::error("schedule step not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        };

        permissions.has_server_permission("schedules.update")?;

        schedule_step.delete(&state, ()).await?;

        activity_logger
            .log(
                "server:schedule.step.delete",
                serde_json::json!({
                    "uuid": schedule_step.uuid,
                    "schedule_uuid": schedule.uuid,

                    "action": schedule_step.action,
                    "order": schedule_step.order,
                }),
            )
            .await;

        server.0.batch_sync(&state.database).await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(patch::route))
        .routes(routes!(delete::route))
        .with_state(state.clone())
}
