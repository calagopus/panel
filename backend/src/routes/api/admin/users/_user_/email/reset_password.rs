use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::admin::users::_user_::GetParamUser;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        GetState,
        models::{
            CreatableModel, admin_activity::GetAdminActivityLogger, user::GetPermissionManager,
            user_activity::UserActivity, user_password_reset::UserPasswordReset,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = ACCEPTED, body = inline(Response)),
    ), params(
        (
            "user" = uuid::Uuid,
            description = "The user ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetParamUser,
        activity_logger: GetAdminActivityLogger,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("users.email")?;

        let user_uuid = user.uuid;

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
                    ip: None,
                    data: serde_json::json!({}),
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
                        user => **user,
                        reset_link => format!(
                            "{}/auth/reset-password?token={}",
                            settings.app.url,
                            urlencoding::encode(&token),
                        )
                    },
                )
                .await;
        });

        activity_logger
            .log(
                "user:email.password-reset",
                serde_json::json!({
                    "uuid": user_uuid
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {})
            .with_status(StatusCode::ACCEPTED)
            .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
