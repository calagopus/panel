use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::client::teams::_team_::presets::_preset_::GetTeamPreset;
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            DuplicableModel, IntoApiObject,
            team::GetTeamActor,
            team_activity::GetTeamActivityLogger,
            team_preset::{DuplicateTeamPresetOptions, TeamPreset},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        name: compact_str::CompactString,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        preset: shared::models::team_preset::ApiTeamPreset,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
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
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_user_permission("teams.update")?;
        actor.can_manage_presets()?;
        actor.can_assign(&preset)?;

        if !permissions.scope().covers(&[], &[], &preset.permissions) {
            return ApiResponse::error("permissions: more permissions than self")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let presets_lock = state
            .cache
            .lock(
                format!("teams::{}::presets", preset.team_uuid),
                Some(30),
                Some(5000),
            )
            .await?;

        let presets = TeamPreset::count_by_team_uuid(&state.database, preset.team_uuid).await?;
        if presets >= state.settings.get().await?.user.max_team_preset_count as i64 {
            return ApiResponse::error("maximum number of team presets reached")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let options = DuplicateTeamPresetOptions { name: data.name };
        let duplicated = match DuplicableModel::duplicate(&preset.0, &state, options).await {
            Ok(duplicated) => duplicated,
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("preset with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        };

        drop(presets_lock);

        activity_logger
            .log(
                "team:preset.duplicate",
                serde_json::json!({
                    "source_uuid": preset.uuid,
                    "source_name": preset.name,
                    "uuid": duplicated.uuid,
                    "name": duplicated.name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            preset: duplicated.into_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
