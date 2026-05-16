use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::admin::nests::_nest_::GetNest;
    use axum::http::StatusCode;
    use futures_util::StreamExt;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            ByUuid, admin_activity::GetAdminActivityLogger, nest::Nest, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use std::collections::HashSet;
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(skip)]
        egg_uuids: HashSet<uuid::Uuid>,

        #[garde(skip)]
        destination_nest_uuid: uuid::Uuid,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        moved: usize,
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
        permissions.has_admin_permission("eggs.update")?;

        let destination_nest =
            match Nest::by_uuid_optional(&state.database, data.destination_nest_uuid).await? {
                Some(destination_nest) => destination_nest,
                None => {
                    return ApiResponse::error("destination nest not found")
                        .with_status(StatusCode::NOT_FOUND)
                        .ok();
                }
            };

        if nest.uuid == destination_nest.uuid {
            return ApiResponse::error("cannot move egg to the same nest")
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        let move_egg = async |egg: uuid::Uuid| {
            let affected = sqlx::query!(
                "UPDATE nest_eggs
                SET nest_uuid = $3
                WHERE nest_eggs.uuid = $1 AND nest_eggs.nest_uuid = $2",
                egg,
                nest.uuid,
                destination_nest.uuid
            )
            .execute(state.database.write())
            .await?;

            activity_logger
                .log(
                    "nest:egg.move",
                    serde_json::json!({
                        "uuid": egg,
                        "nest_uuid": nest.uuid,

                        "destination_nest_uuid": destination_nest.uuid,
                    }),
                )
                .await;

            Ok::<_, shared::database::DatabaseError>(affected.rows_affected() == 1)
        };

        let mut futures = Vec::new();

        for egg_uuid in data.egg_uuids {
            futures.push(move_egg(egg_uuid));
        }

        let mut results_stream = futures_util::stream::iter(futures).buffer_unordered(5);

        let mut moved = 0;
        while let Some(result) = results_stream.next().await {
            match result {
                Ok(true) => moved += 1,
                Ok(false) => {}
                Err(err) => return ApiResponse::from(err).ok(),
            }
        }

        ApiResponse::new_serialized(Response { moved }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
