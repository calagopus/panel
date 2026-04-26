use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::admin::egg_repositories::_egg_repository_::GetEggRepository;
    use axum::{extract::Path, http::StatusCode};
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            ByUuid, IntoAdminApiObject, admin_activity::GetAdminActivityLogger,
            egg_repository_egg::EggRepositoryEgg, nest::Nest, nest_egg::NestEgg,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        nest_uuid: uuid::Uuid,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        egg: shared::models::nest_egg::AdminApiNestEgg,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "egg_repository" = uuid::Uuid,
            description = "The egg repository ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "egg" = uuid::Uuid,
            description = "The egg repository egg ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        egg_repository: GetEggRepository,
        activity_logger: GetAdminActivityLogger,
        Path((_egg_repository_uuid, egg_uuid)): Path<(uuid::Uuid, uuid::Uuid)>,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("eggs.create")?;

        let egg_repository_egg = match EggRepositoryEgg::by_egg_repository_uuid_uuid(
            &state.database,
            egg_repository.uuid,
            egg_uuid,
        )
        .await?
        {
            Some(egg) => egg,
            None => {
                return ApiResponse::error("egg repository egg not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        };

        let nest = match Nest::by_uuid_optional(&state.database, data.nest_uuid).await? {
            Some(nest) => nest,
            None => {
                return ApiResponse::error("nest not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        };

        let egg = match NestEgg::import(
            &state,
            nest.uuid,
            Some(egg_repository_egg.uuid),
            egg_repository_egg.exported_egg,
        )
        .await
        {
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
                    "egg_repository_egg_uuid": egg_repository_egg.uuid,

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
