use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use crate::routes::api::remote::backups::_backup_::GetBackup;
    use axum::{extract::Query, http::StatusCode};
    use serde::Deserialize;
    use shared::{
        ApiError, GetState,
        models::{
            server_backup::ServerBackupKind, server_database_instance::ServerDatabaseInstance,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Params {
        instance: uuid::Uuid,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = String),
        (status = NOT_FOUND, body = ApiError),
        (status = BAD_REQUEST, body = ApiError),
        (status = CONFLICT, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "backup" = uuid::Uuid,
            description = "The backup ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "instance" = uuid::Uuid, Query,
            description = "The database instance to export from",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        backup: GetBackup,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        if backup.kind != ServerBackupKind::DatabaseInstance {
            return ApiResponse::error("backup is not a database instance backup")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let Some(server) = &backup.server else {
            return ApiResponse::error("server uuid not found")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        };

        let Some(database_instance) = ServerDatabaseInstance::by_server_uuid_uuid(
            &state.database,
            server.uuid,
            params.instance,
        )
        .await?
        else {
            return ApiResponse::error("database instance not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        };

        if backup.database_type != Some(database_instance.r#type) {
            return ApiResponse::error("backup was taken from a different database engine")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let export = match database_instance
            .database_agent_host
            .api_client(&state.database)
            .await?
            .get_instances_instance_export(
                database_instance.uuid,
                &db_agent_api::instances_instance_export::get::Query::default(),
            )
            .await
        {
            Ok(export) => export,
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

        ApiResponse::new_stream(export)
            .with_header("Content-Type", "application/octet-stream")
            .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
