use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use serde::Serialize;
    use shared::{
        GetState,
        models::{IntoApiObject, announcement::Announcement},
        prelude::AsyncIteratorExt,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        announcements: Vec<shared::models::announcement::ApiAnnouncement>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route(state: GetState) -> ApiResponseResult {
        let announcements = state
            .cache
            .cached("announcements::active", 60, || async {
                Announcement::all_by_active(&state.database).await
            })
            .await?;

        ApiResponse::new_serialized(Response {
            announcements: announcements
                .into_iter()
                .map(|announcement| announcement.into_api_object(&state, ()))
                .try_collect_async_vec()
                .await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
