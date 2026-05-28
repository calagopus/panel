use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _announcement_;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoAdminApiObject, Pagination, PaginationParamsWithSearch, announcement::Announcement,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        announcements: Pagination<shared::models::announcement::AdminApiAnnouncement>,
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

        permissions.has_admin_permission("announcements.read")?;

        let announcements = Announcement::all_with_pagination(
            &state.database,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        ApiResponse::new_serialized(Response {
            announcements: announcements
                .try_async_map(|announcement| announcement.into_admin_api_object(&state, ()))
                .await?,
        })
        .ok()
    }
}

mod post {
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel, IntoAdminApiObject,
            admin_activity::GetAdminActivityLogger,
            announcement::{Announcement, CreateAnnouncementOptions},
            user::GetPermissionManager,
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
        (status = BAD_REQUEST, body = ApiError),
    ), request_body = inline(CreateAnnouncementOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<CreateAnnouncementOptions>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("announcements.create")?;

        let announcement = Announcement::create(&state, data).await?;

        for key in state.cache.list("announcements::").await? {
            state.cache.invalidate(&key).await?;
        }

        activity_logger
            .log(
                "announcement:create",
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

        ApiResponse::new_serialized(Response {
            announcement: announcement.into_admin_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/{announcement}", _announcement_::router(state))
        .with_state(state.clone())
}
