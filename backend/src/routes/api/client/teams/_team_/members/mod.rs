use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _member_;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoApiObject, Pagination, PaginationParamsWithSearch,
            team::{GetTeam, GetTeamActor},
            team_member::TeamMember,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        members: Pagination<shared::models::team_member::ApiTeamMember>,
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

        actor.can_manage_members()?;

        let members = TeamMember::by_team_uuid_with_pagination(
            &state.database,
            team.uuid,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        let storage_url_retriever = state.storage.retrieve_urls().await?;

        ApiResponse::new_serialized(Response {
            members: members
                .try_async_map(|member| member.into_api_object(&state, &storage_url_retriever))
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
            team_member::{TeamMember, TeamMemberInvitee, TeamMemberManagement},
            team_preset::TeamPreset,
            user::{GetPermissionManager, GetUser},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use std::collections::HashSet;
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(email)]
        #[schema(format = "email")]
        email: compact_str::CompactString,
        #[garde(skip)]
        preset_uuid: uuid::Uuid,
        #[garde(skip)]
        #[serde(default)]
        management: HashSet<TeamMemberManagement>,

        #[garde(skip)]
        captcha: Option<String>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        member: shared::models::team_member::ApiTeamMember,
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
    #[allow(clippy::too_many_arguments)]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        ip: shared::GetIp,
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
        actor.can_manage_members()?;

        let Some(preset) =
            TeamPreset::by_team_uuid_uuid(&state.database, team.uuid, data.preset_uuid).await?
        else {
            return ApiResponse::error("preset not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        };

        let management = data.management.into_iter().collect::<Vec<_>>();

        actor.can_assign(&preset)?;
        actor.can_grant_management(&[], &management)?;

        if !permissions.scope().covers(&[], &[], &preset.permissions) {
            return ApiResponse::error("permissions: more permissions than self")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let ratelimit = state
            .settings
            .get_as(|s| s.ratelimits.client_teams_members_create)
            .await?;
        state
            .cache
            .ratelimit(
                "client/teams/members/create",
                ratelimit.hits,
                ratelimit.window_seconds,
                ip.to_string(),
            )
            .await?;
        state
            .cache
            .ratelimit(
                "client/teams/members/create:user",
                ratelimit.hits,
                ratelimit.window_seconds,
                user.uuid.to_string(),
            )
            .await?;

        if let Err(error) = state.captcha.verify(ip, data.captcha).await {
            return ApiResponse::error(&error)
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let members_lock = state
            .cache
            .lock(
                format!("teams::{}::members", team.uuid),
                Some(30),
                Some(5000),
            )
            .await?;

        let members = TeamMember::count_by_team_uuid(&state.database, team.uuid).await?;
        if members >= state.settings.get().await?.user.max_team_member_count as i64 {
            return ApiResponse::error("maximum number of team members reached")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let options = shared::models::team_member::CreateTeamMemberOptions {
            team: &team,
            preset: &preset,
            invitee: TeamMemberInvitee::Email(data.email),
            management,
            inviter_uuid: Some(user.uuid),
            accepted: false,
        };
        let member = match TeamMember::create(&state, options).await {
            Ok(member) => member,
            Err(shared::database::DatabaseError::Sqlx(sqlx::Error::InvalidArgument(err))) => {
                return ApiResponse::error(&err)
                    .with_status(StatusCode::BAD_REQUEST)
                    .ok();
            }
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("member with email already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        };

        drop(members_lock);

        activity_logger
            .log(
                "team:member.create",
                serde_json::json!({
                    "username": member.user.username,
                    "email": member.user.email,
                    "preset": member.preset.name,
                    "management": member.management,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            member: member
                .into_api_object(&state, &state.storage.retrieve_urls().await?)
                .await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/{member}", _member_::router(state))
        .with_state(state.clone())
}
