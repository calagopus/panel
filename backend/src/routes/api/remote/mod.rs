use super::{GetState, State};
use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{
    models::{ResolvableModel, node::Node},
    response::ApiResponse,
};
use utoipa_axum::router::OpenApiRouter;

mod activity;
mod backups;
mod schedule;
pub mod servers;
mod sftp;
mod tunnel;

pub async fn auth(
    state: GetState,
    ip: shared::GetIp,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let ratelimit = match state.settings.get_as(|s| s.ratelimits.remote).await {
        Ok(ratelimit) => ratelimit,
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };
    if let Err(err) = state
        .cache
        .ratelimit(
            "remote",
            ratelimit.hits,
            ratelimit.window_seconds,
            ip.to_string(),
        )
        .await
    {
        return Ok(err.into_response());
    }

    let authorization = match req
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
    {
        Some(value) => value,
        None => {
            return Ok(ApiResponse::error("invalid authorization header")
                .with_status(StatusCode::UNAUTHORIZED)
                .into_response());
        }
    };
    let Some((r#type, token)) = authorization.split_once(" ") else {
        return Ok(ApiResponse::error("invalid authorization header")
            .with_status(StatusCode::UNAUTHORIZED)
            .into_response());
    };

    if r#type != "Bearer" || token.len() != 81 {
        return Ok(ApiResponse::error("invalid authorization header")
            .with_status(StatusCode::UNAUTHORIZED)
            .into_response());
    }

    let node = Node::resolve_cached(&state.database, token).await;
    let node = match node {
        Ok(Some(data)) => data,
        Ok(None) => {
            return Ok(ApiResponse::error("invalid token")
                .with_status(StatusCode::UNAUTHORIZED)
                .into_response());
        }
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    req.extensions_mut().insert(node);

    Ok(next.run(req).await)
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest("/sftp", sftp::router(state))
        .nest("/activity", activity::router(state))
        .nest("/servers", servers::router(state))
        .nest("/backups", backups::router(state))
        .nest("/schedule", schedule::router(state))
        .nest("/tunnel", tunnel::router(state))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
