use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::admin::nests::_nest_::{GetNest, eggs::_egg_::GetNestEgg};
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            admin_activity::GetAdminActivityLogger, server::Server, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        /// The startup command to apply, has to be one of the egg's startup commands.
        #[garde(length(chars, min = 1, max = 8192))]
        #[schema(min_length = 1, max_length = 8192)]
        startup: compact_str::CompactString,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        /// Amount of servers that were updated.
        synced: usize,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "nest" = uuid::Uuid,
            description = "The nest ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "egg" = uuid::Uuid,
            description = "The egg ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        nest: GetNest,
        egg: GetNestEgg,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("servers.update")?;

        if !egg
            .startup_commands
            .values()
            .any(|command| command == data.startup)
        {
            return ApiResponse::error("startup command is not defined on this egg")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        // ponytail: loads every server of the egg to sync it with wings afterwards, which needs the
        // full model. Chunk this if an egg ever holds more servers than comfortably fit in memory.
        let targets: Vec<Server> = Server::all_by_egg_uuid(&state.database, egg.uuid)
            .await?
            .into_iter()
            .filter(|server| server.startup != data.startup)
            .collect();

        if !targets.is_empty() {
            let uuids: Vec<uuid::Uuid> = targets.iter().map(|server| server.uuid).collect();

            sqlx::query!(
                "UPDATE servers
                SET startup = $2
                WHERE servers.uuid = ANY($1)",
                &uuids,
                data.startup.as_str()
            )
            .execute(state.database.write())
            .await?;
        }

        activity_logger
            .log(
                "nest:egg.sync-startup",
                serde_json::json!({
                    "uuid": egg.uuid,
                    "nest_uuid": nest.uuid,

                    "name": egg.name,
                    "startup": data.startup,

                    "synced": targets.len(),
                }),
            )
            .await;

        let synced = targets.len();
        for mut server in targets {
            server.startup = data.startup.clone();
            server.batch_sync(&state.database).await;
        }

        ApiResponse::new_serialized(Response { synced }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
