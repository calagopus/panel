use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod put {
    use axum::http::StatusCode;
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

    fn validate_mode(mode: &str, _context: &()) -> Result<(), garde::Error> {
        if mode.len() != 3 || !mode.chars().all(|c| c.is_digit(8)) {
            return Err(garde::Error::new("must be a 3-digit octal string"));
        }

        Ok(())
    }

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct PayloadFiles {
        #[garde(skip)]
        file: compact_str::CompactString,
        #[garde(custom(validate_mode))]
        mode: compact_str::CompactString,
        #[garde(skip)]
        #[serde(default)]
        recursive: bool,
    }

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[serde(default)]
        #[schema(default = "/")]
        #[garde(skip)]
        root: compact_str::CompactString,

        #[schema(inline)]
        #[garde(dive)]
        files: Vec<PayloadFiles>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        updated: u64,
    }

    #[utoipa::path(put, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        mut server: GetServer,
        activity_logger: GetServerActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("files.update")?;

        let request_body = wings_api::servers_server_files_chmod::post::RequestBody {
            root: data.root,
            files: data
                .files
                .into_iter()
                .filter(|f| !server.is_ignored(&f.file, false))
                .map(
                    |f| wings_api::servers_server_files_chmod::post::RequestBodyFiles {
                        file: f.file,
                        mode: f.mode,
                        recursive: f.recursive,
                    },
                )
                .collect(),
        };

        let data = match server
            .node
            .fetch_cached(&state.database)
            .await?
            .api_client(&state.database)
            .await?
            .post_servers_server_files_chmod(server.uuid, &request_body)
            .await
        {
            Ok(data) => data,
            Err(wings_api::client::ApiHttpError::Http(StatusCode::NOT_FOUND, err)) => {
                return ApiResponse::new_serialized(ApiError::new_wings_value(err))
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
            Err(wings_api::client::ApiHttpError::Http(StatusCode::EXPECTATION_FAILED, err)) => {
                return ApiResponse::new_serialized(ApiError::new_wings_value(err))
                    .with_status(StatusCode::EXPECTATION_FAILED)
                    .ok();
            }
            Err(err) => return Err(err.into()),
        };

        activity_logger
            .log(
                "server:file.chmod",
                serde_json::json!({
                    "directory": request_body.root,
                    "files": request_body.files,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            updated: data.updated,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(put::route))
        .with_state(state.clone())
}
