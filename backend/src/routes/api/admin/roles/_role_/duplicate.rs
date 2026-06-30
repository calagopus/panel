use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::admin::roles::_role_::GetRole;
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            DuplicableModel, IntoAdminApiObject,
            admin_activity::GetAdminActivityLogger,
            role::DuplicateRoleOptions,
            user::{GetPermissionManager, GetUser},
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
        role: shared::models::role::AdminApiRole,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), params(
        (
            "role" = uuid::Uuid,
            description = "The role ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        caller: GetUser,
        role: GetRole,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("roles.create")?;

        if !caller.admin {
            let caller_admin = caller
                .role
                .as_ref()
                .map(|r| r.admin_permissions.as_slice())
                .unwrap_or(&[]);
            let caller_server = caller
                .role
                .as_ref()
                .map(|r| r.server_permissions.as_slice())
                .unwrap_or(&[]);

            if !role
                .admin_permissions
                .iter()
                .all(|p| caller_admin.contains(p))
                || !role
                    .server_permissions
                    .iter()
                    .all(|p| caller_server.contains(p))
            {
                return ApiResponse::error("permissions: more permissions than self")
                    .with_status(StatusCode::FORBIDDEN)
                    .ok();
            }
        }

        let options = DuplicateRoleOptions { name: data.name };
        let duplicated = match DuplicableModel::duplicate(&role.0, &state, options).await {
            Ok(role) => role,
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("role with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        };

        activity_logger
            .log(
                "role:duplicate",
                serde_json::json!({
                    "source_uuid": role.uuid,
                    "source_name": role.name,
                    "uuid": duplicated.uuid,
                    "name": duplicated.name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            role: duplicated.into_admin_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
