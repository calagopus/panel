use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _server_group_;
mod order;

mod get {
    use serde::Serialize;
    use shared::{
        GetState,
        models::{
            IntoApiObject,
            user::{GetPermissionManager, GetUser},
            user_server_group::UserServerGroup,
        },
        prelude::AsyncIteratorExt,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        server_groups: Vec<shared::models::user_server_group::ApiUserServerGroup>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
    ) -> ApiResponseResult {
        permissions.has_user_permission("servers.read")?;

        let server_groups = UserServerGroup::all_by_user_uuid(&state.database, user.uuid).await?;

        ApiResponse::new_serialized(Response {
            server_groups: server_groups
                .into_iter()
                .map(|server_group| server_group.into_api_object(&state, ()))
                .try_collect_async_vec()
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
            user::{GetPermissionManager, GetUser},
            user_activity::GetUserActivityLogger,
            user_server_group::UserServerGroup,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(chars, min = 2, max = 31))]
        #[schema(min_length = 2, max_length = 31)]
        name: compact_str::CompactString,
        #[garde(length(max = 100))]
        #[schema(max_length = 100)]
        server_order: Vec<uuid::Uuid>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        server_group: shared::models::user_server_group::ApiUserServerGroup,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        activity_logger: GetUserActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_user_permission("servers.create")?;

        let server_groups = UserServerGroup::count_by_user_uuid(&state.database, user.uuid).await;
        if server_groups >= 25 {
            return ApiResponse::error("maximum number of server groups reached")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let options = shared::models::user_server_group::CreateUserServerGroupOptions {
            user_uuid: user.uuid,
            name: data.name,
            server_order: data.server_order,
        };
        let server_group = UserServerGroup::create(&state, options).await?;

        activity_logger
            .log(
                "user:server-group.create",
                serde_json::json!({
                    "uuid": server_group.uuid,
                    "name": server_group.name,
                    "server_order": server_group.server_order,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            server_group: server_group.into_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/order", order::router(state))
        .nest("/{server_group}", _server_group_::router(state))
        .with_state(state.clone())
}
