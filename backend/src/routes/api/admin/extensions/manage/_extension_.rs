use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod delete {
    use axum::{extract::Path, http::StatusCode};
    use serde::{Deserialize, Serialize};
    use shared::{
        GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        remove_migrations: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        Path(package_name): Path<String>,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if !state.container_type.is_heavy() {
            return ApiResponse::error(
                "extension management is only available in the official heavy container",
            )
            .with_status(StatusCode::NOT_IMPLEMENTED)
            .ok();
        }

        permissions.has_admin_permission("extensions.manage")?;

        let extensions = state.extensions.extensions().await;
        let Some(extension) = extensions
            .iter()
            .find(|ext| ext.package_name == package_name)
        else {
            return ApiResponse::error("extension not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        };

        let extension_identifier = extension.metadata_toml.get_package_identifier();
        if data.remove_migrations
            && let Ok(migrations) = tokio::task::spawn_blocking(move || {
                database_migrator::collect_embedded_extension_migrations(&extension_identifier)
            })
            .await?
        {
            for migration in migrations.iter().rev() {
                tracing::info!(package_name, "running down migration: {}", migration.name);
                if let Err(err) = database_migrator::rollback_extension_migration(
                    state.database.write(),
                    migration,
                )
                .await
                {
                    tracing::error!(package_name, "failed to run down migration: {:?}", err);
                    return ApiResponse::error("failed to run down migrations for this extension")
                        .with_status(StatusCode::INTERNAL_SERVER_ERROR)
                        .ok();
                }
            }
        }

        if let Err(err) = shared::heavy::remove_extension(&package_name).await {
            tracing::error!(package_name, "failed to remove extension: {:?}", err);

            return ApiResponse::error("failed to remove extension")
                .with_status(StatusCode::INTERNAL_SERVER_ERROR)
                .ok();
        }

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(delete::route))
        .with_state(state.clone())
}
