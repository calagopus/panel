use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _step_;
mod order;

mod get {
    use crate::routes::api::client::servers::_server_::schedules::_schedule_::GetServerSchedule;
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoApiObject, PaginationParams, server_schedule_step::ServerScheduleStep,
            user::GetPermissionManager,
        },
        prelude::AsyncIteratorExt,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        schedule_steps: Vec<shared::models::server_schedule_step::ApiServerScheduleStep>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
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
        Query(params): Query<PaginationParams>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("schedules.read")?;

        let schedule_steps =
            ServerScheduleStep::all_by_schedule_uuid(&state.database, schedule.uuid).await?;

        ApiResponse::new_serialized(Response {
            schedule_steps: schedule_steps
                .into_iter()
                .map(|schedule_step| schedule_step.into_api_object(&state, ()))
                .try_collect_async_vec()
                .await?,
        })
        .ok()
    }
}

mod post {
    use crate::routes::api::client::servers::_server_::schedules::_schedule_::GetServerSchedule;
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel, IntoApiObject,
            server::{GetServer, GetServerActivityLogger},
            server_schedule_step::{CreateServerScheduleStepOptions, ServerScheduleStep},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(dive)]
        action: wings_api::ScheduleActionInner,
        #[garde(skip)]
        order: i16,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        schedule_step: shared::models::server_schedule_step::ApiServerScheduleStep,
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
        (
            "schedule" = uuid::Uuid,
            description = "The schedule ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        activity_logger: GetServerActivityLogger,
        schedule: GetServerSchedule,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("schedules.update")?;

        let schedule_steps =
            ServerScheduleStep::count_by_schedule_uuid(&state.database, schedule.uuid).await;
        let settings = state.settings.get().await?;
        if schedule_steps >= settings.server.max_schedules_step_count as i64 {
            return ApiResponse::error("maximum number of schedule steps reached")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }
        drop(settings);

        let schedule_step = match ServerScheduleStep::create(
            &state,
            CreateServerScheduleStepOptions {
                schedule_uuid: schedule.uuid,
                action: data.action,
                order: data.order,
            },
        )
        .await
        {
            Ok(schedule_step) => schedule_step,
            Err(err) => {
                tracing::error!("failed to create schedule step: {:?}", err);

                return ApiResponse::error("failed to create schedule step")
                    .with_status(StatusCode::INTERNAL_SERVER_ERROR)
                    .ok();
            }
        };

        activity_logger
            .log(
                "server:schedule.step.create",
                serde_json::json!({
                    "uuid": schedule_step.uuid,
                    "schedule_uuid": schedule.uuid,

                    "action": schedule_step.action,
                    "order": schedule_step.order,
                }),
            )
            .await;

        server.0.batch_sync(&state.database).await;

        ApiResponse::new_serialized(Response {
            schedule_step: schedule_step.into_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/order", order::router(state))
        .nest("/{step}", _step_::router(state))
        .with_state(state.clone())
}
