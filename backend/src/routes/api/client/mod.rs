use super::{GetState, State};
use axum::{
    extract::{MatchedPath, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use compact_str::ToCompactString;
use shared::{
    models::{
        ByUuid,
        user::{AuthMethod, CredentialScope, PermissionManager, User, UserImpersonator},
        user_activity::UserActivityLogger,
        user_api_key::UserApiKey,
        user_session::UserSession,
    },
    response::ApiResponse,
};
use std::sync::Arc;
use tower_cookies::Cookies;
use utoipa_axum::router::OpenApiRouter;

mod account;
mod permissions;
pub mod servers;

fn check_account_gates(
    user: &User,
    api_key: Option<&UserApiKey>,
    settings: &shared::settings::AppSettings,
    matched_path: &str,
) -> Option<Response> {
    const IGNORED_SUSPENDED_PATHS: &[&str] = &[
        "/api/client/account",
        "/api/client/account/logout",
        "/api/client/account/settings",
    ];

    const IGNORED_REMEDIABLE_PATHS: &[&str] = &[
        "/api/client/account",
        "/api/client/account/logout",
        "/api/client/account/email",
        "/api/client/account/email/resend-verification",
        "/api/client/account/two-factor",
        "/api/client/account/two-factor/email",
        "/api/client/account/security-keys",
        "/api/client/account/security-keys/{security_key}",
        "/api/client/account/security-keys/{security_key}/challenge",
        "/api/client/account/settings",
    ];

    if api_key.is_some_and(|api_key| !api_key.enabled) {
        return Some(
            ApiResponse::error("api key is disabled")
                .with_status(StatusCode::FORBIDDEN)
                .into_response(),
        );
    }

    if !IGNORED_SUSPENDED_PATHS.contains(&matched_path) && user.suspended {
        return Some(
            ApiResponse::error("account is suspended")
                .with_status(StatusCode::FORBIDDEN)
                .into_response(),
        );
    }

    if !IGNORED_REMEDIABLE_PATHS.contains(&matched_path)
        && user.require_two_factor(settings)
        && !user.satisfies_two_factor(settings)
    {
        return Some(
            ApiResponse::error("two-factor authentication required")
                .with_status(StatusCode::FORBIDDEN)
                .into_response(),
        );
    }

    if !IGNORED_REMEDIABLE_PATHS.contains(&matched_path)
        && user.require_email_verification(settings)
        && !user.email_verified
    {
        return Some(
            ApiResponse::error("email verification required")
                .with_status(StatusCode::FORBIDDEN)
                .into_response(),
        );
    }

    None
}

fn bearer_api_token(headers: &axum::http::HeaderMap) -> Option<&str> {
    let api_token = headers.get("Authorization")?;

    if api_token.len() != UserApiKey::HEADER_LEN {
        return None;
    }

    Some(api_token.to_str().ok()?.trim_start_matches("Bearer "))
}

fn api_key_allows_ip(api_key: &UserApiKey, ip: std::net::IpAddr) -> bool {
    api_key.allowed_ips.is_empty()
        || api_key
            .allowed_ips
            .iter()
            .any(|allowed_ip| allowed_ip.contains(ip))
}

async fn finalize(
    state: &GetState,
    ip: shared::GetIp,
    req: &mut Request,
    auth_user: User,
    auth_method: AuthMethod,
) -> Option<Response> {
    let auth_permission_manager =
        PermissionManager::new(&auth_user, CredentialScope::from(&auth_method));
    let api_key_uuid = auth_method.api_key_uuid();

    if auth_permission_manager
        .has_admin_permission("users.impersonate")
        .is_ok()
        && let Some(user_uuid) = req
            .headers()
            .get("Calagopus-User")
            .and_then(|h| h.to_str().ok())
            .and_then(|h| h.parse().ok())
    {
        let user = match User::by_uuid_optional_cached(&state.database, user_uuid).await {
            Ok(Some(user)) => user,
            Ok(None) => {
                return Some(
                    ApiResponse::error("unable to find user from calagopus-user header")
                        .with_status(StatusCode::UNAUTHORIZED)
                        .into_response(),
                );
            }
            Err(err) => return Some(ApiResponse::from(err).into_response()),
        };

        if !auth_permission_manager.can_impersonate(&user) {
            return Some(
                ApiResponse::error("cannot impersonate this user")
                    .with_status(StatusCode::FORBIDDEN)
                    .into_response(),
            );
        }

        req.extensions_mut().insert(
            PermissionManager::new(&user, CredentialScope::from(&auth_method)).for_impersonation(),
        );
        req.extensions_mut().insert(UserActivityLogger {
            state: Arc::clone(state),
            user_uuid: user.uuid,
            impersonator_uuid: Some(auth_user.uuid),
            api_key_uuid,
            ip: ip.0,
        });
        req.extensions_mut().insert(user);
        req.extensions_mut()
            .insert(Some(UserImpersonator(auth_user)));
    } else {
        req.extensions_mut().insert(auth_permission_manager);
        req.extensions_mut().insert(UserActivityLogger {
            state: Arc::clone(state),
            user_uuid: auth_user.uuid,
            impersonator_uuid: None,
            api_key_uuid,
            ip: ip.0,
        });
        req.extensions_mut().insert(auth_user);
        req.extensions_mut().insert(None::<UserImpersonator>);
    }

    req.extensions_mut().insert(Arc::new(auth_method));

    None
}

pub async fn auth(
    state: GetState,
    ip: shared::GetIp,
    cookies: Cookies,
    matched_path: MatchedPath,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let (ratelimit, ip_exempt, has_exempt_api_keys) = match state
        .settings
        .get_as(|s| {
            (
                s.ratelimits.client,
                s.ratelimits.is_ip_exempt(ip.0),
                !s.ratelimits.exempt_api_keys.is_empty(),
            )
        })
        .await
    {
        Ok(data) => data,
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    let mut exempt = ip_exempt;
    let mut resolved_api_key = None;
    if !exempt
        && has_exempt_api_keys
        && let Some(api_token) = bearer_api_token(req.headers())
        && !state
            .cache
            .ratelimit_reached(
                "client:api-key-miss",
                ratelimit.hits,
                ip.to_compact_string(),
            )
            .await
    {
        let resolved = match User::by_api_key_cached(&state.database, api_token).await {
            Ok(resolved) => resolved,
            Err(err) => return Ok(ApiResponse::from(err).into_response()),
        };

        match &resolved {
            Some((_, api_key)) => {
                if api_key.enabled && api_key_allows_ip(api_key, ip.0) {
                    exempt = match state
                        .settings
                        .get_as(|s| s.ratelimits.is_api_key_exempt(api_key.uuid))
                        .await
                    {
                        Ok(exempt) => exempt,
                        Err(err) => return Ok(ApiResponse::from(err).into_response()),
                    };
                }
            }
            None => {
                let _ = state
                    .cache
                    .ratelimit(
                        "client:api-key-miss",
                        ratelimit.hits,
                        ratelimit.window_seconds,
                        ip.to_compact_string(),
                    )
                    .await;
            }
        }

        resolved_api_key = Some(resolved);
    }

    if !exempt
        && let Err(err) = state
            .cache
            .ratelimit(
                "client",
                ratelimit.hits,
                ratelimit.window_seconds,
                ip.to_compact_string(),
            )
            .await
    {
        return Ok(err.into_response());
    }

    let settings = match state.settings.get().await {
        Ok(settings) => settings,
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    if let Some((auth_user, auth_method)) = req.extensions_mut().remove::<(User, AuthMethod)>() {
        let gate = check_account_gates(
            &auth_user,
            match &auth_method {
                AuthMethod::ApiKey(api_key) => Some(api_key),
                AuthMethod::Session(_) => None,
            },
            &settings,
            matched_path.as_str(),
        );
        drop(settings);

        if let Some(response) = gate {
            return Ok(response);
        }

        match &auth_method {
            AuthMethod::Session(session) => {
                session
                    .update_last_used(
                        &state.database,
                        ip.0,
                        req.headers()
                            .get("User-Agent")
                            .and_then(|ua| ua.to_str().ok())
                            .unwrap_or("unknown"),
                    )
                    .await;
            }
            AuthMethod::ApiKey(api_key) => {
                api_key.update_last_used(&state.database).await;
            }
        }

        if let Some(response) = finalize(&state, ip, &mut req, auth_user, auth_method).await {
            return Ok(response);
        }
    } else if let Some(session_id) = cookies.get(&settings.app.session_cookie) {
        drop(settings);

        if session_id.value().len() != UserSession::COOKIE_LEN {
            return Ok(ApiResponse::error("invalid authorization cookie")
                .with_status(StatusCode::UNAUTHORIZED)
                .into_response());
        }

        let (auth_user, session) =
            match User::by_session_cached(&state.database, session_id.value()).await {
                Ok(Some(data)) => data,
                Ok(None) => {
                    return Ok(ApiResponse::error("invalid session")
                        .with_status(StatusCode::UNAUTHORIZED)
                        .into_response());
                }
                Err(err) => return Ok(ApiResponse::from(err).into_response()),
            };

        let auth_method = AuthMethod::Session(session);
        if let AuthMethod::Session(session) = &auth_method {
            session
                .update_last_used(
                    &state.database,
                    ip.0,
                    req.headers()
                        .get("User-Agent")
                        .and_then(|ua| ua.to_str().ok())
                        .unwrap_or("unknown"),
                )
                .await;
        }

        let settings = match state.settings.get().await {
            Ok(settings) => settings,
            Err(err) => return Ok(ApiResponse::from(err).into_response()),
        };
        let gate = check_account_gates(&auth_user, None, &settings, matched_path.as_str());
        drop(settings);

        cookies.add(
            match UserSession::get_cookie(
                &state,
                req.extensions()
                    .get::<shared::RequestHost>()
                    .and_then(|host| host.as_deref()),
                session_id.value().to_string(),
            )
            .await
            {
                Ok(cookie) => cookie,
                Err(err) => return Ok(ApiResponse::from(err).into_response()),
            },
        );

        if let Some(response) = gate {
            return Ok(response);
        }

        if let Some(response) = finalize(&state, ip, &mut req, auth_user, auth_method).await {
            return Ok(response);
        }
    } else if req.headers().contains_key("Authorization") {
        drop(settings);

        let Some(api_token) = bearer_api_token(req.headers()) else {
            return Ok(ApiResponse::error("invalid authorization header")
                .with_status(StatusCode::UNAUTHORIZED)
                .into_response());
        };

        let resolved = match resolved_api_key {
            Some(resolved) => resolved,
            None => match User::by_api_key_cached(&state.database, api_token).await {
                Ok(resolved) => resolved,
                Err(err) => return Ok(ApiResponse::from(err).into_response()),
            },
        };
        let Some((auth_user, api_key)) = resolved else {
            return Ok(ApiResponse::error("invalid api key")
                .with_status(StatusCode::UNAUTHORIZED)
                .into_response());
        };

        if !api_key_allows_ip(&api_key, ip.0) {
            return Ok(
                ApiResponse::error("ip address not allowed for this api key")
                    .with_status(StatusCode::FORBIDDEN)
                    .into_response(),
            );
        }

        let settings = match state.settings.get().await {
            Ok(settings) => settings,
            Err(err) => return Ok(ApiResponse::from(err).into_response()),
        };
        let gate =
            check_account_gates(&auth_user, Some(&api_key), &settings, matched_path.as_str());
        drop(settings);

        if let Some(response) = gate {
            return Ok(response);
        }

        api_key.update_last_used(&state.database).await;

        if let Some(response) =
            finalize(&state, ip, &mut req, auth_user, AuthMethod::ApiKey(api_key)).await
        {
            return Ok(response);
        }
    } else {
        return Ok(ApiResponse::error("missing authorization")
            .with_status(StatusCode::UNAUTHORIZED)
            .into_response());
    }

    Ok(next.run(req).await)
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest("/account", account::router(state))
        .nest("/servers", servers::router(state))
        .nest("/permissions", permissions::router(state))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
