use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::admin::nests::_nest_::{GetNest, eggs::_egg_::GetNestEgg};
    use axum::{extract::Path, http::StatusCode};
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            DuplicableModel, IntoAdminApiObject,
            admin_activity::GetAdminActivityLogger,
            nest_egg_variable::{DuplicateNestEggVariableOptions, NestEggVariable},
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
        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        env_variable: compact_str::CompactString,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        variable: shared::models::nest_egg_variable::AdminApiNestEggVariable,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), params(
        (
            "nest" = uuid::Uuid,
            description = "The nest ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "egg" = uuid::Uuid,
            description = "The egg ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "variable" = uuid::Uuid,
            description = "The variable ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        nest: GetNest,
        egg: GetNestEgg,
        activity_logger: GetAdminActivityLogger,
        Path((_nest, _egg, variable)): Path<(uuid::Uuid, uuid::Uuid, uuid::Uuid)>,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("eggs.update")?;

        let egg_variable =
            match NestEggVariable::by_egg_uuid_uuid(&state.database, egg.uuid, variable).await? {
                Some(variable) => variable,
                None => {
                    return ApiResponse::error("variable not found")
                        .with_status(StatusCode::NOT_FOUND)
                        .ok();
                }
            };

        let options = DuplicateNestEggVariableOptions {
            egg_uuid: egg.uuid,
            name: data.name,
            env_variable: data.env_variable,
        };
        let duplicated = match DuplicableModel::duplicate(&egg_variable, &state, options).await {
            Ok(variable) => variable,
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("variable with name or env variable already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        };

        activity_logger
            .log(
                "nest:egg.variable.duplicate",
                serde_json::json!({
                    "uuid": duplicated.uuid,
                    "nest_uuid": nest.uuid,
                    "egg_uuid": egg.uuid,
                    "source_uuid": egg_variable.uuid,
                    "source_name": egg_variable.name,

                    "name": duplicated.name,
                    "env_variable": duplicated.env_variable,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            variable: duplicated.into_admin_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
