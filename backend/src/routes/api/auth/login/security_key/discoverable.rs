use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;
    use webauthn_rs::prelude::RequestChallengeResponse;

    #[derive(ToSchema, Serialize)]
    struct Response {
        uuid: uuid::Uuid,
        #[schema(value_type = serde_json::Value)]
        options: RequestChallengeResponse,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
    ))]
    pub async fn route(state: GetState, ip: shared::GetIp) -> ApiResponseResult {
        let settings = state.settings.get().await?;
        if !settings.webauthn.enabled {
            return ApiResponse::error("security keys are disabled")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }
        if !settings.webauthn.allow_discoverable {
            return ApiResponse::error("usernameless security key login is disabled")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }
        let ratelimit = settings.ratelimits.auth_login_security_key;
        drop(settings);

        state
            .cache
            .ratelimit(
                "auth/login/security-key:discoverable-challenge",
                ratelimit.hits,
                ratelimit.window_seconds,
                ip.to_string(),
            )
            .await?;

        let webauthn = state.settings.get_webauthn().await?;

        let (mut options, authentication) = webauthn.start_discoverable_authentication()?;

        options.mediation = None;

        let uuid = uuid::Uuid::new_v4();

        state
            .cache
            .set(
                &format!("security_key_discoverable_authentication::{uuid}"),
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
            ByUuid, CreatableModel, user::User, user_activity::UserActivity,
            user_session::UserSession,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;
    use webauthn_rs::prelude::{DiscoverableAuthentication, PublicKeyCredential};

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
        (status = NOT_FOUND, body = ApiError),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        ip: shared::GetIp,
        request_host: shared::GetRequestHost,
        headers: axum::http::HeaderMap,
        cookies: tower_cookies::Cookies,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        let settings = state.settings.get().await?;
        if !settings.webauthn.enabled {
            return ApiResponse::error("security keys are disabled")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }
        if !settings.webauthn.allow_discoverable {
            return ApiResponse::error("usernameless security key login is disabled")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }
        let ratelimit = settings.ratelimits.auth_login_security_key;
        drop(settings);

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

        let authentication: DiscoverableAuthentication = match state
            .cache
            .get(&format!(
                "security_key_discoverable_authentication::{}",
                data.uuid
            ))
            .await
        {
            Ok(Some(authentication)) => {
                state
                    .cache
                    .invalidate(&format!(
                        "security_key_discoverable_authentication::{}",
                        data.uuid
                    ))
                    .await?;

                authentication
            }
            _ => {
                return ApiResponse::error("invalid or expired challenge")
                    .with_status(StatusCode::BAD_REQUEST)
                    .ok();
            }
        };

        let (user_uuid, cred_id) =
            match webauthn.identify_discoverable_authentication(&data.public_key_credential) {
                Ok(identified) => identified,
                Err(err) => {
                    tracing::error!(
                        "failed to identify discoverable security key authentication: {:?}",
                        err
                    );

                    return ApiResponse::error("failed to finish security key authentication")
                        .with_status(StatusCode::BAD_REQUEST)
                        .ok();
                }
            };

        let raw_passkeys = sqlx::query!(
            "SELECT user_security_keys.uuid, user_security_keys.passkey
            FROM user_security_keys
            WHERE user_security_keys.user_uuid = $1 AND user_security_keys.passkey IS NOT NULL",
            user_uuid
        )
        .fetch_all(state.database.read())
        .await?;

        let matched = raw_passkeys.into_iter().find_map(|raw_passkey| {
            let passkey =
                serde_json::from_value::<webauthn_rs::prelude::Passkey>(raw_passkey.passkey?)
                    .ok()?;

            (passkey.cred_id().as_slice() == cred_id).then_some((raw_passkey.uuid, passkey))
        });

        let (security_key_uuid, mut passkey) = match matched {
            Some(matched) => matched,
            None => {
                return ApiResponse::error("failed to finish security key authentication")
                    .with_status(StatusCode::BAD_REQUEST)
                    .ok();
            }
        };

        let result = match webauthn.finish_discoverable_authentication_v2(
            &data.public_key_credential,
            authentication,
            &passkey,
        ) {
            Ok(result) => result,
            Err(err) => {
                tracing::error!(
                    "failed to finish discoverable security key authentication: {:?}",
                    err
                );

                return ApiResponse::error("failed to finish security key authentication")
                    .with_status(StatusCode::BAD_REQUEST)
                    .ok();
            }
        };

        passkey.update_credential(&result);

        let user = match User::by_uuid_optional(&state.database, user_uuid).await? {
            Some(user) => user,
            None => {
                return ApiResponse::error("user not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        };

        sqlx::query!(
            "UPDATE user_security_keys
            SET passkey = $2, last_used = NOW()
            WHERE user_security_keys.uuid = $1",
            security_key_uuid,
            serde_json::to_value(passkey)?
        )
        .execute(state.database.write())
        .await?;

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

        cookies.add(UserSession::get_cookie(&state, request_host.as_deref(), key).await?);

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
                    "uuid": security_key_uuid,

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
            user: user
                .into_api_full_object(&state, &state.storage.retrieve_urls().await?)
                .await?,
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
