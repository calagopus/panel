use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::client::servers::_server_::databases::instances::_instance_::GetServerDatabaseInstance;
    use axum::{
        extract::{Path, Query},
        http::StatusCode,
    };
    use futures_util::TryStreamExt;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{server::GetServerActivityLogger, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Params {
        #[serde(default)]
        wipe: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
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
        (
            "wipe" = bool, Query,
            description = "Whether to wipe all existing data in the database before importing",
            example = "false",
        ),
    ), request_body = Vec<u8>)]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        database_instance: GetServerDatabaseInstance,
        activity_logger: GetServerActivityLogger,
        Path((_server, _database_instance, database)): Path<(String, uuid::Uuid, uuid::Uuid)>,
        Query(params): Query<Params>,
        body: axum::body::Body,
    ) -> ApiResponseResult {
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
            Err(db_agent_api::client::ApiHttpError::Http(StatusCode::NOT_FOUND, err)) => {
                return ApiResponse::new_serialized(ApiError::new_database_agent_value(err))
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
            Err(err) => return Err(err.into()),
        };

        let body_reader = tokio_util::io::StreamReader::new(
            body.into_data_stream().map_err(std::io::Error::other),
        );

        if let Err(err) = client
            .post_instances_instance_import(
                database_instance.uuid,
                db_agent_api::client::AsyncRequestReader::new(body_reader),
                &db_agent_api::instances_instance_import::post::Query {
                    db: Some(db),
                    wipe: Some(params.wipe),
                    ..Default::default()
                },
            )
            .await
        {
            if let db_agent_api::client::ApiHttpError::Http(StatusCode::NOT_FOUND, err) = err {
                return ApiResponse::new_serialized(ApiError::new_database_agent_value(err))
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }

            return Err(err.into());
        }

        activity_logger
            .log(
                "server:database-instance.database.import",
                serde_json::json!({
                    "uuid": database_instance.uuid,
                    "name": database_instance.name,
                    "database_uuid": database,
                    "wipe": params.wipe,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
