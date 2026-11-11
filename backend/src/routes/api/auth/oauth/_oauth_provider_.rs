use crate::routes::api::auth::login::checkpoint::{
    TwoFactorRequiredJwt, available_methods, two_factor_unprovable,
};

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
    AuthUrl, AuthorizationCode, ClientId, ClientSecret, HttpRequest, HttpResponse,
    PkceCodeVerifier, RedirectUrl, TokenResponse, TokenUrl, basic::BasicClient,
};
use rand::distr::SampleString;
use serde::Deserialize;
use shared::models::IntoApiObject;
use shared::{
    GetState,
    database::BASE64_ENGINE,
    jwt::BasePayload,
    models::{
        ByUuid, CreatableModel,
        oauth_provider::{OAuthProvider, OAuthProviderInfo},
        user::User,
        user_activity::UserActivity,
        user_oauth_link::UserOAuthLink,
        user_session::UserSession,
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

async fn apply_oauth_provider_mappings(
    state: &shared::State,
    oauth_provider: &OAuthProvider,
    user_uuid: uuid::Uuid,
    token: &impl TokenResponse,
    info: &OAuthProviderInfo,
) {
    let granted_scopes: Vec<compact_str::CompactString> = token
        .scopes()
        .map(|scopes| scopes.iter().map(|scope| scope.as_ref().into()).collect())
        .unwrap_or_default();

    if let Err(err) = shared::models::oauth_provider_mapping::OAuthProviderMapping::apply_for_user(
        state,
        oauth_provider.uuid,
        user_uuid,
        &granted_scopes,
        info,
    )
    .await
    {
        tracing::warn!(
            user = %user_uuid,
            oauth_provider = %oauth_provider.uuid,
            "failed to apply oauth provider mappings: {:#?}",
            err
        );
    }
}

fn import_oauth_avatar(
    state: &shared::State,
    oauth_provider: &OAuthProvider,
    user: &User,
    info: &serde_json::Value,
) {
    if user.frozen || (user.avatar.is_some() && !oauth_provider.avatar_overwrite) {
        return;
    }

    let source_url = match oauth_provider.extract_avatar_url(info) {
        Ok(Some(source_url)) => source_url,
        Ok(None) => return,
        Err(err) => {
            tracing::warn!(
                user = %user.uuid,
                oauth_provider = %oauth_provider.uuid,
                "failed to resolve oauth avatar url: {:#?}",
                err
            );

            return;
        }
    };

    let state = std::sync::Arc::clone(state);
    let oauth_provider_uuid = oauth_provider.uuid;
    let user_uuid = user.uuid;
    let previous = user.avatar.clone();

    tokio::spawn(async move {
        if let Err(err) =
            User::import_avatar_by_uuid(&state, user_uuid, previous.as_deref(), &source_url).await
        {
            tracing::warn!(
                user = %user_uuid,
                oauth_provider = %oauth_provider_uuid,
                "failed to import oauth avatar: {:#?}",
                err
            );
        }
    });
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .route("/", get(|state: GetState,
            ip: shared::GetIp,
            request_host: shared::GetRequestHost,
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

            let state_cookie = cookies.get("oauth_state").map(|cookie| cookie.value().to_owned());
            cookies.remove(
                tower_cookies::Cookie::build("oauth_state")
                    .path("/api/auth/oauth")
                    .build(),
            );

            let cache_key = format!("oauth_flow::{}::{}", oauth_provider.uuid, params.state);

            let pkce_verifier = match state.cache.get::<Option<String>>(&cache_key).await? {
                Some(pkce_verifier) if state_cookie.as_deref() == Some(params.state.as_str()) => {
                    pkce_verifier
                }
                _ => {
                    return ApiResponse::error("oauth csrf state not found, please try again")
                        .with_status(StatusCode::NOT_FOUND)
                        .ok();
                }
            };

            state.cache.invalidate(&cache_key).await?;

            let settings = state.settings.get().await?;
            let app_url = settings
                .app
                .url_for_host(request_host.as_deref())
                .trim_end_matches('/')
                .to_compact_string();

            let client_secret = match &oauth_provider.client_secret {
                Some(client_secret) => Some(ClientSecret::new(
                    client_secret.decrypt(&state.database).await?.into(),
                )),
                None => None,
            };

            let mut client = BasicClient::new(ClientId::new(oauth_provider.client_id.to_string()))
                .set_auth_uri(AuthUrl::new(oauth_provider.auth_url.clone())?)
                .set_token_uri(TokenUrl::new(oauth_provider.token_url.clone())?)
                .set_auth_type(if oauth_provider.basic_auth {
                    oauth2::AuthType::BasicAuth
                } else {
                    oauth2::AuthType::RequestBody
                })
                .set_redirect_uri(RedirectUrl::new(format!(
                    "{app_url}/api/auth/oauth/{}",
                    oauth_provider.uuid
                ))?);
            if let Some(client_secret) = client_secret {
                client = client.set_client_secret(client_secret);
            }
            let session_cookie = settings.app.session_cookie.clone();

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

            if let Some(session_id) = cookies.get(&session_cookie) {
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

                cookies.add(UserSession::get_cookie(&state, request_host.as_deref(), session_id.value().to_owned()).await?);

                let mut token_request = client.exchange_code(AuthorizationCode::new(params.0.code));
                if let Some(pkce_verifier) = pkce_verifier {
                    token_request = token_request.set_pkce_verifier(PkceCodeVerifier::new(pkce_verifier));
                }

                let token = token_request.request_async(&http_client).await?;

                let info = oauth_provider
                    .fetch_info(&state.client, token.access_token().secret())
                    .await?;

                let identifier = oauth_provider.extract_identifier(&info.info)?;

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

                apply_oauth_provider_mappings(&state, &oauth_provider, user.uuid, &token, &info).await;
                import_oauth_avatar(&state, &oauth_provider, &user, &info.info);

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

                ApiResponse::new(Body::empty())
                    .with_header("Location", format!("{app_url}/account/oauth-links"))
                    .with_status(StatusCode::TEMPORARY_REDIRECT)
                    .ok()
            } else {
                let mut token_request = client.exchange_code(AuthorizationCode::new(params.0.code));
                if let Some(pkce_verifier) = pkce_verifier {
                    token_request = token_request.set_pkce_verifier(PkceCodeVerifier::new(pkce_verifier));
                }

                let token = token_request.request_async(&http_client).await?;

                let info = oauth_provider
                    .fetch_info(&state.client, token.access_token().secret())
                    .await?;

                let identifier = oauth_provider.extract_identifier(&info.info)?;

                match UserOAuthLink::by_oauth_provider_uuid_identifier(&state.database, oauth_provider.uuid, &identifier).await? {
                    Some(oauth_link) => {
                        let user = oauth_link.user.fetch(&state.database).await?;

                        apply_oauth_provider_mappings(&state, &oauth_provider, user.uuid, &token, &info).await;
                        import_oauth_avatar(&state, &oauth_provider, &user, &info.info);

                        let settings = state.settings.get().await?;
                        let methods = available_methods(&user, &settings);

                        if two_factor_unprovable(&user, &settings) && !oauth_provider.login_bypass_two_factor {
                            drop(settings);

                            return ApiResponse::new(Body::empty())
                                .with_header("Location", format!("{app_url}/auth/login?error=security_key_required"))
                                .with_status(StatusCode::TEMPORARY_REDIRECT)
                                .ok();
                        }

                        drop(settings);

                        if !methods.is_empty() && !oauth_provider.login_bypass_two_factor {
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
                                    scope: "two-factor-checkpoint".into(),
                                    issuer: "panel".into(),
                                    subject: None,
                                    audience: Vec::new(),
                                    expiration_time: Some(chrono::Utc::now().timestamp() + 300),
                                    not_before: None,
                                    issued_at: Some(chrono::Utc::now().timestamp()),
                                    jwt_id: user.uuid.to_compact_string(),
                                },
                                user_uuid: user.uuid,
                            })?;

                            let auth_info = serde_json::json!({
                                "user": user.into_api_object(&state, &state.storage.retrieve_urls().await?).await?,
                                "token": token,
                                "methods": methods,
                            });
                            let auth_info = BASE64_ENGINE.encode(serde_json::to_string(&auth_info)?.as_bytes());
                            let auth_info = urlencoding::encode(&auth_info);

                            return ApiResponse::new(Body::empty())
                                .with_header("Location", format!("{app_url}/auth/login/checkpoint?data={auth_info}"))
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

                        ApiResponse::new(Body::empty())
                            .with_header("Location", &*app_url)
                            .with_status(StatusCode::TEMPORARY_REDIRECT)
                            .ok()
                    }
                    None => {
                        let settings = state.settings.get().await?;
                        if oauth_provider.login_only {
                            return ApiResponse::new(Body::empty())
                                .with_header("Location", format!("{app_url}/auth/login?error=registration_disabled"))
                                .with_status(StatusCode::TEMPORARY_REDIRECT)
                                .ok();
                        }

                        let username = oauth_provider.extract_username(&info.info)?;
                        let email: compact_str::CompactString = oauth_provider.extract_email(&info.info)?.into();
                        let name_first: Option<compact_str::CompactString> = oauth_provider.extract_name_first(&info.info)?.map(Into::into);
                        let name_last: Option<compact_str::CompactString> = oauth_provider.extract_name_last(&info.info)?.map(Into::into);
                        let language = settings.app.language.clone();
                        drop(settings);

                        let mut attempt_username = compact_str::CompactString::from(username.as_str());
                        let mut attempts = 0;
                        let user = loop {
                            let options = shared::models::user::CreateUserOptions {
                                role_uuid: None,
                                external_id: None,
                                username: attempt_username.clone(),
                                email: email.clone(),
                                name_first: name_first.clone(),
                                name_last: name_last.clone(),
                                password: None,
                                admin: false,
                                frozen: false,
                                suspended: false,
                                verify_email: false,
                                send_email: false,
                                language: language.clone(),
                            };

                            match User::create(&state, options).await {
                                Ok(user) => break user,
                                Err(err) if attempts < 5 && err.is_unique_constraint_violation("users_username_idx") => {
                                    attempts += 1;
                                    attempt_username = compact_str::format_compact!(
                                        "{}_{}",
                                        shared::utils::slice_up_to(&username, 10),
                                        rand::distr::Alphanumeric.sample_string(&mut rand::rng(), 4)
                                    );
                                }
                                Err(err) if err.is_unique_violation() => {
                                    return ApiResponse::new(Body::empty())
                                        .with_header("Location", format!("{app_url}/auth/login?error=user_already_exists"))
                                        .with_status(StatusCode::TEMPORARY_REDIRECT)
                                        .ok();
                                }
                                Err(err) => return ApiResponse::from(err).ok(),
                            }
                        };

                        let options = shared::models::user_oauth_link::CreateUserOAuthLinkOptions {
                            user_uuid: user.uuid,
                            oauth_provider_uuid: oauth_provider.uuid,
                            identifier: identifier.to_compact_string(),
                        };
                        match shared::models::user_oauth_link::UserOAuthLink::create(&state, options).await {
                            Ok(_) => {},
                            Err(err) => return ApiResponse::from(err).ok(),
                        }

                        apply_oauth_provider_mappings(&state, &oauth_provider, user.uuid, &token, &info).await;
                        import_oauth_avatar(&state, &oauth_provider, &user, &info.info);

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

                        ApiResponse::new(Body::empty())
                            .with_header("Location", &*app_url)
                            .with_status(StatusCode::TEMPORARY_REDIRECT)
                            .ok()
                    }
                }
            }
        }))
        .with_state(state.clone())
}
