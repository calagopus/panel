use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _variable_;
mod order;

mod get {
    use crate::routes::api::admin::nests::_nest_::eggs::_egg_::GetNestEgg;
    use serde::Serialize;
    use shared::{
        GetState,
        models::{
            IntoAdminApiObject, nest_egg_variable::NestEggVariable, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        variables: Vec<shared::models::nest_egg_variable::AdminApiNestEggVariable>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
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
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        egg: GetNestEgg,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("eggs.read")?;

        let variables = NestEggVariable::all_by_egg_uuid(&state.database, egg.uuid).await?;

        ApiResponse::new_serialized(Response {
            variables: futures_util::future::try_join_all(
                variables
                    .into_iter()
                    .map(|variable| variable.into_admin_api_object(&state, ())),
            )
            .await?,
        })
        .ok()
    }
}

mod post {
    use std::collections::BTreeMap;

    use crate::routes::api::admin::nests::_nest_::{GetNest, eggs::_egg_::GetNestEgg};
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel, IntoAdminApiObject,
            admin_activity::GetAdminActivityLogger,
            nest_egg_variable::{CreateNestEggVariableOptions, NestEggVariable},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(chars, min = 3, max = 255))]
        #[schema(min_length = 3, max_length = 255)]
        name: compact_str::CompactString,
        #[garde(length(max = 1024))]
        #[schema(max_length = 1024)]
        description: Option<compact_str::CompactString>,
        #[garde(custom(shared::models::nest_egg_variable::validate_description_translations))]
        pub description_translations:
            BTreeMap<compact_str::CompactString, compact_str::CompactString>,
        #[garde(skip)]
        order: i16,

        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        env_variable: compact_str::CompactString,
        #[garde(length(max = 1024))]
        #[schema(max_length = 1024)]
        default_value: Option<String>,

        #[garde(skip)]
        user_viewable: bool,
        #[garde(skip)]
        user_editable: bool,
        #[garde(skip)]
        secret: bool,
        #[garde(custom(rule_validator::validate_rules))]
        rules: Vec<compact_str::CompactString>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        variable: shared::models::nest_egg_variable::AdminApiNestEggVariable,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
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
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        nest: GetNest,
        egg: GetNestEgg,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("eggs.update")?;

        let egg_variable = match NestEggVariable::create(
            &state,
            CreateNestEggVariableOptions {
                egg_uuid: egg.uuid,
                name: data.name,
                description: data.description,
                description_translations: data.description_translations,
                order: data.order,
                env_variable: data.env_variable,
                default_value: data.default_value,
                user_viewable: data.user_viewable,
                user_editable: data.user_editable,
                secret: data.secret,
                rules: data.rules,
            },
        )
        .await
        {
            Ok(variable) => variable,
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("variable with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        };

        activity_logger
            .log(
                "nest:egg.variable.create",
                serde_json::json!({
                    "uuid": egg_variable.uuid,
                    "nest_uuid": nest.uuid,
                    "egg_uuid": egg.uuid,

                    "name": egg_variable.name,
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

        ApiResponse::new_serialized(Response {
            variable: egg_variable.into_admin_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/{variable}", _variable_::router(state))
        .nest("/order", order::router(state))
        .with_state(state.clone())
}
