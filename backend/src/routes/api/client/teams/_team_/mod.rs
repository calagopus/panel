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
        team::Team,
        team_activity::TeamActivityLogger,
        user::{GetAuthMethod, GetPermissionManager, GetUser, GetUserImpersonator},
    },
    response::ApiResponse,
};
use std::sync::Arc;
use utoipa_axum::{router::OpenApiRouter, routes};

mod activity;
mod members;
mod membership;
mod presets;
mod servers;

#[allow(clippy::too_many_arguments)]
pub async fn auth(
    state: GetState,
    user: GetUser,
    user_impersonator: GetUserImpersonator,
    permissions: GetPermissionManager,
    auth: GetAuthMethod,
    ip: shared::GetIp,
    matched_path: MatchedPath,
    Path(team): Path<Vec<String>>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let team = match team.first().map(|s| s.parse::<uuid::Uuid>()) {
        Some(Ok(id)) => id,
        _ => {
            return Ok(ApiResponse::error("invalid team uuid")
                .with_status(StatusCode::BAD_REQUEST)
                .into_response());
        }
    };

    if let Err(err) = permissions.has_user_permission("teams.read") {
        return Ok(err.into_response());
    }

    let team = Team::by_user_uuid_uuid(&state.database, user.uuid, team).await;
    let team = match team {
        Ok(Some(team)) => team,
        Ok(None) => {
            return Ok(ApiResponse::error("team not found")
                .with_status(StatusCode::NOT_FOUND)
                .into_response());
        }
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    const PENDING_PATHS: &[&str] = &[
        "/api/client/teams/{team}/membership",
        "/api/client/teams/{team}/membership/accept",
    ];

    // an invite that has not been accepted yet may only be answered
    match team.actor(user.uuid) {
        Some(actor) => {
            req.extensions_mut().insert(actor);
        }
        None if PENDING_PATHS.contains(&matched_path.as_str()) => {}
        None => {
            return Ok(ApiResponse::error("team invite has not been accepted")
                .with_status(StatusCode::FORBIDDEN)
                .into_response());
        }
    }

    req.extensions_mut().insert(TeamActivityLogger {
        state: Arc::clone(&state),
        team_uuid: team.uuid,
        user_uuid: user.uuid,
        impersonator_uuid: user_impersonator.as_ref().map(|i| i.uuid),
        api_key_uuid: auth.api_key_uuid(),
        ip: ip.0,
    });
    req.extensions_mut().insert(user.0);
    req.extensions_mut().insert(user_impersonator.0);
    req.extensions_mut().insert(team);

    Ok(next.run(req).await)
}

mod get {
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{IntoApiObject, team::GetTeam},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        team: shared::models::team::ApiTeam,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "team" = uuid::Uuid,
            description = "The team ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(state: GetState, team: GetTeam) -> ApiResponseResult {
        ApiResponse::new_serialized(Response {
            team: team
                .0
                .into_api_object(&state, &state.storage.retrieve_urls().await?)
                .await?,
        })
        .ok()
    }
}

mod delete {
    use axum::http::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel,
            server::Server,
            team::{GetTeam, GetTeamActor},
            team_member::TeamMember,
            user::GetPermissionManager,
            user_activity::GetUserActivityLogger,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        #[serde(default)]
        force: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), params(
        (
            "team" = uuid::Uuid,
            description = "The team ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        actor: GetTeamActor,
        team: GetTeam,
        activity_logger: GetUserActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_user_permission("teams.delete")?;
        actor.can_manage_team()?;

        if !data.force {
            let servers = Server::count_by_team_uuid(&state.database, team.uuid).await?;
            let members = TeamMember::count_by_team_uuid(&state.database, team.uuid).await?;
            if servers > 0 || members > 0 {
                return ApiResponse::error("team has servers or members, cannot delete")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
        }

        team.delete(&state, ()).await?;

        activity_logger
            .log(
                "team:delete",
                serde_json::json!({
                    "uuid": team.uuid,
                    "name": team.name,
                    "force": data.force,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod patch {
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            UpdatableModel,
            team::{GetTeam, GetTeamActor, UpdateTeamOptions},
            team_activity::GetTeamActivityLogger,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(patch, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "team" = uuid::Uuid,
            description = "The team ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(UpdateTeamOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        actor: GetTeamActor,
        mut team: GetTeam,
        activity_logger: GetTeamActivityLogger,
        shared::Payload(data): shared::Payload<UpdateTeamOptions>,
    ) -> ApiResponseResult {
        permissions.has_user_permission("teams.update")?;
        actor.can_manage_team()?;

        team.update(&state, data).await?;

        activity_logger
            .log(
                "team:update",
                serde_json::json!({
                    "name": team.name,
                    "description": team.description,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(delete::route))
        .routes(routes!(patch::route))
        .nest("/members", members::router(state))
        .nest("/membership", membership::router(state))
        .nest("/presets", presets::router(state))
        .nest("/servers", servers::router(state))
        .nest("/activity", activity::router(state))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
