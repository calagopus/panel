use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::client::servers::_server_::databases::instances::_instance_::GetServerDatabaseInstance;
    use axum::{extract::Path, http::StatusCode};
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{server::GetServerActivityLogger, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(url, length(max = 2048))]
        #[schema(max_length = 2048)]
        url: compact_str::CompactString,
        #[garde(skip)]
        source_db: Option<compact_str::CompactString>,
        #[garde(skip)]
        #[serde(default)]
        wipe: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        operation: uuid::Uuid,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = BAD_REQUEST, body = ApiError),
        (status = CONFLICT, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "database_instance" = uuid::Uuid,
            description = "The database instance ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "database" = uuid::Uuid,
            description = "The database ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        database_instance: GetServerDatabaseInstance,
        activity_logger: GetServerActivityLogger,
        Path((_server, _database_instance, database)): Path<(String, uuid::Uuid, uuid::Uuid)>,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("database-instances.import")?;

        let client = database_instance
            .database_agent_host
            .api_client(&state.database)
            .await?;

        let db = match client
            .get_instances_instance_databases_database(database_instance.uuid, database)
            .await
        {
            Ok(response) => response.database.name,
            Err(db_agent_api::client::ApiHttpError::Http(
                status @ (StatusCode::NOT_FOUND
                | StatusCode::BAD_REQUEST
                | StatusCode::CONFLICT
                | StatusCode::EXPECTATION_FAILED),
                err,
            )) => {
                return ApiResponse::new_serialized(ApiError::new_database_agent_value(err))
                    .with_status(status)
                    .ok();
            }
            Err(err) => return Err(err.into()),
        };

        tokio::spawn(async move {
            let import = match client
                .post_instances_instance_import_remote(
                    database_instance.uuid,
                    &db_agent_api::instances_instance_import_remote::post::RequestBody {
                        url: data.url,
                        source_db: data.source_db.clone(),
                        db: Some(db),
                        wipe: data.wipe,
                        lock: false,
                    },
                )
                .await
            {
                Ok(import) => import,
                Err(db_agent_api::client::ApiHttpError::Http(
                    status @ (StatusCode::NOT_FOUND
                    | StatusCode::BAD_REQUEST
                    | StatusCode::CONFLICT
                    | StatusCode::EXPECTATION_FAILED),
                    err,
                )) => {
                    return ApiResponse::new_serialized(ApiError::new_database_agent_value(err))
                        .with_status(status)
                        .ok();
                }
                Err(err) => return Err(err.into()),
            };

            activity_logger
                .log(
                    "server:database-instance.database.import-remote",
                    serde_json::json!({
                        "uuid": database_instance.uuid,
                        "name": database_instance.name,
                        "database_uuid": database,
                        "operation_uuid": import.operation,
                        "source_db": data.source_db,
                        "wipe": data.wipe,
                    }),
                )
                .await;

            ApiResponse::new_serialized(Response {
                operation: import.operation,
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
