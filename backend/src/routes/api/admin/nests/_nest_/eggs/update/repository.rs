use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::admin::nests::_nest_::GetNest;
    use futures_util::StreamExt;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            admin_activity::GetAdminActivityLogger, nest_egg::NestEgg, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use std::collections::HashSet;
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(skip)]
        egg_uuids: HashSet<uuid::Uuid>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        updated: usize,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "nest" = uuid::Uuid,
            description = "The nest ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        nest: GetNest,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("eggs.update")?;

        let update_egg = async |egg: uuid::Uuid| {
            let nest_egg = match NestEgg::by_nest_uuid_uuid(&state.database, nest.uuid, egg).await?
            {
                Some(nest_egg) => nest_egg,
                None => return Ok(false),
            };

            let egg_repository_egg = match &nest_egg.egg_repository_egg {
                Some(egg_repository_egg) => egg_repository_egg.fetch(&state.database).await?,
                None => {
                    return Ok(false);
                }
            };

            match nest_egg
                .import_update(&state.database, egg_repository_egg.exported_egg)
                .await
            {
                Ok(_) => {}
                Err(err) if err.is_unique_violation() => return Ok(false),
                Err(err) => return Err(err),
            }

            activity_logger
                .log(
                    "nest:egg.update",
                    serde_json::json!({
                        "uuid": nest_egg.uuid,
                        "nest_uuid": nest.uuid,
                        "egg_repository_egg_uuid": nest_egg.egg_repository_egg.as_ref().map(|e| e.uuid),

                        "author": nest_egg.author,
                        "name": nest_egg.name,
                        "description": nest_egg.description,

                        "config_files": nest_egg.config_files,
                        "config_startup": nest_egg.config_startup,
                        "config_stop": nest_egg.config_stop,
                        "config_script": nest_egg.config_script,

                        "startup_commands": nest_egg.startup_commands,
                        "force_outgoing_ip": nest_egg.force_outgoing_ip,
                        "separate_port": nest_egg.separate_port,

                        "features": nest_egg.features,
                        "docker_images": nest_egg.docker_images,
                        "file_denylist": nest_egg.file_denylist,
                    }),
                )
                .await;

            Ok::<_, shared::database::DatabaseError>(true)
        };

        let mut futures = Vec::new();

        for egg_uuid in data.egg_uuids {
            futures.push(update_egg(egg_uuid));
        }

        let mut results_stream = futures_util::stream::iter(futures).buffer_unordered(5);

        let mut updated = 0;
        while let Some(result) = results_stream.next().await {
            match result {
                Ok(true) => updated += 1,
                Ok(false) => {}
                Err(err) => return ApiResponse::from(err).ok(),
            }
        }

        ApiResponse::new_serialized(Response { updated }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
