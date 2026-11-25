use super::State;
use axum::{
    extract::{Path, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{
    GetState,
    models::{ByUuid, team::Team, user::GetPermissionManager},
    response::ApiResponse,
};
use utoipa_axum::{router::OpenApiRouter, routes};

mod activity;
mod members;
mod presets;
mod servers;

pub async fn auth(
    state: GetState,
    permissions: GetPermissionManager,
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

    if let Err(err) = permissions.has_admin_permission("teams.read") {
        return Ok(err.into_response());
    }

    let team = Team::by_uuid_optional(&state.database, team).await;
    let team = match team {
        Ok(Some(team)) => team,
        Ok(None) => {
            return Ok(ApiResponse::error("team not found")
                .with_status(StatusCode::NOT_FOUND)
                .into_response());
        }
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    req.extensions_mut().insert(team);

    Ok(next.run(req).await)
}

mod get {
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{IntoAdminApiObject, team::GetTeam, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        team: shared::models::team::AdminApiTeam,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "team" = uuid::Uuid,
            description = "The team ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        team: GetTeam,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("teams.read")?;

        ApiResponse::new_serialized(Response {
            team: team
                .0
                .into_admin_api_object(&state, &state.storage.retrieve_urls().await?)
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
            DeletableModel, admin_activity::GetAdminActivityLogger, server::Server, team::GetTeam,
            team_member::TeamMember, user::GetPermissionManager,
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
        team: GetTeam,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("teams.delete")?;
        permissions.can_modify_user(&team.owner)?;

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
            admin_activity::GetAdminActivityLogger,
            team::{GetTeam, UpdateTeamOptions},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(patch, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
        (status = BAD_REQUEST, body = ApiError),
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
        mut team: GetTeam,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<UpdateTeamOptions>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("teams.update")?;
        permissions.can_modify_user(&team.owner)?;

        team.update(&state, data).await?;

        activity_logger
            .log(
                "team:update",
                serde_json::json!({
                    "uuid": team.uuid,
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
        .nest("/presets", presets::router(state))
        .nest("/servers", servers::router(state))
        .nest("/activity", activity::router(state))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
