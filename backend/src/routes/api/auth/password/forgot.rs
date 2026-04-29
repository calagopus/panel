use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::{HeaderMap, StatusCode};
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel, user::User, user_activity::UserActivity,
            user_password_reset::UserPasswordReset,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(email, length(max = 255))]
        #[schema(format = "email", max_length = 255)]
        email: String,

        #[garde(skip)]
        captcha: Option<String>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        ip: shared::GetIp,
        headers: HeaderMap,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let ratelimit = state
            .settings
            .get_as(|s| s.ratelimits.auth_password_forgot)
            .await?;
        state
            .cache
            .ratelimit(
                "auth/password/forgot",
                ratelimit.hits,
                ratelimit.window_seconds,
                ip.to_string(),
            )
            .await?;
        state
            .cache
            .ratelimit(
                "auth/password/forgot:email",
                ratelimit.hits,
                ratelimit.window_seconds,
                &data.email,
            )
            .await?;

        if let Err(error) = state.captcha.verify(ip, data.captcha).await {
            return ApiResponse::error(&error)
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let user = match User::by_email(&state.database, &data.email).await? {
            Some(user) => user,
            None => return ApiResponse::new_serialized(Response {}).ok(),
        };

        tokio::spawn(async move {
            let token = match UserPasswordReset::create(&state.database, user.uuid).await {
                Ok(token) => token,
                Err(err) => {
                    tracing::warn!(
                        user = %user.uuid,
                        "failed to create password reset token: {:#?}",
                        err
                    );
                    return;
                }
            };

            let settings = match state.settings.get().await {
                Ok(settings) => settings,
                Err(err) => {
                    tracing::warn!(
                        user = %user.uuid,
                        "failed to get settings for password reset email: {:#?}",
                        err
                    );
                    return;
                }
            };

            if let Err(err) = UserActivity::create(
                &state,
                shared::models::user_activity::CreateUserActivityOptions {
                    user_uuid: user.uuid,
                    impersonator_uuid: None,
                    api_key_uuid: None,
                    event: "email:password-reset".into(),
                    ip: Some(ip.0.into()),
                    data: serde_json::json!({
                        "user_agent": headers
                            .get("User-Agent")
                            .map(|ua| shared::utils::slice_up_to(ua.to_str().unwrap_or("unknown"), 255))
                            .unwrap_or("unknown"),
                    }),
                    created: None,
                },
            )
            .await
            {
                tracing::warn!(
                    user = %user.uuid,
                    "failed to log user activity: {:#?}",
                    err
                );
            }

            let template = match state.mail.templates.get_template("password_reset") {
                Ok(template) => template,
                Err(err) => {
                    tracing::warn!(
                        user = %user.uuid,
                        "failed to get email template for password reset email: {:#?}",
                        err
                    );
                    return;
                }
            };
            let content = match template.get_content(&state).await {
                Ok(content) => content,
                Err(err) => {
                    tracing::warn!(
                        user = %user.uuid,
                        "failed to get email content for password reset email: {:#?}",
                        err
                    );
                    return;
                }
            };

            state
                .mail
                .send(
                    user.email.clone(),
                    format!("{} - Password Reset", settings.app.name).into(),
                    content,
                    minijinja::context! {
                        user => user,
                        reset_link => format!(
                            "{}/auth/reset-password?token={}",
                            settings.app.url,
                            urlencoding::encode(&token),
                        )
                    },
                )
                .await;
        });

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
