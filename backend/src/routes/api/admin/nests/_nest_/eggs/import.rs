use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::admin::nests::_nest_::GetNest;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoAdminApiObject,
            admin_activity::GetAdminActivityLogger,
            nest_egg::{ExportedNestEgg, NestEgg},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        egg: shared::models::nest_egg::AdminApiNestEgg,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
        (status = BAD_REQUEST, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), params(
        (
            "nest" = uuid::Uuid,
            description = "The nest ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = ExportedNestEgg)]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        nest: GetNest,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<ExportedNestEgg>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("eggs.create")?;

        let egg = match NestEgg::import(&state, nest.uuid, None, data).await {
            Ok(egg) => egg,
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("egg with name already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        };

        activity_logger
            .log(
                "nest:egg.create",
                serde_json::json!({
                    "uuid": egg.uuid,
                    "nest_uuid": nest.uuid,

                    "author": egg.author,
                    "name": egg.name,
                    "description": egg.description,

                    "config_files": egg.config_files,
                    "config_startup": egg.config_startup,
                    "config_stop": egg.config_stop,
                    "config_script": egg.config_script,

                    "startup": egg.startup,
                    "force_outgoing_ip": egg.force_outgoing_ip,
                    "separate_port": egg.separate_port,

                    "features": egg.features,
                    "docker_images": egg.docker_images,
                    "file_denylist": egg.file_denylist,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            egg: egg.into_admin_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
