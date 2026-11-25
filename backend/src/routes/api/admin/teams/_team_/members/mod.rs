use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _member_;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoAdminApiObject, Pagination, PaginationParamsWithSearch, team::GetTeam,
            team_member::TeamMember, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        members: Pagination<shared::models::team_member::AdminApiTeamMember>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
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
        permissions: GetPermissionManager,
        team: GetTeam,
        Query(params): Query<PaginationParamsWithSearch>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("users.read")?;

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
                .try_async_map(|member| {
                    member.into_admin_api_object(&state, &storage_url_retriever)
                })
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
            ByUuid, CreatableModel, IntoAdminApiObject,
            admin_activity::GetAdminActivityLogger,
            team::GetTeam,
            team_member::{
                CreateTeamMemberOptions, TeamMember, TeamMemberInvitee, TeamMemberManagement,
            },
            team_preset::TeamPreset,
            user::{GetPermissionManager, User},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use std::collections::HashSet;
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(skip)]
        user_uuid: uuid::Uuid,
        #[garde(skip)]
        preset_uuid: uuid::Uuid,
        #[garde(skip)]
        #[serde(default)]
        management: HashSet<TeamMemberManagement>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        member: shared::models::team_member::AdminApiTeamMember,
    }

    #[utoipa::path(post, path = "/", responses(
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
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        team: GetTeam,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("teams.update")?;
        permissions.has_admin_permission("users.read")?;
        permissions.can_modify_user(&team.owner)?;

        let Some(user) = User::by_uuid_optional(&state.database, data.user_uuid).await? else {
            return ApiResponse::error("user not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        };

        permissions.can_modify_user(&user)?;

        let Some(preset) =
            TeamPreset::by_team_uuid_uuid(&state.database, team.uuid, data.preset_uuid).await?
        else {
            return ApiResponse::error("preset not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        };

        let options = CreateTeamMemberOptions {
            team: &team,
            preset: &preset,
            invitee: TeamMemberInvitee::User(&user),
            management: data.management.into_iter().collect(),
            inviter_uuid: None,
            accepted: true,
        };
        let member = match TeamMember::create(&state, options).await {
            Ok(member) => member,
            Err(shared::database::DatabaseError::Sqlx(sqlx::Error::InvalidArgument(err))) => {
                return ApiResponse::error(&err)
                    .with_status(StatusCode::BAD_REQUEST)
                    .ok();
            }
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("user is already a member of this team")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        };

        activity_logger
            .log(
                "team:member.create",
                serde_json::json!({
                    "team_uuid": team.uuid,
                    "user_uuid": member.user.uuid,
                    "username": member.user.username,
                    "preset_uuid": member.preset.uuid,
                    "management": member.management,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            member: member
                .into_admin_api_object(&state, &state.storage.retrieve_urls().await?)
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
