use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::admin::announcements::_announcement_::GetAnnouncement;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DuplicableModel, IntoAdminApiObject, admin_activity::GetAdminActivityLogger,
            announcement::DuplicateAnnouncementOptions, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        announcement: shared::models::announcement::AdminApiAnnouncement,
    }

    #[utoipa::path(post, path = "/", responses(
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
        permissions.has_admin_permission("announcements.create")?;

        let duplicated = match DuplicableModel::duplicate(
            &announcement.0,
            &state,
            DuplicateAnnouncementOptions {},
        )
        .await
        {
            Ok(announcement) => announcement,
            Err(err) => return ApiResponse::from(err).ok(),
        };

        activity_logger
            .log(
                "announcement:duplicate",
                serde_json::json!({
                    "source_uuid": announcement.uuid,
                    "uuid": duplicated.uuid,
                    "title": duplicated.title,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            announcement: duplicated.into_admin_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
