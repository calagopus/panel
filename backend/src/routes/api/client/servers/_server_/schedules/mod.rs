use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _schedule_;
mod import;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoApiObject, Pagination, PaginationParamsWithSearch, server::GetServer,
            server_schedule::ServerSchedule, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        schedules: Pagination<shared::models::server_schedule::ApiServerSchedule>,
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
            "page" = i64, Query,
            description = "The page number",
            example = "1",
        ),
        (
            "per_page" = i64, Query,
            description = "The number of items per page",
            example = "10",
        ),
        (
            "search" = Option<String>, Query,
            description = "Search term for items",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        Query(params): Query<PaginationParamsWithSearch>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("schedules.read")?;

        let schedules = ServerSchedule::by_server_uuid_with_pagination(
            &state.database,
            server.uuid,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        ApiResponse::new_serialized(Response {
            schedules: schedules
                .try_async_map(|schedule| schedule.into_api_object(&state, ()))
                .await?,
        })
        .ok()
    }
}

mod post {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel, IntoApiObject,
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
        #[garde(skip)]
        enabled: bool,
        #[garde(dive)]
        triggers: Vec<wings_api::ScheduleTrigger>,
        #[garde(dive)]
        condition: wings_api::SchedulePreCondition,
    }

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
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        activity_logger: GetServerActivityLogger,
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

        drop(schedules_lock);

        activity_logger
            .log(
                "server:schedule.create",
                serde_json::json!({
                    "uuid": schedule.uuid,
                    "name": schedule.name,
                    "enabled": schedule.enabled,
                    "triggers": schedule.triggers,
                    "condition": schedule.condition,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            schedule: schedule.into_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/{schedule}", _schedule_::router(state))
        .nest("/import", import::router(state))
        .with_state(state.clone())
}
