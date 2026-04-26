use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod put {
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
        #[garde(skip)]
        enabled: bool,

        #[garde(range(min = 1, max = 3600))]
        #[schema(minimum = 1, maximum = 3600)]
        seconds: Option<u64>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(put, path = "/", responses(
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
        mut server: GetServer,
        activity_logger: GetServerActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("settings.auto-kill")?;

        server.auto_kill.enabled = data.enabled;
        if let Some(seconds) = data.seconds {
            server.auto_kill.seconds = seconds;
        }

        sqlx::query!(
            "UPDATE servers
            SET auto_kill = $1
            WHERE servers.uuid = $2",
            serde_json::to_value(&server.auto_kill)?,
            server.uuid
        )
        .execute(state.database.write())
        .await?;

        activity_logger
            .log(
                "server:settings.auto-kill",
                serde_json::json!({
                    "enabled": server.auto_kill.enabled,
                    "seconds": server.auto_kill.seconds,
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
