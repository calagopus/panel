use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _preset_;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoApiObject, Pagination, PaginationParamsWithSearch,
            team::{GetTeam, GetTeamActor},
            team_preset::TeamPreset,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        presets: Pagination<shared::models::team_preset::ApiTeamPreset>,
    }

    #[utoipa::path(get, path = "/", responses(
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
            "page" = i64, Query,
            description = "The page number",
            example = "1",
        ),
        (
            "per_page" = i64, Query,
            description = "The number of items per page",
            example = "10",
        ),
        (
            "search" = Option<String>, Query,
            description = "Search term for items",
        ),
    ))]
    pub async fn route(
        state: GetState,
        actor: GetTeamActor,
        team: GetTeam,
        Query(params): Query<PaginationParamsWithSearch>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        actor.can_manage()?;

        let presets = TeamPreset::by_team_uuid_with_pagination(
            &state.database,
            team.uuid,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        ApiResponse::new_serialized(Response {
            presets: presets
                .try_async_map(|preset| preset.into_api_object(&state, ()))
                .await?,
        })
        .ok()
    }
}

mod post {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel, IntoApiObject,
            team::{GetTeam, GetTeamActor},
            team_activity::GetTeamActivityLogger,
            team_preset::TeamPreset,
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
        #[garde(length(chars, min = 1, max = 1024))]
        #[schema(min_length = 1, max_length = 1024)]
        description: Option<compact_str::CompactString>,
        #[garde(range(min = 0, max = 1_000_000))]
        #[schema(minimum = 0, maximum = 1_000_000)]
        weight: i32,
        #[garde(custom(shared::models::team_preset::validate_team_preset_permissions))]
        permissions: Vec<compact_str::CompactString>,
        #[garde(
            length(max = 1024),
            inner(length(chars, min = 1, max = 255)),
            custom(shared::utils::validate_ignored_files)
        )]
        #[schema(max_items = 1024, min_length = 1, max_length = 255)]
        ignored_files: Vec<compact_str::CompactString>,
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
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        actor: GetTeamActor,
        team: GetTeam,
        activity_logger: GetTeamActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_user_permission("teams.update")?;
        actor.can_manage_presets()?;
        actor.can_grant(data.weight, &data.permissions, &data.ignored_files)?;

        if !permissions.scope().covers(&[], &[], &data.permissions) {
            return ApiResponse::error("permissions: more permissions than self")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let presets_lock = state
            .cache
            .lock(
                format!("teams::{}::presets", team.uuid),
                Some(30),
                Some(5000),
            )
            .await?;

        let presets = TeamPreset::count_by_team_uuid(&state.database, team.uuid).await?;
        if presets >= state.settings.get().await?.user.max_team_preset_count as i64 {
            return ApiResponse::error("maximum number of team presets reached")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let options = shared::models::team_preset::CreateTeamPresetOptions {
            team_uuid: team.uuid,
            name: data.name,
            description: data.description,
            weight: data.weight,
            permissions: data.permissions,
            ignored_files: data.ignored_files,
        };
        let preset = match TeamPreset::create(&state, options).await {
            Ok(preset) => preset,
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
                "team:preset.create",
                serde_json::json!({
                    "uuid": preset.uuid,
                    "name": preset.name,
                    "weight": preset.weight,
                    "permissions": preset.permissions,
                    "ignored_files": preset.ignored_files,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            preset: preset.into_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/{preset}", _preset_::router(state))
        .with_state(state.clone())
}
