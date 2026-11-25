use super::State;
use axum::{
    extract::{Path, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{
    GetState,
    models::{
        team::{GetTeam, GetTeamActor},
        team_member::TeamMember,
    },
    response::ApiResponse,
};
use utoipa_axum::{router::OpenApiRouter, routes};

pub type GetTeamMember = shared::extract::ConsumingExtension<TeamMember>;

pub async fn auth(
    state: GetState,
    actor: GetTeamActor,
    team: GetTeam,
    Path(member): Path<Vec<String>>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let member = match member.get(1).map(|s| s.parse::<uuid::Uuid>()) {
        Some(Ok(id)) => id,
        _ => {
            return Ok(ApiResponse::error("invalid member uuid")
                .with_status(StatusCode::BAD_REQUEST)
                .into_response());
        }
    };

    if let Err(err) = actor.can_manage_members() {
        return Ok(err.into_response());
    }

    let member = TeamMember::by_team_uuid_user_uuid(&state.database, team.uuid, member).await;
    let member = match member {
        Ok(Some(member)) => member,
        Ok(None) => {
            return Ok(ApiResponse::error("member not found")
                .with_status(StatusCode::NOT_FOUND)
                .into_response());
        }
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    req.extensions_mut().insert(team.0);
    req.extensions_mut().insert(member);

    Ok(next.run(req).await)
}

mod delete {
    use crate::routes::api::client::teams::_team_::members::_member_::GetTeamMember;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel,
            team::GetTeamActor,
            team_activity::GetTeamActivityLogger,
            team_member::DeleteTeamMemberOptions,
            user::{GetPermissionManager, GetUser},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
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
        (
            "member" = uuid::Uuid,
            description = "The user ID of the member",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        actor: GetTeamActor,
        activity_logger: GetTeamActivityLogger,
        member: GetTeamMember,
    ) -> ApiResponseResult {
        permissions.has_user_permission("teams.update")?;

        if member.user.uuid == user.uuid {
            return ApiResponse::error("cannot remove self, leave the team instead")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        // an invite can always be withdrawn by whoever sent it
        if member.accepted.is_some()
            || member.inviter.as_ref().map(|inviter| inviter.uuid) != Some(user.uuid)
        {
            actor.outranks(&member.preset)?;
        }

        member
            .delete(&state, DeleteTeamMemberOptions { notify: true })
            .await?;

        activity_logger
            .log(
                "team:member.delete",
                serde_json::json!({
                    "username": member.user.username,
                    "email": member.user.email,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod patch {
    use crate::routes::api::client::teams::_team_::members::_member_::GetTeamMember;
    use axum::http::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            UpdatableModel,
            team::GetTeamActor,
            team_activity::GetTeamActivityLogger,
            team_member::{TeamMemberManagement, UpdateTeamMemberOptions},
            team_preset::TeamPreset,
            user::{GetPermissionManager, GetUser},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use std::collections::HashSet;
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        preset_uuid: Option<uuid::Uuid>,
        management: Option<HashSet<TeamMemberManagement>>,
    }

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
        (
            "member" = uuid::Uuid,
            description = "The user ID of the member",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        actor: GetTeamActor,
        activity_logger: GetTeamActivityLogger,
        mut member: GetTeamMember,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_user_permission("teams.update")?;

        if member.user.uuid == user.uuid {
            return ApiResponse::error("cannot update membership for self")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        actor.outranks(&member.preset)?;

        if let Some(preset_uuid) = data.preset_uuid
            && preset_uuid != member.preset.uuid
        {
            let Some(preset) =
                TeamPreset::by_team_uuid_uuid(&state.database, member.team_uuid, preset_uuid)
                    .await?
            else {
                return ApiResponse::error("preset not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            };

            actor.can_assign(&preset)?;

            if !permissions.scope().covers(&[], &[], &preset.permissions) {
                return ApiResponse::error("permissions: more permissions than self")
                    .with_status(StatusCode::BAD_REQUEST)
                    .ok();
            }
        }

        let management = data
            .management
            .map(|management| management.into_iter().collect::<Vec<_>>());

        if let Some(management) = &management {
            actor.can_grant_management(&member.management, management)?;
        }

        member
            .update(
                &state,
                UpdateTeamMemberOptions {
                    preset_uuid: data.preset_uuid,
                    management,
                },
            )
            .await?;

        activity_logger
            .log(
                "team:member.update",
                serde_json::json!({
                    "username": member.user.username,
                    "email": member.user.email,
                    "preset": member.preset.name,
                    "management": member.management,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(delete::route))
        .routes(routes!(patch::route))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
