use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _egg_;
mod delete;
mod import;
mod r#move;
mod update;

mod get {
    use crate::routes::api::admin::nests::_nest_::GetNest;
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoAdminApiObject, Pagination, PaginationParamsWithSearch, nest_egg::NestEgg,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        eggs: Pagination<shared::models::nest_egg::AdminApiNestEgg>,
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
        nest: GetNest,
        Query(params): Query<PaginationParamsWithSearch>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("eggs.read")?;

        let eggs = NestEgg::by_nest_uuid_with_pagination(
            &state.database,
            nest.uuid,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        ApiResponse::new_serialized(Response {
            eggs: eggs
                .try_async_map(|egg| egg.into_admin_api_object(&state, ()))
                .await?,
        })
        .ok()
    }
}

mod post {
    use crate::routes::api::admin::nests::_nest_::GetNest;
    use axum::http::StatusCode;
    use garde::Validate;
    use indexmap::IndexMap;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel, IntoAdminApiObject,
            admin_activity::GetAdminActivityLogger,
            nest_egg::{CreateNestEggOptions, NestEgg},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(skip)]
        egg_repository_egg_uuid: Option<uuid::Uuid>,

        #[garde(length(chars, min = 2, max = 255))]
        #[schema(min_length = 2, max_length = 255)]
        author: compact_str::CompactString,
        #[garde(length(chars, min = 3, max = 255))]
        #[schema(min_length = 3, max_length = 255)]
        name: compact_str::CompactString,
        #[garde(length(chars, min = 1, max = 1024))]
        #[schema(min_length = 1, max_length = 1024)]
        description: Option<compact_str::CompactString>,

        #[garde(skip)]
        #[schema(inline)]
        config_files: Vec<shared::models::nest_egg::ProcessConfigurationFile>,
        #[garde(skip)]
        #[schema(inline)]
        config_startup: shared::models::nest_egg::NestEggConfigStartup,
        #[garde(skip)]
        #[schema(inline)]
        config_stop: shared::models::nest_egg::NestEggConfigStop,
        #[garde(skip)]
        #[schema(inline)]
        config_script: shared::models::nest_egg::NestEggConfigScript,

        #[garde(length(chars, min = 1, max = 4096))]
        #[schema(min_length = 1, max_length = 4096)]
        startup: compact_str::CompactString,
        #[garde(skip)]
        force_outgoing_ip: bool,
        #[garde(skip)]
        separate_port: bool,

        #[garde(skip)]
        features: Vec<compact_str::CompactString>,
        #[garde(custom(shared::models::nest_egg::validate_docker_images))]
        docker_images: IndexMap<compact_str::CompactString, compact_str::CompactString>,
        #[garde(skip)]
        file_denylist: Vec<compact_str::CompactString>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        egg: shared::models::nest_egg::AdminApiNestEgg,
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
        )
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        nest: GetNest,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("eggs.create")?;

        let options = CreateNestEggOptions {
            nest_uuid: nest.uuid,
            egg_repository_egg_uuid: data.egg_repository_egg_uuid,
            author: data.author,
            name: data.name,
            description: data.description,
            config_files: data.config_files,
            config_startup: data.config_startup,
            config_stop: data.config_stop,
            config_script: data.config_script,
            startup: data.startup,
            force_outgoing_ip: data.force_outgoing_ip,
            separate_port: data.separate_port,
            features: data.features,
            docker_images: data.docker_images,
            file_denylist: data.file_denylist,
        };

        let egg = match NestEgg::create(&state, options).await {
            Ok(egg) => egg,
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("egg with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        };

        activity_logger
            .log(
                "nest:egg.create",
                serde_json::json!({
                    "uuid": egg.uuid,
                    "nest_uuid": nest.uuid,
                    "egg_repository_egg_uuid": egg.egg_repository_egg.as_ref().map(|e| e.uuid),

                    "author": egg.author,
                    "name": egg.name,
                    "description": egg.description,

                    "config_files": egg.config_files,
                    "config_startup": egg.config_startup,
                    "config_stop": egg.config_stop,
                    "config_script": egg.config_script,

                    "startup": egg.startup,
                    "force_outgoing_ip": egg.force_outgoing_ip,
                    "separate_port": egg.separate_port,

                    "features": egg.features,
                    "docker_images": egg.docker_images,
                    "file_denylist": egg.file_denylist,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            egg: egg.into_admin_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/import", import::router(state))
        .nest("/update", update::router(state))
        .nest("/move", r#move::router(state))
        .nest("/delete", delete::router(state))
        .nest("/{egg}", _egg_::router(state))
        .with_state(state.clone())
}
