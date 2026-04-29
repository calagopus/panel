use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod put {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel, UpdatableModel, server::GetServer, server_activity::ServerActivity,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(skip)]
        schedule_uuid: Option<uuid::Uuid>,

        #[garde(length(chars, min = 1, max = 1024))]
        #[schema(min_length = 1, max_length = 1024)]
        command: compact_str::CompactString,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(put, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = UNAUTHORIZED, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        mut server: GetServer,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let egg_configuration = server.egg.configuration(&state.database).await?;

        let is_predefined = server
            .egg
            .startup_commands
            .iter()
            .any(|(_, command)| command == data.command);
        let custom_allowed = egg_configuration
            .config_startup
            .as_ref()
            .is_some_and(|config| config.allow_custom_startup_command);

        if !is_predefined && !custom_allowed {
            return ApiResponse::error("custom startup commands are not enabled for this server")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        server
            .update(
                &state,
                shared::models::server::UpdateServerOptions {
                    startup: Some(data.command),
                    ..Default::default()
                },
            )
            .await?;

        if let Err(err) = ServerActivity::create(
            &state,
            shared::models::server_activity::CreateServerActivityOptions {
                server_uuid: server.uuid,
                user_uuid: None,
                impersonator_uuid: None,
                api_key_uuid: None,
                schedule_uuid: data.schedule_uuid,
                event: "server:startup.command".into(),
                ip: None,
                data: serde_json::json!({
                    "command": server.startup,
                }),
                created: None,
            },
        )
        .await
        {
            tracing::warn!(
                server = %server.uuid,
                "failed to log remote activity for server: {:#?}",
                err
            );
        }

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(put::route))
        .with_state(state.clone())
}
