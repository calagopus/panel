use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::{extract::Path, http::StatusCode};
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            server::{GetServer, GetServerActivityLogger},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(min = 1, max = 100))]
        #[schema(inline, min_items = 1, max_items = 100)]
        files: Vec<wings_api::servers_server_files_trash_entry_restore::post::RequestBodyFiles>,

        #[garde(skip)]
        #[serde(default)]
        overwrite: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        restored:
            Vec<wings_api::servers_server_files_trash_entry_restore::post::Response200Restored>,
        #[schema(inline)]
        conflicts:
            Vec<wings_api::servers_server_files_trash_entry_restore::post::Response200Conflicts>,
        entry: Option<wings_api::TrashEntry>,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = NOT_IMPLEMENTED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "entry" = uuid::Uuid,
            description = "The trash entry ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        mut server: GetServer,
        activity_logger: GetServerActivityLogger,
        Path((_server, entry)): Path<(String, uuid::Uuid)>,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("files.delete")?;

        let request_body = wings_api::servers_server_files_trash_entry_restore::post::RequestBody {
            files: data
                .files
                .into_iter()
                .filter(|file| {
                    file.to
                        .as_ref()
                        .is_none_or(|to| !server.is_ignored_either(to))
                })
                .collect(),
            overwrite: data.overwrite,
        };

        tokio::spawn(async move {
            let data = server
                .0
                .node
                .fetch_cached(&state.database)
                .await?
                .api_client(&state.database)
                .await?
                .ignoring(server.0.subuser_ignored_files.unwrap_or_default())
                .post_servers_server_files_trash_entry_restore(server.0.uuid, entry, &request_body)
                .await?;

            if !data.restored.is_empty() {
                activity_logger
                    .log(
                        "server:file.trash.restore",
                        serde_json::json!({
                            "entry": entry,
                            "files": data.restored.iter().map(|file| &file.to).collect::<Vec<_>>(),
                        }),
                    )
                    .await;
            }

            ApiResponse::new_serialized(Response {
                restored: data.restored,
                conflicts: data.conflicts,
                entry: data.entry,
            })
            .ok()
        })
        .await?
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
