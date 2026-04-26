use super::{GetState, State};
use axum::{
    extract::{MatchedPath, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{
    models::{
        ByUuid,
        user::{AuthMethod, PermissionManager, User, UserImpersonator},
        user_activity::UserActivityLogger,
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

pub async fn auth(
    state: GetState,
    ip: shared::GetIp,
    cookies: Cookies,
    matched_path: MatchedPath,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let ratelimit = match state.settings.get_as(|s| s.ratelimits.client).await {
        Ok(ratelimit) => ratelimit,
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };
    if let Err(err) = state
        .cache
        .ratelimit(
            "client",
            ratelimit.hits,
            ratelimit.window_seconds,
            ip.to_string(),
        )
        .await
    {
        return Ok(err.into_response());
    }

    const IGNORED_TWO_FACTOR_PATHS: &[&str] = &[
        "/api/client/account",
        "/api/client/account/two-factor",
        "/api/client/account/logout",
    ];

    if let Some((auth_user, auth_method)) = req.extensions_mut().remove::<(User, AuthMethod)>() {
        let settings = match state.settings.get().await {
            Ok(settings) => settings,
            Err(err) => return Ok(ApiResponse::from(err).into_response()),
        };
        let require_two_factor = auth_user.require_two_factor(&settings);
        drop(settings);

        if !IGNORED_TWO_FACTOR_PATHS.contains(&matched_path.as_str())
            && !auth_user.totp_enabled
            && require_two_factor
        {
            return Ok(ApiResponse::error("two-factor authentication required")
                .with_status(StatusCode::FORBIDDEN)
                .into_response());
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

        let auth_permission_manager = PermissionManager::new(&auth_user);

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
                    return Ok(ApiResponse::error(
                        "unable to find user from calagopus-user header",
                    )
                    .with_status(StatusCode::UNAUTHORIZED)
                    .into_response());
                }
                Err(err) => return Ok(ApiResponse::from(err).into_response()),
            };

            req.extensions_mut().insert(PermissionManager::new(&user));
            req.extensions_mut().insert(UserActivityLogger {
                state: Arc::clone(&state),
                user_uuid: user.uuid,
                impersonator_uuid: Some(auth_user.uuid),
                api_key_uuid: None,
                ip: ip.0,
            });
            req.extensions_mut().insert(user);
            req.extensions_mut()
                .insert(Some(UserImpersonator(auth_user)));
        } else {
            req.extensions_mut().insert(auth_permission_manager);
            req.extensions_mut().insert(UserActivityLogger {
                state: Arc::clone(&state),
                user_uuid: auth_user.uuid,
                impersonator_uuid: None,
                api_key_uuid: None,
                ip: ip.0,
            });
            req.extensions_mut().insert(auth_user);
            req.extensions_mut().insert(None::<UserImpersonator>);
        }

        req.extensions_mut().insert(auth_method);
    } else if let Some(session_id) = cookies.get("session") {
        if session_id.value().len() != 81 {
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

        let settings = match state.settings.get().await {
            Ok(settings) => settings,
            Err(err) => return Ok(ApiResponse::from(err).into_response()),
        };
        let require_two_factor = auth_user.require_two_factor(&settings);
        drop(settings);

        cookies.add(
            match UserSession::get_cookie(&state, session_id.value().to_string()).await {
                Ok(cookie) => cookie,
                Err(err) => return Ok(ApiResponse::from(err).into_response()),
            },
        );

        if !IGNORED_TWO_FACTOR_PATHS.contains(&matched_path.as_str())
            && !auth_user.totp_enabled
            && require_two_factor
        {
            return Ok(ApiResponse::error("two-factor authentication required")
                .with_status(StatusCode::FORBIDDEN)
                .into_response());
        }

        let auth_permission_manager = PermissionManager::new(&auth_user);

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
                    return Ok(ApiResponse::error(
                        "unable to find user from calagopus-user header",
                    )
                    .with_status(StatusCode::UNAUTHORIZED)
                    .into_response());
                }
                Err(err) => return Ok(ApiResponse::from(err).into_response()),
            };

            req.extensions_mut().insert(PermissionManager::new(&user));
            req.extensions_mut().insert(UserActivityLogger {
                state: Arc::clone(&state),
                user_uuid: user.uuid,
                impersonator_uuid: Some(auth_user.uuid),
                api_key_uuid: None,
                ip: ip.0,
            });
            req.extensions_mut().insert(user);
            req.extensions_mut()
                .insert(Some(UserImpersonator(auth_user)));
        } else {
            req.extensions_mut().insert(auth_permission_manager);
            req.extensions_mut().insert(UserActivityLogger {
                state: Arc::clone(&state),
                user_uuid: auth_user.uuid,
                impersonator_uuid: None,
                api_key_uuid: None,
                ip: ip.0,
            });
            req.extensions_mut().insert(auth_user);
            req.extensions_mut().insert(None::<UserImpersonator>);
        }

        req.extensions_mut().insert(AuthMethod::Session(session));
    } else if let Some(api_token) = req.headers().get("Authorization") {
        if api_token.len() != 55 {
            return Ok(ApiResponse::error("invalid authorization header")
                .with_status(StatusCode::UNAUTHORIZED)
                .into_response());
        }

        let api_token = api_token
            .to_str()
            .unwrap_or("")
            .trim_start_matches("Bearer ");
        let (auth_user, api_key) = match User::by_api_key_cached(&state.database, api_token).await {
            Ok(Some(data)) => data,
            Ok(None) => {
                return Ok(ApiResponse::error("invalid api key")
                    .with_status(StatusCode::UNAUTHORIZED)
                    .into_response());
            }
            Err(err) => return Ok(ApiResponse::from(err).into_response()),
        };

        if !api_key.allowed_ips.is_empty()
            && !api_key
                .allowed_ips
                .iter()
                .any(|allowed_ip| allowed_ip.contains(ip.0))
        {
            return Ok(
                ApiResponse::error("ip address not allowed for this api key")
                    .with_status(StatusCode::FORBIDDEN)
                    .into_response(),
            );
        }

        api_key.update_last_used(&state.database).await;

        let settings = match state.settings.get().await {
            Ok(settings) => settings,
            Err(err) => return Ok(ApiResponse::from(err).into_response()),
        };
        let require_two_factor = auth_user.require_two_factor(&settings);
        drop(settings);

        if !IGNORED_TWO_FACTOR_PATHS.contains(&matched_path.as_str())
            && !auth_user.totp_enabled
            && require_two_factor
        {
            return Ok(ApiResponse::error("two-factor authentication required")
                .with_status(StatusCode::FORBIDDEN)
                .into_response());
        }

        let auth_permission_manager = PermissionManager::new(&auth_user).add_api_key(&api_key);

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
                    return Ok(ApiResponse::error(
                        "unable to find user from calagopus-user header",
                    )
                    .with_status(StatusCode::UNAUTHORIZED)
                    .into_response());
                }
                Err(err) => return Ok(ApiResponse::from(err).into_response()),
            };

            req.extensions_mut().insert(PermissionManager::new(&user));
            req.extensions_mut().insert(UserActivityLogger {
                state: Arc::clone(&state),
                user_uuid: user.uuid,
                impersonator_uuid: Some(auth_user.uuid),
                api_key_uuid: Some(api_key.uuid),
                ip: ip.0,
            });
            req.extensions_mut().insert(user);
            req.extensions_mut()
                .insert(Some(UserImpersonator(auth_user)));
        } else {
            req.extensions_mut().insert(auth_permission_manager);
            req.extensions_mut().insert(UserActivityLogger {
                state: Arc::clone(&state),
                user_uuid: auth_user.uuid,
                impersonator_uuid: None,
                api_key_uuid: Some(api_key.uuid),
                ip: ip.0,
            });
            req.extensions_mut().insert(auth_user);
            req.extensions_mut().insert(None::<UserImpersonator>);
        }

        req.extensions_mut().insert(AuthMethod::ApiKey(api_key));
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
