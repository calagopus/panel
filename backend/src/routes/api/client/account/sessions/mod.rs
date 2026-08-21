use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _session_;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoApiObject, Pagination, PaginationParamsWithSearch,
            user::{GetAuthMethod, GetPermissionManager, GetUser},
            user_session::UserSession,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        sessions: Pagination<shared::models::user_session::ApiUserSession>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ), params(
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
        auth: GetAuthMethod,
        user: GetUser,
        Query(params): Query<PaginationParamsWithSearch>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_user_permission("sessions.read")?;

        let sessions = UserSession::by_user_uuid_with_pagination(
            &state.database,
            user.uuid,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        ApiResponse::new_serialized(Response {
            sessions: sessions
                .try_async_map(|session| session.into_api_object(&state, &auth))
                .await?,
        })
        .ok()
    }
}

mod delete {
    use serde::Serialize;
    use shared::{
        GetState,
        models::{
            user::{AuthMethod, GetAuthMethod, GetPermissionManager, GetUser},
            user_activity::GetUserActivityLogger,
            user_session::UserSession,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        deleted: u64,
    }

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        auth: GetAuthMethod,
        user: GetUser,
        activity_logger: GetUserActivityLogger,
    ) -> ApiResponseResult {
        permissions.has_user_permission("sessions.delete")?;

        let deleted = UserSession::delete_by_user_uuid_except(
            &state.database,
            user.uuid,
            match &**auth {
                AuthMethod::Session(session) => Some(session.uuid),
                _ => None,
            },
        )
        .await?;

        activity_logger
            .log(
                "session:delete-all",
                serde_json::json!({
                    "deleted": deleted,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response { deleted }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(delete::route))
        .nest("/{session}", _session_::router(state))
        .with_state(state.clone())
}
