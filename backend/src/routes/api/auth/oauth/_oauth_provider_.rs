use crate::routes::api::auth::login::checkpoint::TwoFactorRequiredJwt;

use super::State;
use axum::{
    body::Body,
    extract::{Path, Query},
    http::StatusCode,
    routing::get,
};
use base64::Engine;
use compact_str::ToCompactString;
use oauth2::{
    AuthUrl, AuthorizationCode, ClientId, ClientSecret, HttpRequest, HttpResponse, RedirectUrl,
    TokenResponse, TokenUrl, basic::BasicClient,
};
use serde::Deserialize;
use shared::models::IntoApiObject;
use shared::{
    GetState,
    database::BASE64_ENGINE,
    jwt::BasePayload,
    models::{
        ByUuid, CreatableModel, oauth_provider::OAuthProvider, user::User,
        user_activity::UserActivity, user_oauth_link::UserOAuthLink, user_session::UserSession,
    },
    response::ApiResponse,
};
use tower_cookies::Cookies;
use utoipa_axum::router::OpenApiRouter;

#[derive(Deserialize)]
pub struct Params {
    code: String,
    state: String,
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .route("/", get(|state: GetState,
            ip: shared::GetIp,
            headers: axum::http::HeaderMap,
            cookies: Cookies,
            params: Query<Params>,
            Path(oauth_provider): Path<uuid::Uuid>| async move {
            state
                .cache
                .ratelimit(format!("auth/oauth/{}", oauth_provider), 6, 300, ip.to_string())
                .await?;

            let oauth_provider =
                match OAuthProvider::by_uuid_optional_cached(&state.database,oauth_provider).await? {
                    Some(oauth_provider) => oauth_provider,
                    None => {
                        return ApiResponse::error("oauth provider not found")
                            .with_status(StatusCode::NOT_FOUND)
                            .ok();
                    }
                };

            if !oauth_provider.enabled {
                return ApiResponse::error("oauth provider not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }

            if state
                .cache
                .get::<u16>(&format!("oauth_state::{}", params.state))
                .await
                .is_err()
            {
                return ApiResponse::error("oauth csrf state not found, please try again")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }

            state
                .cache
                .invalidate(&format!("oauth_state::{}", params.state))
                .await?;

            let settings = state.settings.get().await?;

            let client = BasicClient::new(ClientId::new(oauth_provider.client_id.to_string()))
                .set_client_secret(ClientSecret::new(
                    state
                        .database
                        .decrypt(oauth_provider.client_secret.clone())
                        .await?
                        .into(),
                ))
                .set_auth_uri(AuthUrl::new(oauth_provider.auth_url.clone())?)
                .set_token_uri(TokenUrl::new(oauth_provider.token_url.clone())?)
                .set_auth_type(if oauth_provider.basic_auth {
                    oauth2::AuthType::BasicAuth
                } else {
                    oauth2::AuthType::RequestBody
                })
                .set_redirect_uri(RedirectUrl::new(format!(
                    "{}/api/auth/oauth/{}",
                    settings.app.url.trim_end_matches('/'),
                    oauth_provider.uuid
                ))?);

            drop(settings);

            let http_client = |req: HttpRequest| {
                let client = state.client.clone();
                async move {
                    let response = client.execute(req.try_into()?).await?;
                    let response = axum::http::Response::from(response);
                    let (parts, body) = response.into_parts();

                    let data = axum::body::to_bytes(axum::body::Body::new(body), usize::MAX)
                        .await
                        .unwrap_or_default();

                    Ok::<_, reqwest::Error>(HttpResponse::from_parts(parts, data.into()))
                }
            };

            if let Some(session_id) = cookies.get("session") {
                if !oauth_provider.user_manageable {
                    return ApiResponse::error("you cannot link with this oauth provider")
                        .with_status(StatusCode::CONFLICT)
                        .ok();
                }

                if session_id.value().len() != 81 {
                    return ApiResponse::error("invalid authorization cookie")
                        .with_status(StatusCode::UNAUTHORIZED)
                        .ok();
                }

                let (user, session) =
                    match User::by_session_cached(&state.database, session_id.value()).await? {
                        Some(data) => data,
                        None => {
                            return ApiResponse::error("invalid session")
                                .with_status(StatusCode::UNAUTHORIZED)
                                .ok();
                        }
                    };

                session
                    .update_last_used(
                        &state.database,
                        ip.0,
                        headers
	                          .get("User-Agent")
		                        .and_then(|ua| ua.to_str().ok())
		                        .unwrap_or("unknown")
                    )
                    .await;

                cookies.add(UserSession::get_cookie(&state, session_id.value().to_owned()).await?);

                let token = client
                    .exchange_code(AuthorizationCode::new(params.0.code))
                    .request_async(&http_client)
                    .await?;

                let info: serde_json::Value = state
                    .client
                    .get(&oauth_provider.info_url)
                    .bearer_auth(token.access_token().secret())
                    .send()
                    .await?
                    .json()
                    .await?;

                let identifier = oauth_provider.extract_identifier(&info)?;

                let options = shared::models::user_oauth_link::CreateUserOAuthLinkOptions {
                    user_uuid: user.uuid,
                    oauth_provider_uuid: oauth_provider.uuid,
                    identifier: identifier.to_compact_string(),
                };
                match shared::models::user_oauth_link::UserOAuthLink::create(&state, options).await {
                    Ok(_) => {},
                    Err(err) if err.is_unique_violation() => {
                        return ApiResponse::error("you have already connected with this oauth provider")
                            .with_status(StatusCode::CONFLICT)
                            .ok();
                    }
                    Err(err) => return ApiResponse::from(err).ok(),
                }

                if let Err(err) = UserActivity::create(
                    &state,
                    shared::models::user_activity::CreateUserActivityOptions {
                        user_uuid: user.uuid,
                        impersonator_uuid: None,
                        api_key_uuid: None,
                        event: "account:oauth-links.create".into(),
                        ip: Some(ip.0.into()),
                        data: serde_json::json!({
                            "provider": oauth_provider.name,
                            "identifier": identifier,
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

                let settings = state.settings.get().await?;

                ApiResponse::new(Body::empty())
                    .with_header("Location", format!("{}/account/oauth-links", settings.app.url.trim_end_matches('/')))
                    .with_status(StatusCode::TEMPORARY_REDIRECT)
                    .ok()
            } else {
                let token = client
                    .exchange_code(AuthorizationCode::new(params.0.code))
                    .request_async(&http_client)
                    .await?;

                let info: serde_json::Value = state
                    .client
                    .get(&oauth_provider.info_url)
                    .bearer_auth(token.access_token().secret())
                    .send()
                    .await?
                    .json()
                    .await?;

                let identifier = oauth_provider.extract_identifier(&info)?;

                match UserOAuthLink::by_oauth_provider_uuid_identifier(&state.database, oauth_provider.uuid, &identifier).await? {
                    Some(oauth_link) => {
                        let user = oauth_link.user.fetch(&state.database).await?;

                        if user.totp_enabled && !oauth_provider.login_bypass_2fa {
                            if let Err(err) = UserActivity::create(
                                &state,
                                shared::models::user_activity::CreateUserActivityOptions {
                                    user_uuid: user.uuid,
                                    impersonator_uuid: None,
                                    api_key_uuid: None,
                                    event: "auth:checkpoint".into(),
                                    ip: Some(ip.0.into()),
                                    data: serde_json::json!({
                                        "using": "oauth2",
                                        "oauth_provider": oauth_provider.name,

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

                            let token = state.jwt.create(&TwoFactorRequiredJwt {
                                base: BasePayload {
                                    issuer: "panel".into(),
                                    subject: None,
                                    audience: Vec::new(),
                                    expiration_time: Some(chrono::Utc::now().timestamp() + 300),
                                    not_before: None,
                                    issued_at: Some(chrono::Utc::now().timestamp()),
                                    jwt_id: user.uuid.to_string(),
                                },
                                user_uuid: user.uuid,
                            })?;

                            let auth_info = serde_json::json!({
                                "user": user.into_api_object(&state, &state.storage.retrieve_urls().await?).await?,
                                "token": token,
                            });
                            let auth_info = BASE64_ENGINE.encode(serde_json::to_string(&auth_info)?.as_bytes());
                            let auth_info = urlencoding::encode(&auth_info);

                            let settings = state.settings.get().await?;

                            return ApiResponse::new(Body::empty())
                                .with_header("Location", format!("{}/auth/login/checkpoint?data={auth_info}", settings.app.url.trim_end_matches('/')))
                                .with_status(StatusCode::TEMPORARY_REDIRECT)
                                .ok();
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

                        cookies.add(UserSession::get_cookie(&state, key).await?);

                        if let Err(err) = UserActivity::create(
                            &state,
                            shared::models::user_activity::CreateUserActivityOptions {
                                user_uuid: user.uuid,
                                impersonator_uuid: None,
                                api_key_uuid: None,
                                event: "auth:success".into(),
                                ip: Some(ip.0.into()),
                                data: serde_json::json!({
                                    "using": "oauth2",
                                    "oauth_provider": oauth_provider.name,

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

                        sqlx::query!(
                            "UPDATE user_oauth_links
                            SET last_used = NOW()
                            WHERE user_oauth_links.uuid = $1",
                            oauth_link.uuid
                        )
                        .execute(state.database.write())
                        .await?;

                        let settings = state.settings.get().await?;

                        ApiResponse::new(Body::empty())
                            .with_header("Location", &settings.app.url)
                            .with_status(StatusCode::TEMPORARY_REDIRECT)
                            .ok()
                    }
                    None => {
                        let settings = state.settings.get().await?;
                        if !settings.app.registration_enabled {
                            return ApiResponse::new(Body::empty())
                                .with_header("Location", format!("{}/auth/login?error=registration_disabled", settings.app.url.trim_end_matches('/')))
                                .with_status(StatusCode::TEMPORARY_REDIRECT)
                                .ok();
                        }

                        let username = oauth_provider.extract_username(&info)?.into();
                        let email = oauth_provider.extract_email(&info)?.into();
                        let name_first = oauth_provider.extract_name_first(&info)?.into();
                        let name_last = oauth_provider.extract_name_last(&info)?.into();

                        let options = shared::models::user::CreateUserOptions {
                            role_uuid: None,
                            external_id: None,
                            username,
                            email,
                            name_first,
                            name_last,
                            password: None,
                            admin: false,
                            language: settings.app.language.clone(),
                        };
                        let app_url = settings.app.url.clone();
                        drop(settings);

                        let user = match User::create(&state, options).await {
                            Ok(user) => user,
                            Err(err) if err.is_unique_violation() => {
                                return ApiResponse::new(Body::empty())
                                    .with_header("Location", format!("{}/auth/login?error=user_already_exists", app_url.trim_end_matches('/')))
                                    .with_status(StatusCode::TEMPORARY_REDIRECT)
                                    .ok();
                            }
                            Err(err) => return ApiResponse::from(err).ok(),
                        };

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

                        cookies.add(UserSession::get_cookie(&state, key).await?);

                        ApiResponse::new(Body::empty())
                            .with_header("Location", app_url)
                            .with_status(StatusCode::TEMPORARY_REDIRECT)
                            .ok()
                    }
                }
            }
        }))
        .with_state(state.clone())
}
