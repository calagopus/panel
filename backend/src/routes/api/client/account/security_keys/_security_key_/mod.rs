use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod challenge;

mod delete {
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel,
            user::{GetPermissionManager, GetUser},
            user_activity::GetUserActivityLogger,
            user_security_key::UserSecurityKey,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), params(
        (
            "security_key" = uuid::Uuid,
            description = "The Security key ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        activity_logger: GetUserActivityLogger,
        Path(security_key): Path<uuid::Uuid>,
    ) -> ApiResponseResult {
        permissions.has_user_permission("security-keys.delete")?;

        let security_key =
            match UserSecurityKey::by_user_uuid_uuid(&state.database, user.uuid, security_key)
                .await?
            {
                Some(security_key) => security_key,
                None => {
                    return ApiResponse::new_serialized(ApiError::new_value(&[
                        "security key not found",
                    ]))
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
                }
            };

        let mut transaction = state.database.write().begin().await?;

        if user.password_login_disabled
            && security_key.passkey.is_some()
            && UserSecurityKey::count_usable_by_user_uuid_for_update(&mut transaction, user.uuid)
                .await?
                <= 1
        {
            return ApiResponse::error(
                "re-enable password login before removing your last security key",
            )
            .with_status(StatusCode::CONFLICT)
            .ok();
        }

        security_key
            .delete_with_transaction(&state, (), &mut transaction)
            .await?;
        transaction.commit().await?;

        if security_key.registration.is_none() {
            activity_logger
                .log(
                    "security-key:delete",
                    serde_json::json!({
                        "uuid": security_key.uuid,
                        "name": security_key.name,
                    }),
                )
                .await;
        }

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
            user_security_key::{UpdateUserSecurityKeyOptions, UserSecurityKey},
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
            "security_key" = uuid::Uuid,
            description = "The Security key ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(UpdateUserSecurityKeyOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        activity_logger: GetUserActivityLogger,
        Path(security_key): Path<uuid::Uuid>,
        shared::Payload(data): shared::Payload<UpdateUserSecurityKeyOptions>,
    ) -> ApiResponseResult {
        permissions.has_user_permission("security-keys.update")?;

        let mut security_key =
            match UserSecurityKey::by_user_uuid_uuid(&state.database, user.uuid, security_key)
                .await?
            {
                Some(security_key) => security_key,
                None => {
                    return ApiResponse::error("security key not found")
                        .with_status(StatusCode::NOT_FOUND)
                        .ok();
                }
            };

        if security_key.registration.is_some() {
            return ApiResponse::error("security key not setup yet")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        match security_key.update(&state, data).await {
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
                "user:security-key.update",
                serde_json::json!({
                    "uuid": security_key.uuid,
                    "name": security_key.name,
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
        .nest("/challenge", challenge::router(state))
        .with_state(state.clone())
}
