use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod put {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel, server::GetServer, server_activity::ServerActivity,
            server_variable::ServerVariable,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use std::collections::HashMap;
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(skip)]
        schedule_uuid: Option<uuid::Uuid>,

        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        env_variable: String,
        #[garde(length(max = 4096))]
        #[schema(max_length = 4096)]
        value: String,
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
        server: GetServer,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let variables = ServerVariable::all_by_server_uuid_egg_uuid(
            &state.database,
            server.uuid,
            server.egg.uuid,
        )
        .await?;

        let variable_uuid = if let Some(variable) = variables
            .iter()
            .find(|variable| variable.variable.env_variable == data.env_variable)
        {
            if !variable.variable.user_editable {
                return ApiResponse::error("variable is not editable")
                    .with_status(StatusCode::BAD_REQUEST)
                    .ok();
            }

            variable.variable.uuid
        } else {
            return ApiResponse::error("variable not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        };

        let mut validator_variables = HashMap::new();
        validator_variables.reserve(variables.len());

        for variable in variables.iter() {
            validator_variables.insert(
                variable.variable.env_variable.as_str(),
                (
                    variable.variable.rules.as_slice(),
                    if variable.variable.env_variable == data.env_variable {
                        data.value.as_str()
                    } else {
                        variable.value.as_str()
                    },
                ),
            );
        }

        let validator = match rule_validator::Validator::new(validator_variables) {
            Ok(validator) => validator,
            Err(error) => {
                return ApiResponse::error(&error)
                    .with_status(StatusCode::BAD_REQUEST)
                    .ok();
            }
        };

        if let Err(error) = validator.validate() {
            return ApiResponse::error(&error)
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        if validator.is_excluded(&data.env_variable) {
            return ApiResponse::error("variable is excluded")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        ServerVariable::create(&state.database, server.uuid, variable_uuid, &data.value).await?;

        if let Err(err) = ServerActivity::create(
            &state,
            shared::models::server_activity::CreateServerActivityOptions {
                server_uuid: server.uuid,
                user_uuid: None,
                impersonator_uuid: None,
                api_key_uuid: None,
                schedule_uuid: data.schedule_uuid,
                event: "server:startup.variables".into(),
                ip: None,
                data: serde_json::json!({
                    "variables": [
                        {
                            "env_variable": data.env_variable,
                            "value": data.value,
                        }
                    ]
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
