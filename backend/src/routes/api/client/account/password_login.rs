use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod put {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            user::{GetPermissionManager, GetUser},
            user_activity::GetUserActivityLogger,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(skip)]
        disabled: bool,
        #[garde(length(max = 512))]
        #[schema(max_length = 512)]
        password: compact_str::CompactString,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(put, path = "/", responses(
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

        permissions.has_user_permission("account.password-login")?;

        if user.frozen {
            return ApiResponse::error("account is frozen")
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        if data.disabled {
            let webauthn_enabled = state.settings.get_as(|s| s.webauthn.enabled).await?;

            if !(user.has_security_key && webauthn_enabled) {
                return ApiResponse::error(
                    "a security key is required before password login can be disabled",
                )
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
            }
        }

        if !user
            .validate_password(&state.database, &data.password)
            .await?
        {
            return ApiResponse::error("invalid password")
                .with_status(StatusCode::FORBIDDEN)
                .ok();
        }

        sqlx::query!(
            "UPDATE users
            SET password_login_disabled = $1
            WHERE users.uuid = $2",
            data.disabled,
            user.uuid
        )
        .execute(state.database.write())
        .await?;

        activity_logger
            .log(
                "account:password-login.update",
                serde_json::json!({
                    "disabled": data.disabled,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(put::route))
        .with_state(state.clone())
}
