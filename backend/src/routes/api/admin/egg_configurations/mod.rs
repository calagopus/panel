use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _egg_configuration_;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoAdminApiObject, Pagination, PaginationParamsWithSearch,
            egg_configuration::EggConfiguration, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        egg_configurations: Pagination<shared::models::egg_configuration::AdminApiEggConfiguration>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ), params(
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
        Query(params): Query<PaginationParamsWithSearch>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("egg-configurations.read")?;

        let egg_configurations = EggConfiguration::all_with_pagination(
            &state.database,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        ApiResponse::new_serialized(Response {
            egg_configurations: egg_configurations
                .try_async_map(|egg_configuration| {
                    egg_configuration.into_admin_api_object(&state, ())
                })
                .await?,
        })
        .ok()
    }
}

mod post {
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel, IntoAdminApiObject,
            admin_activity::GetAdminActivityLogger,
            egg_configuration::{CreateEggConfigurationOptions, EggConfiguration},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        egg_configuration: shared::models::egg_configuration::AdminApiEggConfiguration,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), request_body = inline(CreateEggConfigurationOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<CreateEggConfigurationOptions>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("egg-configurations.create")?;

        let egg_configuration = match EggConfiguration::create(&state, data).await {
            Ok(egg_configuration) => egg_configuration,
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error(
                    "egg configuration with name/source/location already exists",
                )
                .with_status(StatusCode::CONFLICT)
                .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        };

        activity_logger
            .log(
                "egg-configuration:create",
                serde_json::json!({
                    "uuid": egg_configuration.uuid,
                    "name": egg_configuration.name,
                    "description": egg_configuration.description,
                    "order": egg_configuration.order,

                    "eggs": egg_configuration.eggs,

                    "config_allocations": egg_configuration.config_allocations,
                    "config_routes": egg_configuration.config_routes,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            egg_configuration: egg_configuration.into_admin_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/{egg_configuration}", _egg_configuration_::router(state))
        .with_state(state.clone())
}
