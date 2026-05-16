use super::State;
use axum::{
    extract::{Path, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{
    GetState,
    models::{ByUuid, announcement::Announcement, user::GetPermissionManager},
    response::ApiResponse,
};
use utoipa_axum::{router::OpenApiRouter, routes};

pub type GetAnnouncement = shared::extract::ConsumingExtension<Announcement>;

pub async fn auth(
    state: GetState,
    permissions: GetPermissionManager,
    Path(announcement): Path<Vec<String>>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let announcement_uuid = match announcement.first().map(|s| s.parse::<uuid::Uuid>()) {
        Some(Ok(id)) => id,
        _ => {
            return Ok(ApiResponse::error("invalid announcement uuid")
                .with_status(StatusCode::BAD_REQUEST)
                .into_response());
        }
    };

    if let Err(err) = permissions.has_admin_permission("announcements.read") {
        return Ok(err.into_response());
    }

    let announcement = Announcement::by_uuid_optional(&state.database, announcement_uuid).await;
    let announcement = match announcement {
        Ok(Some(announcement)) => announcement,
        Ok(None) => {
            return Ok(ApiResponse::error("announcement not found")
                .with_status(StatusCode::NOT_FOUND)
                .into_response());
        }
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    req.extensions_mut().insert(announcement);

    Ok(next.run(req).await)
}

mod get {
    use crate::routes::api::admin::announcements::_announcement_::GetAnnouncement;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{IntoAdminApiObject, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        announcement: shared::models::announcement::AdminApiAnnouncement,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "announcement" = uuid::Uuid,
            description = "The announcement ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        announcement: GetAnnouncement,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("announcements.read")?;

        ApiResponse::new_serialized(Response {
            announcement: announcement.0.into_admin_api_object(&state, ()).await?,
        })
        .ok()
    }
}

mod delete {
    use crate::routes::api::admin::announcements::_announcement_::GetAnnouncement;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel, admin_activity::GetAdminActivityLogger, user::GetPermissionManager,
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
            "announcement" = uuid::Uuid,
            description = "The announcement ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        announcement: GetAnnouncement,
        activity_logger: GetAdminActivityLogger,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("announcements.delete")?;

        activity_logger
            .log(
                "announcement:delete",
                serde_json::json!({
                    "uuid": announcement.uuid,
                    "title": announcement.title,
                }),
            )
            .await;

        announcement.delete(&state, ()).await?;

        for key in state.cache.list("announcements::").await? {
            state.cache.invalidate(&key).await?;
        }

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod patch {
    use crate::routes::api::admin::announcements::_announcement_::GetAnnouncement;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            UpdatableModel, admin_activity::GetAdminActivityLogger,
            announcement::UpdateAnnouncementOptions, user::GetPermissionManager,
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
    ), params(
        (
            "announcement" = uuid::Uuid,
            description = "The announcement ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(UpdateAnnouncementOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        mut announcement: GetAnnouncement,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<UpdateAnnouncementOptions>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("announcements.update")?;

        announcement.update(&state, data).await?;

        for key in state.cache.list("announcements::").await? {
            state.cache.invalidate(&key).await?;
        }

        activity_logger
            .log(
                "announcement:update",
                serde_json::json!({
                    "uuid": announcement.uuid,

                    "type": announcement.r#type,
                    "enabled": announcement.enabled,
                    "enabled_start": announcement.enabled_start,
                    "enabled_end": announcement.enabled_end,

                    "title": announcement.title,
                    "title_translations": announcement.title_translations,
                    "content": announcement.content,
                    "content_translations": announcement.content_translations,

                    "locations": announcement.locations,
                    "nodes": announcement.nodes,
                    "backup_configurations": announcement.backup_configurations,
                    "eggs": announcement.eggs,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(delete::route))
        .routes(routes!(patch::route))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
