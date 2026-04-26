use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel, IntoApiObject,
            server::{GetServer, GetServerActivityLogger},
            server_schedule::{ExportedServerSchedule, ServerSchedule},
            server_schedule_step::ServerScheduleStep,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        schedule: shared::models::server_schedule::ApiServerSchedule,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = UNAUTHORIZED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = ExportedServerSchedule)]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        activity_logger: GetServerActivityLogger,
        shared::Payload(data): shared::Payload<ExportedServerSchedule>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("schedules.create")?;

        let schedules_lock = state
            .cache
            .lock(
                format!("servers::{}::schedules", server.uuid),
                Some(30),
                Some(5),
            )
            .await?;

        let schedules = ServerSchedule::count_by_server_uuid(&state.database, server.uuid).await;
        if schedules >= server.schedule_limit as i64 {
            return ApiResponse::error("maximum number of schedules reached")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let options = shared::models::server_schedule::CreateServerScheduleOptions {
            server_uuid: server.uuid,
            name: data.name,
            enabled: data.enabled,
            triggers: data.triggers,
            condition: data.condition,
        };
        let schedule = match ServerSchedule::create(&state, options).await {
            Ok(schedule) => schedule,
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("schedule with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        };

        let settings = state.settings.get().await?;

        for schedule_step in data
            .steps
            .iter()
            .take(settings.server.max_schedules_step_count as usize)
        {
            let options = shared::models::server_schedule_step::CreateServerScheduleStepOptions {
                schedule_uuid: schedule.uuid,
                action: schedule_step.action.clone(),
                order: schedule_step.order,
            };
            ServerScheduleStep::create(&state, options).await?;
        }

        drop(settings);
        drop(schedules_lock);

        activity_logger
            .log(
                "server:schedule.import",
                serde_json::json!({
                    "uuid": schedule.uuid,
                    "name": schedule.name,
                    "enabled": schedule.enabled,
                    "triggers": schedule.triggers,
                    "condition": schedule.condition,
                    "steps": data.steps,
                }),
            )
            .await;

        server.0.batch_sync(&state.database).await;

        ApiResponse::new_serialized(Response {
            schedule: schedule.into_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
