use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::client::servers::_server_::schedules::_schedule_::GetServerSchedule;
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DuplicableModel, IntoApiObject,
            server::{GetServer, GetServerActivityLogger},
            server_schedule_step::{DuplicateServerScheduleStepOptions, ServerScheduleStep},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        schedule_step: shared::models::server_schedule_step::ApiServerScheduleStep,
    }

    #[utoipa::path(post, path = "/", responses(
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

        let steps_lock = state
            .cache
            .lock(
                format!(
                    "servers::{}::schedules::{}::steps",
                    server.uuid, schedule.uuid
                ),
                Some(30),
                Some(5),
            )
            .await?;

        let schedule_steps =
            ServerScheduleStep::count_by_schedule_uuid(&state.database, schedule.uuid).await?;
        if schedule_steps >= state.settings.get().await?.server.max_schedule_step_count as i64 {
            return ApiResponse::error("maximum number of schedule steps reached")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let duplicated = DuplicableModel::duplicate(
            &schedule_step,
            &state,
            DuplicateServerScheduleStepOptions {
                schedule_uuid: schedule.uuid,
            },
        )
        .await?;

        drop(steps_lock);

        activity_logger
            .log(
                "server:schedule.step.duplicate",
                serde_json::json!({
                    "uuid": duplicated.uuid,
                    "source_uuid": schedule_step.uuid,
                    "schedule_uuid": schedule.uuid,

                    "action": duplicated.action,
                    "order": duplicated.order,
                }),
            )
            .await;

        server.0.batch_sync(&state.database).await;

        ApiResponse::new_serialized(Response {
            schedule_step: duplicated.into_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
