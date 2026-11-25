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
        team_preset::TeamPreset,
    },
    response::ApiResponse,
};
use utoipa_axum::{router::OpenApiRouter, routes};

mod duplicate;

pub type GetTeamPreset = shared::extract::ConsumingExtension<TeamPreset>;

pub async fn auth(
    state: GetState,
    actor: GetTeamActor,
    team: GetTeam,
    Path(preset): Path<Vec<String>>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let preset = match preset.get(1).map(|s| s.parse::<uuid::Uuid>()) {
        Some(Ok(id)) => id,
        _ => {
            return Ok(ApiResponse::error("invalid preset uuid")
                .with_status(StatusCode::BAD_REQUEST)
                .into_response());
        }
    };

    if let Err(err) = actor.can_manage() {
        return Ok(err.into_response());
    }

    let preset = TeamPreset::by_team_uuid_uuid(&state.database, team.uuid, preset).await;
    let preset = match preset {
        Ok(Some(preset)) => preset,
        Ok(None) => {
            return Ok(ApiResponse::error("preset not found")
                .with_status(StatusCode::NOT_FOUND)
                .into_response());
        }
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    req.extensions_mut().insert(team.0);
    req.extensions_mut().insert(preset);

    Ok(next.run(req).await)
}

mod delete {
    use crate::routes::api::client::teams::_team_::presets::_preset_::GetTeamPreset;
    use axum::http::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel,
            team::GetTeamActor,
            team_activity::GetTeamActivityLogger,
            team_preset::{DeleteTeamPresetOptions, TeamPreset},
            user::GetPermissionManager,
        },
        prelude::SqlxErrorExt,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        #[serde(default)]
        replacement_preset_uuid: Option<uuid::Uuid>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), params(
        (
            "team" = uuid::Uuid,
            description = "The team ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "preset" = uuid::Uuid,
            description = "The preset ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        actor: GetTeamActor,
        activity_logger: GetTeamActivityLogger,
        preset: GetTeamPreset,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_user_permission("teams.update")?;
        actor.can_manage_presets()?;
        actor.can_assign(&preset)?;

        let replacement = match data.replacement_preset_uuid {
            Some(replacement_preset_uuid) if replacement_preset_uuid == preset.uuid => {
                return ApiResponse::error("a preset cannot be replaced by itself")
                    .with_status(StatusCode::BAD_REQUEST)
                    .ok();
            }
            Some(replacement_preset_uuid) => {
                let Some(replacement) = TeamPreset::by_team_uuid_uuid(
                    &state.database,
                    preset.team_uuid,
                    replacement_preset_uuid,
                )
                .await?
                else {
                    return ApiResponse::error("replacement preset not found")
                        .with_status(StatusCode::NOT_FOUND)
                        .ok();
                };

                // every holder of the deleted preset is assigned the replacement
                actor.can_assign(&replacement)?;

                if !permissions
                    .scope()
                    .covers(&[], &[], &replacement.permissions)
                {
                    return ApiResponse::error("permissions: more permissions than self")
                        .with_status(StatusCode::BAD_REQUEST)
                        .ok();
                }

                Some(replacement)
            }
            None => None,
        };

        if replacement.is_none() && preset.count_members(&state.database).await? > 0 {
            return ApiResponse::error("preset is assigned to members, cannot delete")
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        if let Err(err) = preset
            .delete(
                &state,
                DeleteTeamPresetOptions {
                    replacement_preset_uuid: replacement.as_ref().map(|preset| preset.uuid),
                },
            )
            .await
        {
            if err
                .downcast_ref::<sqlx::Error>()
                .is_some_and(|e| e.is_foreign_key_violation())
            {
                return ApiResponse::error("preset is assigned to members, cannot delete")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }

            return Err(err.into());
        }

        activity_logger
            .log(
                "team:preset.delete",
                serde_json::json!({
                    "uuid": preset.uuid,
                    "name": preset.name,
                    "replacement": replacement.map(|preset| preset.name),
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod patch {
    use crate::routes::api::client::teams::_team_::presets::_preset_::GetTeamPreset;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            UpdatableModel, team::GetTeamActor, team_activity::GetTeamActivityLogger,
            team_preset::UpdateTeamPresetOptions, user::GetPermissionManager,
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
        (status = CONFLICT, body = ApiError),
    ), params(
        (
            "team" = uuid::Uuid,
            description = "The team ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "preset" = uuid::Uuid,
            description = "The preset ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(UpdateTeamPresetOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        actor: GetTeamActor,
        activity_logger: GetTeamActivityLogger,
        mut preset: GetTeamPreset,
        shared::Payload(data): shared::Payload<UpdateTeamPresetOptions>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_user_permission("teams.update")?;
        actor.can_manage_presets()?;

        // both the current and the resulting preset have to stay within the caller's reach
        actor.can_assign(&preset)?;
        actor.can_grant(
            data.weight.unwrap_or(preset.weight),
            data.permissions.as_ref().unwrap_or(&preset.permissions),
            data.ignored_files.as_ref().unwrap_or(&preset.ignored_files),
        )?;

        if !permissions.scope().covers(&[], &[], &preset.permissions)
            || !permissions.scope().covers(
                &[],
                &[],
                data.permissions.as_deref().unwrap_or_default(),
            )
        {
            return ApiResponse::error("permissions: more permissions than self")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        match preset.update(&state, data).await {
            Ok(_) => {}
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("preset with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        }

        activity_logger
            .log(
                "team:preset.update",
                serde_json::json!({
                    "uuid": preset.uuid,
                    "name": preset.name,
                    "weight": preset.weight,
                    "permissions": preset.permissions,
                    "ignored_files": preset.ignored_files,
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
        .nest("/duplicate", duplicate::router(state))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
