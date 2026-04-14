use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use axum::extract::Query;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;
    use webauthn_rs::prelude::{Passkey, RequestChallengeResponse};

    #[derive(ToSchema, Deserialize)]
    pub struct Params {
        user: String,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        uuid: uuid::Uuid,
        #[schema(value_type = serde_json::Value)]
        options: RequestChallengeResponse,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
    ), params(
        (
            "user" = String, Query,
            description = "The user to get a security key challenge for",
            example = "/",
        ),
    ))]
    pub async fn route(state: GetState, Query(data): Query<Params>) -> ApiResponseResult {
        let webauthn = state.settings.get_webauthn().await?;

        let raw_passkeys = sqlx::query!(
            "SELECT user_security_keys.passkey
            FROM user_security_keys
            JOIN users ON users.uuid = user_security_keys.user_uuid
            WHERE user_security_keys.passkey IS NOT NULL AND (lower(users.email) = lower($1) OR lower(users.username) = lower($1))",
            data.user
        )
        .fetch_all(state.database.read())
        .await?;

        let mut passkeys = Vec::new();
        passkeys.reserve_exact(raw_passkeys.len());

        for raw_passkey in raw_passkeys {
            if let Some(passkey) = raw_passkey.passkey
                && let Ok(passkey) = serde_json::from_value::<Passkey>(passkey)
            {
                passkeys.push(passkey);
            }
        }

        let (options, authentication) = webauthn.start_passkey_authentication(&passkeys)?;
        let uuid = uuid::Uuid::new_v4();

        state
            .cache
            .set(
                &format!("security_key_authentication::{uuid}"),
                options.public_key.timeout.unwrap_or(300000) as u64 / 1000,
                &authentication,
            )
            .await?;

        ApiResponse::new_serialized(Response { uuid, options }).ok()
    }
}

mod post {
    use axum::http::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel, user::User, user_activity::UserActivity, user_session::UserSession,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use tower_cookies::{Cookie, Cookies};
    use utoipa::ToSchema;
    use webauthn_rs::prelude::{PasskeyAuthentication, PublicKeyCredential};

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        uuid: uuid::Uuid,
        #[schema(value_type = serde_json::Value)]
        public_key_credential: PublicKeyCredential,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        user: shared::models::user::ApiFullUser,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        ip: shared::GetIp,
        headers: axum::http::HeaderMap,
        cookies: Cookies,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        let ratelimit = state
            .settings
            .get_as(|s| s.ratelimits.auth_login_security_key)
            .await?;
        state
            .cache
            .ratelimit(
                "auth/login/security-key",
                ratelimit.hits,
                ratelimit.window_seconds,
                ip.to_string(),
            )
            .await?;

        let webauthn = state.settings.get_webauthn().await?;

        let authentication: PasskeyAuthentication = match state
            .cache
            .get(&format!("security_key_authentication::{}", data.uuid))
            .await
        {
            Ok(Some(authentication)) => {
                state
                    .cache
                    .invalidate(&format!("security_key_authentication::{}", data.uuid))
                    .await?;

                authentication
            }
            _ => {
                return ApiResponse::error("invalid or expired challenge")
                    .with_status(StatusCode::BAD_REQUEST)
                    .ok();
            }
        };

        let passkey = match webauthn
            .finish_passkey_authentication(&data.public_key_credential, &authentication)
        {
            Ok(passkey) => passkey,
            Err(err) => {
                tracing::error!("failed to finish security key authentication: {:?}", err);

                return ApiResponse::error(format!(
                    "failed to finish security key authentication: {}",
                    err
                ))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
            }
        };

        let (user, security_key) =
            match User::by_credential_id(&state.database, passkey.cred_id()).await? {
                Some(user) => user,
                None => {
                    return ApiResponse::error("user not found")
                        .with_status(StatusCode::NOT_FOUND)
                        .ok();
                }
            };

        if let Some(mut db_passkey) = security_key.passkey {
            db_passkey.update_credential(&passkey);

            sqlx::query!(
                "UPDATE user_security_keys
                SET passkey = $2, last_used = NOW()
                WHERE user_security_keys.uuid = $1",
                security_key.uuid,
                serde_json::to_value(db_passkey)?
            )
            .execute(state.database.write())
            .await?;
        }

        let key = UserSession::create(
            &state,
            shared::models::user_session::CreateUserSessionOptions {
                user_uuid: user.uuid,
                ip: ip.0.into(),
                user_agent: headers
                    .get("User-Agent")
                    .map(|ua| shared::utils::slice_up_to(ua.to_str().unwrap_or("unknown"), 255))
                    .unwrap_or("unknown")
                    .into(),
            },
        )
        .await?;

        let settings = state.settings.get().await?;

        cookies.add(
            Cookie::build(("session", key))
                .http_only(true)
                .same_site(tower_cookies::cookie::SameSite::Strict)
                .secure(settings.app.url.starts_with("https://"))
                .path("/")
                .expires(
                    tower_cookies::cookie::time::OffsetDateTime::now_utc()
                        + tower_cookies::cookie::time::Duration::days(30),
                )
                .build(),
        );

        drop(settings);

        if let Err(err) = UserActivity::create(
            &state,
            shared::models::user_activity::CreateUserActivityOptions {
                user_uuid: user.uuid,
                impersonator_uuid: None,
                api_key_uuid: None,
                event: "auth:success".into(),
                ip: Some(ip.0.into()),
                data: serde_json::json!({
                    "using": "security-key",
                    "uuid": security_key.uuid,

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

        ApiResponse::new_serialized(Response {
            user: user.into_api_full_object(&state.storage.retrieve_urls().await?),
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .with_state(state.clone())
}
