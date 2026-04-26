use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use axum::http::StatusCode;
    use compact_str::ToCompactString;
    use serde::Serialize;
    use shared::{
        GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        is_building: bool,
        pending_extensions: Vec<shared::extensions::PendingExtension>,
        removed_extensions: Vec<shared::extensions::PendingExtension>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route(state: GetState, permissions: GetPermissionManager) -> ApiResponseResult {
        if !state.container_type.is_heavy() {
            return ApiResponse::error(
                "extension management is only available in the official heavy container",
            )
            .with_status(StatusCode::NOT_IMPLEMENTED)
            .ok();
        }

        permissions.has_admin_permission("extensions.manage")?;

        let local_extensions = shared::heavy::list_extensions().await?;
        let applied_extensions = state.extensions.extensions().await;

        let mut pending_extensions = Vec::new();
        let mut removed_extensions = Vec::new();

        for local in &local_extensions {
            let applied = applied_extensions
                .iter()
                .find(|a| a.metadata_toml.package_name == local.metadata_toml.package_name);

            match applied {
                Some(a) if a.version == local.cargo_toml.package.version => continue,
                Some(a) => {
                    removed_extensions.push(shared::extensions::PendingExtension {
                        package_name: a.metadata_toml.package_name.to_compact_string(),
                        metadata_toml: a.metadata_toml.clone(),
                        description: a.description.into(),
                        authors: a.authors.iter().copied().map(Into::into).collect(),
                        version: a.version.clone(),
                    });
                }
                None => {}
            }

            pending_extensions.push(shared::extensions::PendingExtension {
                package_name: local.metadata_toml.package_name.to_compact_string(),
                metadata_toml: local.metadata_toml.clone(),
                description: local.cargo_toml.package.description.clone().into(),
                authors: local
                    .cargo_toml
                    .package
                    .authors
                    .iter()
                    .cloned()
                    .map(Into::into)
                    .collect(),
                version: local.cargo_toml.package.version.clone(),
            });
        }

        for applied in applied_extensions.iter() {
            if !local_extensions
                .iter()
                .any(|l| l.metadata_toml.package_name == applied.metadata_toml.package_name)
            {
                removed_extensions.push(shared::extensions::PendingExtension {
                    package_name: applied.metadata_toml.package_name.to_compact_string(),
                    metadata_toml: applied.metadata_toml.clone(),
                    description: applied.description.into(),
                    authors: applied.authors.iter().copied().map(Into::into).collect(),
                    version: applied.version.clone(),
                });
            }
        }

        ApiResponse::new_serialized(Response {
            is_building: shared::heavy::is_locked().await,
            pending_extensions,
            removed_extensions,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
