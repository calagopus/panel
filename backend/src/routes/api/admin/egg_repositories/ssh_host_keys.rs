use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            egg_repository::{EggRepository, SshHostKey},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(chars, min = 1, max = 2048))]
        #[schema(example = "ssh://git@github.com/example/repo.git")]
        git_repository: compact_str::CompactString,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        ssh_host_keys: Vec<SshHostKey>,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        if permissions
            .has_admin_permission("egg-repositories.create")
            .is_err()
        {
            permissions.has_admin_permission("egg-repositories.update")?;
        }

        let ssh_host_keys =
            EggRepository::fetch_ssh_host_keys(&state, &data.git_repository).await?;

        ApiResponse::new_serialized(Response { ssh_host_keys }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
