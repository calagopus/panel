use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::client::servers::_server_::databases::instances::_instance_::GetServerDatabaseInstance;
    use axum::{extract::Query, http::StatusCode};
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
            "wipe" = bool, Query,
            description = "Whether to wipe all existing data in the instance before importing",
            example = "false",
        ),
    ), request_body = Vec<u8>)]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        database_instance: GetServerDatabaseInstance,
        activity_logger: GetServerActivityLogger,
        Query(params): Query<Params>,
        body: axum::body::Body,
    ) -> ApiResponseResult {
        if !matches!(
            database_instance.r#type,
            db_agent_api::DatabaseAgentType::Redis
        ) {
            return ApiResponse::error(
                "only redis database instances can be imported into directly",
            )
            .with_status(StatusCode::BAD_REQUEST)
            .ok();
        }

        permissions.has_server_permission("database-instances.import")?;

        let body_reader = tokio_util::io::StreamReader::new(
            body.into_data_stream().map_err(std::io::Error::other),
        );

        tokio::spawn(async move {
            match database_instance
                .database_agent_host
                .api_client(&state.database)
                .await?
                .post_instances_instance_import(
                    database_instance.uuid,
                    db_agent_api::client::AsyncRequestReader::new(body_reader),
                    &db_agent_api::instances_instance_import::post::Query {
                        wipe: Some(params.wipe),
                        ..Default::default()
                    },
                )
                .await
            {
                Ok(_) => {}
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
            }

            activity_logger
                .log(
                    "server:database-instance.import",
                    serde_json::json!({
                        "uuid": database_instance.uuid,
                        "name": database_instance.name,
                        "wipe": params.wipe,
                    }),
                )
                .await;

            ApiResponse::new_serialized(Response {}).ok()
        })
        .await?
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
