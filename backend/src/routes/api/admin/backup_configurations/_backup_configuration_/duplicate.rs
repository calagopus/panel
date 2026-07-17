use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::admin::backup_configurations::_backup_configuration_::GetBackupConfiguration;
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            DuplicableModel, IntoAdminApiObject, admin_activity::GetAdminActivityLogger,
            backup_configuration::DuplicateBackupConfigurationOptions, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        name: compact_str::CompactString,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        backup_configuration: shared::models::backup_configuration::AdminApiBackupConfiguration,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), params(
        (
            "backup_configuration" = uuid::Uuid,
            description = "The backup configuration ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        backup_configuration: GetBackupConfiguration,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("backup-configurations.create")?;

        let options = DuplicateBackupConfigurationOptions { name: data.name };
        let duplicated =
            match DuplicableModel::duplicate(&backup_configuration.0, &state, options).await {
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
                "backup-configuration:duplicate",
                serde_json::json!({
                    "source_uuid": backup_configuration.uuid,
                    "source_name": backup_configuration.name,
                    "uuid": duplicated.uuid,
                    "name": duplicated.name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            backup_configuration: duplicated.into_admin_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
