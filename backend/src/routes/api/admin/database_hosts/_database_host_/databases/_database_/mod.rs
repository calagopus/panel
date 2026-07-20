use super::State;
use axum::{
    extract::{Path, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{
    GetState,
    models::{server_database::ServerDatabase, user::GetPermissionManager},
    response::ApiResponse,
};
use utoipa_axum::{router::OpenApiRouter, routes};

pub type GetServerDatabase = shared::extract::ConsumingExtension<ServerDatabase>;

pub async fn auth(
    state: GetState,
    permissions: GetPermissionManager,
    database_host: super::super::GetDatabaseHost,
    Path(database): Path<Vec<String>>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let database = match database.get(1).map(|s| s.parse::<uuid::Uuid>()) {
        Some(Ok(id)) => id,
        _ => {
            return Ok(ApiResponse::error("invalid database uuid")
                .with_status(StatusCode::BAD_REQUEST)
                .into_response());
        }
    };

    if let Err(err) = permissions.has_admin_permission("database-hosts.read") {
        return Ok(err.into_response());
    }

    let database =
        ServerDatabase::by_database_host_uuid_uuid(&state.database, database_host.uuid, database)
            .await;
    let database = match database {
        Ok(Some(database)) => database,
        Ok(None) => {
            return Ok(ApiResponse::error("database not found")
                .with_status(StatusCode::NOT_FOUND)
                .into_response());
        }
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    req.extensions_mut().insert(database_host.0);
    req.extensions_mut().insert(database);

    Ok(next.run(req).await)
}

mod delete {
    use super::GetServerDatabase;
    use axum::http::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel, admin_activity::GetAdminActivityLogger,
            server_database::DeleteServerDatabaseOptions, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        force: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "database_host" = uuid::Uuid,
            description = "The database host ID",
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
        database_host: super::super::super::GetDatabaseHost,
        activity_logger: GetAdminActivityLogger,
        database: GetServerDatabase,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("database-hosts.delete")?;

        if database.locked && !data.force {
            return ApiResponse::error("database is locked and cannot be deleted")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        if database_host.maintenance_enabled && !data.force {
            return ApiResponse::error(
                "cannot delete database while database host is in maintenance mode",
            )
            .with_status(StatusCode::EXPECTATION_FAILED)
            .ok();
        }

        let database_uuid = database.uuid;
        let database_name = database.name.clone();

        if let Err(err) = database
            .delete(&state, DeleteServerDatabaseOptions { force: data.force })
            .await
        {
            tracing::error!(
                database_host = %database_host.uuid,
                database = %database_uuid,
                "failed to delete database: {:?}",
                err
            );

            let (err, status) = shared::response::extract_readable_error(&err)
                .unwrap_or_else(|| (err.to_string(), StatusCode::EXPECTATION_FAILED));

            return ApiResponse::error(format!("failed to delete database: {err}"))
                .with_status(status)
                .ok();
        }

        activity_logger
            .log(
                "database-host:database.delete",
                serde_json::json!({
                    "uuid": database_uuid,
                    "database_host_uuid": database_host.uuid,

                    "name": database_name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(delete::route))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
