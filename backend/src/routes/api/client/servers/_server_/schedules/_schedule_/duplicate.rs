use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::client::servers::_server_::schedules::_schedule_::GetServerSchedule;
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            DuplicableModel, IntoApiObject,
            server::{GetServer, GetServerActivityLogger},
            server_schedule::ServerSchedule,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        name: compact_str::CompactString,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        schedule: shared::models::server_schedule::ApiServerSchedule,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
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

        permissions.has_server_permission("schedules.create")?;

        let schedules_lock = state
            .cache
            .lock(
                format!("servers::{}::schedules", server.uuid),
                Some(30),
                Some(5),
            )
            .await?;

        let schedules = ServerSchedule::count_by_server_uuid(&state.database, server.uuid).await?;
        if schedules >= server.schedule_limit as i64 {
            return ApiResponse::error("maximum number of schedules reached")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let options = shared::models::server_schedule::DuplicateServerScheduleOptions {
            server_uuid: server.uuid,
            name: data.name,
        };
        let duplicated = match DuplicableModel::duplicate(&schedule.0, &state, options).await {
            Ok(duplicated) => duplicated,
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("schedule with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        };

        drop(schedules_lock);

        activity_logger
            .log(
                "server:schedule.duplicate",
                serde_json::json!({
                    "source_uuid": schedule.uuid,
                    "source_name": schedule.name,
                    "uuid": duplicated.uuid,
                    "name": duplicated.name,
                    "enabled": duplicated.enabled,
                    "triggers": duplicated.triggers,
                    "condition": duplicated.condition,
                }),
            )
            .await;

        server.0.batch_sync(&state.database).await;

        ApiResponse::new_serialized(Response {
            schedule: duplicated.into_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
