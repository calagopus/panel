use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod duplicate;

mod delete {
    use crate::routes::api::admin::nests::_nest_::{GetNest, eggs::_egg_::GetNestEgg};
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel, admin_activity::GetAdminActivityLogger,
            nest_egg_variable::NestEggVariable, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
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
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        nest: GetNest,
        egg: GetNestEgg,
        activity_logger: GetAdminActivityLogger,
        Path((_nest, _egg, variable)): Path<(uuid::Uuid, uuid::Uuid, uuid::Uuid)>,
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

        egg_variable.delete(&state, ()).await?;

        activity_logger
            .log(
                "nest:egg.variable.delete",
                serde_json::json!({
                    "uuid": variable,
                    "nest_uuid": nest.uuid,
                    "egg_uuid": egg.uuid,

                    "name": egg_variable.name,
                    "env_variable": egg_variable.env_variable,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod patch {
    use crate::routes::api::admin::nests::_nest_::{GetNest, eggs::_egg_::GetNestEgg};
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            UpdatableModel,
            admin_activity::GetAdminActivityLogger,
            nest_egg_variable::{NestEggVariable, UpdateNestEggVariableOptions},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(patch, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
        (status = BAD_REQUEST, body = ApiError),
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
    ), request_body = inline(UpdateNestEggVariableOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        nest: GetNest,
        egg: GetNestEgg,
        activity_logger: GetAdminActivityLogger,
        Path((_nest, _egg, variable)): Path<(uuid::Uuid, uuid::Uuid, uuid::Uuid)>,
        shared::Payload(data): shared::Payload<UpdateNestEggVariableOptions>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("eggs.update")?;

        let mut egg_variable =
            match NestEggVariable::by_egg_uuid_uuid(&state.database, egg.uuid, variable).await? {
                Some(variable) => variable,
                None => {
                    return ApiResponse::error("variable not found")
                        .with_status(StatusCode::NOT_FOUND)
                        .ok();
                }
            };

        match egg_variable.update(&state, data).await {
            Ok(_) => {}
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("variable with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        }

        activity_logger
            .log(
                "nest:egg.variable.update",
                serde_json::json!({
                    "uuid": egg_variable.uuid,
                    "nest_uuid": nest.uuid,
                    "egg_uuid": egg.uuid,

                    "name": egg_variable.name,
                    "name_translations": egg_variable.name_translations,
                    "description": egg_variable.description,
                    "description_translations": egg_variable.description_translations,
                    "order": egg_variable.order,

                    "env_variable": egg_variable.env_variable,
                    "default_value": egg_variable.default_value,

                    "user_viewable": egg_variable.user_viewable,
                    "user_editable": egg_variable.user_editable,
                    "secret": egg_variable.secret,
                    "rules": egg_variable.rules,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(delete::route))
        .routes(routes!(patch::route))
        .nest("/duplicate", duplicate::router(state))
        .with_state(state.clone())
}
