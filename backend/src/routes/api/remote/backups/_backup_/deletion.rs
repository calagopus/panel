use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::remote::backups::_backup_::GetBackup;
    use axum::http::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        successful: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "backup" = uuid::Uuid,
            description = "The backup ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        backup: GetBackup,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if backup.deleted.is_some() {
            return ApiResponse::new_serialized(Response {}).ok();
        }

        if backup.deleting.is_none() {
            return ApiResponse::error("backup is not being deleted")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        if data.successful {
            backup.finish_deletion(&state, &Default::default()).await?;
        } else {
            backup.fail_deletion_attempt(&state).await?;
        }

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
