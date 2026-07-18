use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use crate::routes::api::client::servers::_server_::databases::instances::_instance_::GetServerDatabaseInstance;
    use axum::http::StatusCode;
    use shared::{
        ApiError, GetState,
        models::{server::GetServerActivityLogger, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = String),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = BAD_REQUEST, body = ApiError),
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
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        database_instance: GetServerDatabaseInstance,
        activity_logger: GetServerActivityLogger,
    ) -> ApiResponseResult {
        permissions.has_server_permission("database-instances.export")?;

        if !matches!(
            database_instance.r#type,
            db_agent_api::DatabaseAgentType::Redis
        ) {
            return ApiResponse::error("only redis database instances can be exported directly")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let client = database_instance
            .database_agent_host
            .api_client(&state.database)
            .await?;

        let export = match client
            .get_instances_instance_export(
                database_instance.uuid,
                &db_agent_api::instances_instance_export::get::Query::default(),
            )
            .await
        {
            Ok(export) => export,
            Err(db_agent_api::client::ApiHttpError::Http(StatusCode::NOT_FOUND, err)) => {
                return ApiResponse::new_serialized(ApiError::new_database_agent_value(err))
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
            Err(err) => return Err(err.into()),
        };

        activity_logger
            .log(
                "server:database-instance.export",
                serde_json::json!({
                    "uuid": database_instance.uuid,
                    "name": database_instance.name,
                }),
            )
            .await;

        ApiResponse::new_stream(export)
            .with_header("Content-Type", "application/octet-stream")
            .with_header(
                "Content-Disposition",
                format!(
                    "attachment; filename=\"{}.{}\"",
                    database_instance.name,
                    database_instance.r#type.dump_extension()
                ),
            )
            .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
