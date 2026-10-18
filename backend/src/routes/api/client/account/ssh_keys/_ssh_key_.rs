use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod delete {
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel,
            node::Node,
            user::{GetPermissionManager, GetUser},
            user_activity::GetUserActivityLogger,
            user_ssh_key::UserSshKey,
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
            "ssh_key" = uuid::Uuid,
            description = "The SSH key ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        activity_logger: GetUserActivityLogger,
        Path(ssh_key): Path<uuid::Uuid>,
    ) -> ApiResponseResult {
        permissions.has_user_permission("ssh-keys.delete")?;

        let ssh_key = match UserSshKey::by_user_uuid_uuid(&state.database, user.uuid, ssh_key)
            .await?
        {
            Some(ssh_key) => ssh_key,
            None => {
                return ApiResponse::new_serialized(ApiError::new_value(&["ssh key not found"]))
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        };

        ssh_key.delete(&state, ()).await?;
        Node::deauthorize_users_everywhere(&state.database, vec![user.uuid]);

        activity_logger
            .log(
                "ssh-key:delete",
                serde_json::json!({
                    "uuid": ssh_key.uuid,
                    "fingerprint": ssh_key.fingerprint,
                    "name": ssh_key.name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod patch {
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            UpdatableModel,
            user::{GetPermissionManager, GetUser},
            user_activity::GetUserActivityLogger,
            user_ssh_key::{UpdateUserSshKeyOptions, UserSshKey},
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
        (status = CONFLICT, body = ApiError),
    ), params(
        (
            "ssh_key" = uuid::Uuid,
            description = "The SSH key ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(UpdateUserSshKeyOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        activity_logger: GetUserActivityLogger,
        Path(ssh_key): Path<uuid::Uuid>,
        shared::Payload(data): shared::Payload<UpdateUserSshKeyOptions>,
    ) -> ApiResponseResult {
        permissions.has_user_permission("ssh-keys.update")?;

        let mut ssh_key =
            match UserSshKey::by_user_uuid_uuid(&state.database, user.uuid, ssh_key).await? {
                Some(ssh_key) => ssh_key,
                None => {
                    return ApiResponse::error("ssh key not found")
                        .with_status(StatusCode::NOT_FOUND)
                        .ok();
                }
            };

        match ssh_key.update(&state, data).await {
            Ok(_) => {}
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("ssh key with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        }

        activity_logger
            .log(
                "ssh-key:update",
                serde_json::json!({
                    "uuid": ssh_key.uuid,
                    "fingerprint": ssh_key.fingerprint,
                    "name": ssh_key.name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(delete::route))
        .routes(routes!(patch::route))
        .with_state(state.clone())
}
