use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _backup_configuration_;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoAdminApiObject, Pagination, PaginationParamsWithSearch,
            backup_configuration::BackupConfiguration, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        backup_configurations:
            Pagination<shared::models::backup_configuration::AdminApiBackupConfiguration>,
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

        permissions.has_admin_permission("backup-configurations.read")?;

        let backup_configurations = BackupConfiguration::all_with_pagination(
            &state.database,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        ApiResponse::new_serialized(Response {
            backup_configurations: backup_configurations
                .try_async_map(|backup_configuration| {
                    backup_configuration.into_admin_api_object(&state, ())
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
            backup_configuration::{BackupConfiguration, CreateBackupConfigurationOptions},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        backup_configuration: shared::models::backup_configuration::AdminApiBackupConfiguration,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), request_body = inline(CreateBackupConfigurationOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<CreateBackupConfigurationOptions>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("backup-configurations.create")?;

        let backup_configuration = match BackupConfiguration::create(&state, data).await {
            Ok(backup_configuration) => backup_configuration,
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("backup configuration with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        };

        activity_logger
            .log(
                "backup-configuration:create",
                serde_json::json!({
                    "uuid": backup_configuration.uuid,
                    "name": backup_configuration.name,
                    "description": backup_configuration.description,

                    "maintenance_enabled": backup_configuration.maintenance_enabled,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            backup_configuration: backup_configuration
                .into_admin_api_object(&state, ())
                .await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest(
            "/{backup_configuration}",
            _backup_configuration_::router(state),
        )
        .with_state(state.clone())
}
