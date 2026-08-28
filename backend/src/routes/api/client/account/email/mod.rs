use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod resend_verification;

mod put {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            UpdatableModel,
            user::{GetPermissionManager, GetUser, User},
            user_activity::GetUserActivityLogger,
            user_email_verification::UserEmailVerification,
            user_password_reset::UserPasswordReset,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(email)]
        #[schema(format = "email")]
        email: compact_str::CompactString,
        #[garde(length(max = 512))]
        #[schema(max_length = 512)]
        password: compact_str::CompactString,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        pending: bool,
    }

    #[utoipa::path(put, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = FORBIDDEN, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        mut user: GetUser,
        activity_logger: GetUserActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_user_permission("account.email")?;

        if user.frozen {
            return ApiResponse::error("account is frozen")
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

        if user.email != data.email {
            let settings = state.settings.get().await?;
            let require_verification = user.require_email_verification(&settings);
            drop(settings);

            if require_verification {
                if User::by_email(&state.database, &data.email)
                    .await?
                    .is_some()
                {
                    return ApiResponse::error("email already in use")
                        .with_status(StatusCode::CONFLICT)
                        .ok();
                }

                if !state
                    .mail
                    .template_deliverable(&state, "email_verification")
                    .await?
                {
                    return ApiResponse::error("email verification is not available")
                        .with_status(StatusCode::BAD_REQUEST)
                        .ok();
                }

                let token =
                    match UserEmailVerification::create(&state.database, user.uuid, &data.email)
                        .await
                    {
                        Ok(token) => token,
                        Err(err) => {
                            tracing::warn!(
                                user = %user.uuid,
                                "failed to create email verification: {:#?}",
                                err
                            );

                            return ApiResponse::error(
                                "a verification email was already sent recently",
                            )
                            .with_status(StatusCode::TOO_MANY_REQUESTS)
                            .ok();
                        }
                    };

                if let Err(err) =
                    UserEmailVerification::send(&state, &user, &data.email, &token).await
                {
                    tracing::error!(
                        user = %user.uuid,
                        "failed to send email verification: {:#?}",
                        err
                    );

                    return ApiResponse::error("failed to send the verification email")
                        .with_status(StatusCode::INTERNAL_SERVER_ERROR)
                        .ok();
                }

                activity_logger
                    .log(
                        "account:email-change-requested",
                        serde_json::json!({
                            "new": data.email,
                        }),
                    )
                    .await;

                return ApiResponse::new_serialized(Response { pending: true }).ok();
            }

            let old_email = user.email.clone();

            match user
                .update(
                    &state,
                    shared::models::user::UpdateUserOptions {
                        email: Some(data.email.clone()),
                        ..Default::default()
                    },
                )
                .await
            {
                Ok(_) => {}
                Err(err) if err.is_unique_violation() => {
                    return ApiResponse::error("email already in use")
                        .with_status(StatusCode::CONFLICT)
                        .ok();
                }
                Err(err) => {
                    tracing::error!("failed to update user email: {:?}", err);

                    return ApiResponse::error("failed to update user email")
                        .with_status(StatusCode::INTERNAL_SERVER_ERROR)
                        .ok();
                }
            }

            UserEmailVerification::delete_by_user_uuid(&state.database, user.uuid).await?;
            UserPasswordReset::delete_by_user_uuid(&state.database, user.uuid).await?;

            activity_logger
                .log(
                    "account:email-changed",
                    serde_json::json!({
                        "old": old_email,
                        "new": user.email,
                    }),
                )
                .await;
        }

        ApiResponse::new_serialized(Response { pending: false }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(put::route))
        .nest("/resend-verification", resend_verification::router(state))
        .with_state(state.clone())
}
