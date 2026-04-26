use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod put {
    use crate::routes::api::client::servers::_server_::schedules::_schedule_::GetServerSchedule;
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            server::{GetServer, GetServerActivityLogger},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(max = 1024))]
        #[schema(max_length = 1024)]
        schedule_step_order: Vec<uuid::Uuid>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(put, path = "/", responses(
        (status = OK, body = inline(Response)),
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

        sqlx::query!(
            "UPDATE server_schedule_steps
            SET order_ = array_position($1, server_schedule_steps.uuid)
            WHERE server_schedule_steps.uuid = ANY($1) AND server_schedule_steps.schedule_uuid = $2",
            &data.schedule_step_order,
            schedule.uuid
        )
        .execute(state.database.write())
        .await?;

        activity_logger
            .log(
                "server:schedule.step.update-order",
                serde_json::json!({
                    "schedule_uuid": schedule.uuid,
                    "schedule_step_order": data.schedule_step_order,
                }),
            )
            .await;

        server.0.batch_sync(&state.database).await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(put::route))
        .with_state(state.clone())
}
