use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::client::servers::_server_::schedules::_schedule_::GetServerSchedule;
    use axum::http::StatusCode;
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

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        #[serde(default)]
        skip_condition: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

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
        ip: shared::GetIp,
        server: GetServer,
        activity_logger: GetServerActivityLogger,
        schedule: GetServerSchedule,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_server_permission("schedules.update")?;

        state
            .cache
            .ratelimit(
                format!("client/servers/{}/schedules/trigger", server.uuid),
                10,
                60,
                ip.to_string(),
            )
            .await?;

        let server_uuid = server.uuid;
        let node = server.node.fetch_cached(&state.database).await?;

        match server.0.sync(&state.database).await {
            Ok(_) => {}
            Err(err) => {
                tracing::error!(server = %server_uuid, "failed to post server sync: {:?}", err);

                return ApiResponse::error("failed to send sync signal to server")
                    .with_status(StatusCode::INTERNAL_SERVER_ERROR)
                    .ok();
            }
        }

        node.api_client(&state.database)
            .await?
            .post_servers_server_schedules_schedule_trigger(
                server_uuid,
                schedule.uuid,
                &wings_api::servers_server_schedules_schedule_trigger::post::RequestBody {
                    skip_condition: data.skip_condition,
                },
            )
            .await?;

        activity_logger
            .log(
                "server:schedule.trigger",
                serde_json::json!({
                    "uuid": schedule.uuid,
                    "name": schedule.name,
                    "skip_condition": data.skip_condition,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
