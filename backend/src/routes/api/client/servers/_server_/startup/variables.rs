use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoApiObject, server::GetServer, server_variable::ServerVariable,
            user::GetPermissionManager,
        },
        prelude::AsyncIteratorExt,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        variables: Vec<shared::models::server_variable::ApiServerVariable>,
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
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
    ) -> ApiResponseResult {
        permissions.has_server_permission("startup.read")?;

        let variables = ServerVariable::all_by_server_uuid_egg_uuid(
            &state.database,
            server.uuid,
            server.egg.uuid,
        )
        .await?;

        ApiResponse::new_serialized(Response {
            variables: variables
                .into_iter()
                .filter(|variable| variable.variable.user_viewable)
                .map(|variable| variable.into_api_object(&state, ()))
                .try_collect_async_vec()
                .await?,
        })
        .ok()
    }
}

mod put {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            server::{GetServer, GetServerActivityLogger},
            server_variable::ServerVariable,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use std::collections::HashMap;
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Serialize, Deserialize)]
    pub struct PayloadVariable {
        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        env_variable: String,
        #[garde(length(max = 4096))]
        #[schema(max_length = 4096)]
        value: String,
    }

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(dive)]
        #[schema(inline)]
        variables: Vec<PayloadVariable>,
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
        server: GetServer,
        activity_logger: GetServerActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("startup.update")?;

        let variables = ServerVariable::all_by_server_uuid_egg_uuid(
            &state.database,
            server.uuid,
            server.egg.uuid,
        )
        .await?;

        let mut validator_variables = HashMap::new();
        validator_variables.reserve(variables.len());

        for variable in variables.iter() {
            validator_variables.insert(
                variable.variable.env_variable.as_str(),
                (
                    variable.variable.rules.as_slice(),
                    if let Some(value) = data
                        .variables
                        .iter()
                        .find(|v| v.env_variable == variable.variable.env_variable)
                        && variable.variable.user_editable
                    {
                        value.value.as_str()
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

        for data_variable in &data.variables {
            let variable_uuid = match variables
                .iter()
                .find(|v| v.variable.env_variable == data_variable.env_variable)
            {
                Some(variable) if variable.variable.user_editable => variable.variable.uuid,
                _ => continue,
            };

            ServerVariable::create(
                &state.database,
                server.uuid,
                variable_uuid,
                &data_variable.value,
            )
            .await?;
        }

        activity_logger
            .log(
                "server:startup.variables",
                serde_json::json!({
                    "variables": data.variables
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(put::route))
        .with_state(state.clone())
}
