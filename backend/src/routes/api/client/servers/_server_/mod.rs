use super::State;
use axum::{
    extract::{MatchedPath, Path, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{
    GetState,
    models::{
        server::{Server, ServerActivityLogger},
        user::{GetAuthMethod, GetPermissionManager, GetUser, GetUserImpersonator},
    },
    response::ApiResponse,
};
use std::sync::Arc;
use utoipa_axum::{router::OpenApiRouter, routes};

mod activity;
mod allocations;
mod announcements;
mod backups;
mod command;
mod databases;
mod devices;
mod files;
mod firewall;
mod logs;
mod mounts;
mod power;
mod resources;
mod schedules;
mod settings;
mod startup;
mod subusers;
mod tunnel;
mod websocket;

#[allow(clippy::too_many_arguments)]
pub async fn auth(
    state: GetState,
    user: GetUser,
    user_impersonator: GetUserImpersonator,
    permissions: GetPermissionManager,
    auth: GetAuthMethod,
    ip: shared::GetIp,
    matched_path: MatchedPath,
    Path(server): Path<Vec<String>>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let server = Server::by_user_identifier(&state.database, &permissions, &server[0]).await;
    let server = match server {
        Ok(Some(server)) => server,
        Ok(None) => {
            return Ok(ApiResponse::error("server not found")
                .with_status(StatusCode::NOT_FOUND)
                .into_response());
        }
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    const IGNORED_STATUS_PATHS: &[&str] = &[
        "/api/client/servers/{server}",
        "/api/client/servers/{server}/websocket",
        "/api/client/servers/{server}/settings/install/cancel",
        "/api/client/servers/{server}/backups/restore",
        "/api/client/servers/{server}/backups/unlock",
    ];

    // anyone allowed to update servers stays able to act on a suspended one, which is what suspension is for
    if !IGNORED_STATUS_PATHS.contains(&matched_path.as_str())
        && let Some(message) = server.unavailable_reason()
        && !(server.suspended && permissions.has_admin_permission("servers.update").is_ok())
    {
        return Ok(ApiResponse::error(message)
            .with_status(StatusCode::CONFLICT)
            .into_response());
    }

    req.extensions_mut().insert(permissions.for_server(&server));
    req.extensions_mut().insert(ServerActivityLogger {
        state: Arc::clone(&state),
        server_uuid: server.uuid,
        user_uuid: user.uuid,
        impersonator_uuid: user_impersonator.as_ref().map(|i| i.uuid),
        user_admin: user.admin,
        user_owner: user.uuid == server.owner.uuid,
        user_subuser: server.subuser_permissions.is_some(),
        api_key_uuid: match &**auth {
            crate::routes::api::client::AuthMethod::ApiKey(api_key) => Some(api_key.uuid),
            _ => None,
        },
        ip: ip.0,
    });
    req.extensions_mut().insert(user.0);
    req.extensions_mut().insert(user_impersonator.0);
    req.extensions_mut().insert(server);

    Ok(next.run(req).await)
}

mod get {
    use serde::Serialize;
    use shared::{
        GetState,
        models::{IntoApiObject, server::GetServer, user::GetUser},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        server: shared::models::server::ApiServer,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(state: GetState, user: GetUser, server: GetServer) -> ApiResponseResult {
        ApiResponse::new_serialized(Response {
            server: server.0.into_api_object(&state, &user).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .nest("/activity", activity::router(state))
        .nest("/announcements", announcements::router(state))
        .nest("/resources", resources::router(state))
        .nest("/logs", logs::router(state))
        .nest("/websocket", websocket::router(state))
        .nest("/command", command::router(state))
        .nest("/power", power::router(state))
        .nest("/files", files::router(state))
        .nest("/settings", settings::router(state))
        .nest("/startup", startup::router(state))
        .nest("/subusers", subusers::router(state))
        .nest("/backups", backups::router(state))
        .nest("/allocations", allocations::router(state))
        .nest("/firewall", firewall::router(state))
        .nest("/tunnel", tunnel::router(state))
        .nest("/databases", databases::router(state))
        .nest("/mounts", mounts::router(state))
        .nest("/devices", devices::router(state))
        .nest("/schedules", schedules::router(state))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
