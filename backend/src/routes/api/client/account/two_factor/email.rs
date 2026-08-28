use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            user::{GetPermissionManager, GetUser},
            user_activity::GetUserActivityLogger,
            user_recovery_code::UserRecoveryCode,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(max = 512))]
        #[schema(max_length = 512)]
        password: String,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        recovery_codes: Vec<String>,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = CONFLICT, body = ApiError),
        (status = FORBIDDEN, body = ApiError),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        activity_logger: GetUserActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_user_permission("account.two-factor")?;

        if user.email_two_factor_enabled {
            return ApiResponse::error("email two-factor authentication is already enabled")
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        if user.frozen {
            return ApiResponse::error("account is frozen")
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        if !state
            .settings
            .get_as(|s| s.app.email_two_factor_enabled)
            .await?
        {
            return ApiResponse::error("email two-factor authentication is disabled")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        if !state
            .mail
            .template_deliverable(&state, "two_factor_code")
            .await?
        {
            return ApiResponse::error("email two-factor authentication is not available")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        if !user
            .validate_password(&state.database, &data.password)
            .await?
        {
            return ApiResponse::error("invalid password")
                .with_status(StatusCode::FORBIDDEN)
                .ok();
        }

        let recovery_codes =
            UserRecoveryCode::create_all_if_absent(&state.database, user.uuid).await?;

        sqlx::query!(
            "UPDATE users
            SET email_two_factor_enabled = true
            WHERE users.uuid = $1",
            user.uuid
        )
        .execute(state.database.write())
        .await?;

        activity_logger
            .log("account:two-factor.email.enable", serde_json::json!({}))
            .await;

        ApiResponse::new_serialized(Response { recovery_codes }).ok()
    }
}

mod delete {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            user::{GetPermissionManager, GetUser},
            user_activity::GetUserActivityLogger,
            user_recovery_code::UserRecoveryCode,
            user_two_factor_code::UserTwoFactorCode,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(max = 512))]
        #[schema(max_length = 512)]
        password: String,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = CONFLICT, body = ApiError),
        (status = FORBIDDEN, body = ApiError),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        activity_logger: GetUserActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_user_permission("account.two-factor")?;

        if !user.email_two_factor_enabled {
            return ApiResponse::error("email two-factor authentication is not enabled")
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        if !user
            .validate_password(&state.database, &data.password)
            .await?
        {
            return ApiResponse::error("invalid password")
                .with_status(StatusCode::FORBIDDEN)
                .ok();
        }

        if !user.totp_enabled {
            UserRecoveryCode::delete_by_user_uuid(&state.database, user.uuid).await?;
        }

        UserTwoFactorCode::delete_by_user_uuid(&state.database, user.uuid).await?;

        sqlx::query!(
            "UPDATE users
            SET email_two_factor_enabled = false
            WHERE users.uuid = $1",
            user.uuid
        )
        .execute(state.database.write())
        .await?;

        activity_logger
            .log("account:two-factor.email.disable", serde_json::json!({}))
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .routes(routes!(delete::route))
        .with_state(state.clone())
}
