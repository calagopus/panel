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
            ByUuid, DeletableModel, admin_activity::GetAdminActivityLogger, nest_egg::NestEgg,
            server::Server, user::GetPermissionManager,
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
        deleted: usize,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), params(
        (
            "nest" = uuid::Uuid,
            description = "The nest ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        nest: GetNest,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("eggs.delete")?;

        let delete_egg = async |egg: uuid::Uuid| {
            if Server::count_by_egg_uuid(&state.database, egg).await > 0 {
                return Ok(false);
            }

            let nest_egg = match NestEgg::by_uuid_optional(&state.database, egg).await? {
                Some(nest_egg) => nest_egg,
                None => return Ok(false),
            };

            nest_egg.delete(&state, ()).await?;

            activity_logger
                .log(
                    "nest:egg.delete",
                    serde_json::json!({
                        "uuid": nest_egg.uuid,
                        "nest_uuid": nest.uuid,

                        "author": nest_egg.author,
                        "name": nest_egg.name,
                    }),
                )
                .await;

            Ok::<_, shared::database::DatabaseError>(true)
        };

        let mut futures = Vec::new();

        for egg_uuid in data.egg_uuids {
            futures.push(delete_egg(egg_uuid));
        }

        let mut results_stream = futures_util::stream::iter(futures).buffer_unordered(5);

        let mut deleted = 0;
        while let Some(result) = results_stream.next().await {
            match result {
                Ok(true) => deleted += 1,
                Ok(false) => {}
                Err(err) => return ApiResponse::from(err).ok(),
            }
        }

        ApiResponse::new_serialized(Response { deleted }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
