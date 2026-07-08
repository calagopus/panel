use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::user::{GetPermissionManager, GetUser},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        otp_url: String,
        secret: String,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = CONFLICT, body = ApiError),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
    ) -> ApiResponseResult {
        permissions.has_user_permission("account.two-factor")?;

        if user.totp_enabled {
            return ApiResponse::error("two-factor authentication is already enabled")
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        if user.frozen {
            return ApiResponse::error("account is frozen")
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        let secret = match totp_rs::Secret::generate_secret().to_encoded() {
            totp_rs::Secret::Encoded(secret) => secret,
            _ => unreachable!(),
        };

        sqlx::query!(
            "UPDATE users
            SET totp_secret = $1
            WHERE users.uuid = $2",
            secret,
            user.uuid
        )
        .execute(state.database.write())
        .await?;

        let settings = state.settings.get().await?;

        ApiResponse::new_serialized(Response {
            otp_url: format!(
                "otpauth://totp/{name}:{}?secret={}&issuer={name}",
                urlencoding::encode(&user.email),
                urlencoding::encode(&secret),
                name = urlencoding::encode(&settings.app.name)
            ),
            secret,
        })
        .ok()
    }
}

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
        #[garde(length(equal = 6))]
        #[schema(min_length = 6, max_length = 6)]
        code: String,
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
        (status = UNAUTHORIZED, body = ApiError),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        activity_logger: GetUserActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_user_permission("account.two-factor")?;

        if user.totp_enabled {
            return ApiResponse::error("two-factor authentication is already enabled")
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        if user.frozen {
            return ApiResponse::error("account is frozen")
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        let totp_secret = match &user.totp_secret {
            Some(secret) => secret,
            None => {
                return ApiResponse::error("two-factor authentication has not been configured")
                    .with_status(StatusCode::UNAUTHORIZED)
                    .ok();
            }
        };

        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
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

        let totp = totp_rs::TOTP::new(
            totp_rs::Algorithm::SHA1,
            6,
            1,
            30,
            totp_rs::Secret::Encoded(totp_secret.clone()).to_bytes()?,
        )?;

        if !totp.check_current(&data.code).is_ok_and(|valid| valid) {
            return ApiResponse::error("invalid confirmation code")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let recovery_codes = UserRecoveryCode::create_all(&state.database, user.uuid).await?;

        sqlx::query!(
            "UPDATE users
            SET totp_enabled = true, totp_last_used = NULL
            WHERE users.uuid = $1",
            user.uuid
        )
        .execute(state.database.write())
        .await?;

        activity_logger
            .log("account:two-factor.enable", serde_json::json!({}))
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
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(chars, min = 6, max = 10))]
        #[schema(min_length = 6, max_length = 10)]
        code: String,
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
        (status = UNAUTHORIZED, body = ApiError),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        mut user: GetUser,
        activity_logger: GetUserActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_user_permission("account.two-factor")?;

        if !user.totp_enabled {
            return ApiResponse::error("two-factor authentication is not enabled")
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
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

        match data.code.len() {
            6 => {
                let totp = totp_rs::TOTP::new(
                    totp_rs::Algorithm::SHA1,
                    6,
                    1,
                    30,
                    totp_rs::Secret::Encoded(user.0.totp_secret.take().unwrap()).to_bytes()?,
                )?;

                if !totp.check_current(&data.code).is_ok_and(|valid| valid) {
                    return ApiResponse::error("invalid confirmation code")
                        .with_status(StatusCode::BAD_REQUEST)
                        .ok();
                }
            }
            10 => {
                if UserRecoveryCode::delete_by_user_uuid_code(
                    &state.database,
                    user.uuid,
                    &data.code,
                )
                .await?
                .is_none()
                {
                    return ApiResponse::error("invalid recovery code")
                        .with_status(StatusCode::BAD_REQUEST)
                        .ok();
                }
            }
            _ => {
                return ApiResponse::error("invalid confirmation code length")
                    .with_status(StatusCode::BAD_REQUEST)
                    .ok();
            }
        }

        UserRecoveryCode::delete_by_user_uuid(&state.database, user.uuid).await?;

        sqlx::query!(
            "UPDATE users
            SET totp_enabled = false, totp_last_used = NULL, totp_secret = NULL
            WHERE users.uuid = $1",
            user.uuid
        )
        .execute(state.database.write())
        .await?;

        activity_logger
            .log("account:two-factor.disable", serde_json::json!({}))
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .routes(routes!(delete::route))
        .with_state(state.clone())
}
