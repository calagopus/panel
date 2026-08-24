use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod patch {
    use axum::{extract::Path, http::StatusCode};
    use serde::{Deserialize, Serialize};
    use shared::{
        GetState,
        models::{admin_activity::GetAdminActivityLogger, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        enabled: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        pending_restart: bool,
    }

    #[utoipa::path(patch, path = "/", responses(
        (status = OK, body = inline(Response)),
    ), params(
        (
            "extension" = String, Path,
            description = "The package name of the extension",
            example = "com.example.myextension",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        Path(package_name): Path<String>,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("extensions.manage")?;

        if !state
            .extensions
            .extensions()
            .await
            .iter()
            .any(|extension| extension.metadata_toml.package_name == package_name)
        {
            return ApiResponse::error("extension not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        }

        let settings = state.settings.get().await?;
        let mut disabled_extensions = settings.disabled_extensions.clone();
        drop(settings);

        if data.enabled {
            disabled_extensions.retain(|entry| entry != package_name.as_str());
        } else if !disabled_extensions
            .iter()
            .any(|entry| entry == package_name.as_str())
        {
            disabled_extensions.push(package_name.as_str().into());
        }

        state
            .settings
            .set_disabled_extensions(&disabled_extensions)
            .await?;

        activity_logger
            .log(
                "extension:toggle",
                serde_json::json!({
                    "package_name": package_name,
                    "enabled": data.enabled,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            pending_restart: state.extensions.is_disabled(&package_name) == data.enabled,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(patch::route))
        .with_state(state.clone())
}
