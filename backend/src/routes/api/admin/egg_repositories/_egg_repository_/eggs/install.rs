use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::admin::egg_repositories::_egg_repository_::GetEggRepository;
    use axum::http::StatusCode;
    use futures_util::StreamExt;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            ByUuid, admin_activity::GetAdminActivityLogger, egg_repository_egg::EggRepositoryEgg,
            nest::Nest, nest_egg::NestEgg, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use std::collections::HashSet;
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        egg_uuids: HashSet<uuid::Uuid>,

        nest_uuid: uuid::Uuid,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        installed: usize,
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
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        egg_repository: GetEggRepository,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("eggs.create")?;

        let nest = match Nest::by_uuid_optional(&state.database, data.nest_uuid).await? {
            Some(nest) => nest,
            None => {
                return ApiResponse::error("nest not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        };

        let create_egg = async |egg_uuid: uuid::Uuid| {
            let egg_repository_egg = match EggRepositoryEgg::by_egg_repository_uuid_uuid(
                &state.database,
                egg_repository.uuid,
                egg_uuid,
            )
            .await?
            {
                Some(egg) => egg,
                None => {
                    return Err(shared::database::DatabaseError::from(
                        shared::database::InvalidRelationError("egg_repository_egg"),
                    ));
                }
            };

            let egg = NestEgg::import(
                &state,
                nest.uuid,
                Some(egg_repository_egg.uuid),
                egg_repository_egg.exported_egg,
            )
            .await?;

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

                        "startup_commands": egg.startup_commands,
                        "force_outgoing_ip": egg.force_outgoing_ip,
                        "separate_port": egg.separate_port,

                        "features": egg.features,
                        "docker_images": egg.docker_images,
                        "file_denylist": egg.file_denylist,
                    }),
                )
                .await;

            Ok(())
        };

        let mut futures = Vec::new();

        for egg_uuid in data.egg_uuids {
            futures.push(create_egg(egg_uuid));
        }

        let mut results_stream = futures_util::stream::iter(futures).buffer_unordered(5);

        let mut installed = 0;
        while let Some(result) = results_stream.next().await {
            match result {
                Ok(_) => installed += 1,
                Err(err) if err.is_unique_violation() || err.is_invalid_relation() => {}
                Err(err) if err.is_validation_error() => {
                    tracing::warn!(
                        "validation error while importing egg repository egg: {:?}",
                        err
                    );
                }
                Err(err) => return ApiResponse::from(err).ok(),
            }
        }

        ApiResponse::new_serialized(Response { installed }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
