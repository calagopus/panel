use super::State;
use axum::{
    extract::{Path, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{
    GetState,
    models::{server::GetServer, server_database::ServerDatabase, user::GetPermissionManager},
    response::ApiResponse,
};
use utoipa_axum::{router::OpenApiRouter, routes};

mod recreate;
mod rotate_password;
mod size;

pub type GetServerDatabase = shared::extract::ConsumingExtension<ServerDatabase>;

pub async fn auth(
    state: GetState,
    permissions: GetPermissionManager,
    server: GetServer,
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

    if let Err(err) = permissions.has_server_permission("databases.read") {
        return Ok(err.into_response());
    }

    let database =
        ServerDatabase::by_server_uuid_uuid(&state.database, server.uuid, database).await;
    let database = match database {
        Ok(Some(database)) => database,
        Ok(None) => {
            return Ok(ApiResponse::error("database not found")
                .with_status(StatusCode::NOT_FOUND)
                .into_response());
        }
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    req.extensions_mut().insert(server.0);
    req.extensions_mut().insert(database);

    Ok(next.run(req).await)
}

mod get {
    use crate::routes::api::client::servers::_server_::databases::_database_::GetServerDatabase;
    use axum::extract::Query;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{IntoApiObject, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Params {
        #[serde(default)]
        pub include_password: bool,
    }

    #[derive(ToSchema, Serialize)]
    pub struct Response {
        database: shared::models::server_database::ApiServerDatabase,
    }

    #[utoipa::path(get, path = "/", responses(
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
            "database" = uuid::Uuid,
            description = "The database ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "include_password" = bool, Query,
            description = "Whether to include the database password in the response",
            example = "true",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        database: GetServerDatabase,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        permissions.has_server_permission("databases.read")?;

        ApiResponse::new_serialized(Response {
            database: database
                .0
                .into_api_object(&state, params.include_password)
                .await?,
        })
        .ok()
    }
}

mod delete {
    use crate::routes::api::client::servers::_server_::databases::_database_::GetServerDatabase;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel,
            server::{GetServer, GetServerActivityLogger},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
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
        (
            "database" = uuid::Uuid,
            description = "The database ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        database: GetServerDatabase,
        activity_logger: GetServerActivityLogger,
    ) -> ApiResponseResult {
        permissions.has_server_permission("databases.delete")?;

        if database.locked {
            return ApiResponse::error("database is locked and cannot be deleted")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        if database.database_host.maintenance_enabled {
            return ApiResponse::error(
                "cannot delete database while database host is in maintenance mode",
            )
            .with_status(StatusCode::EXPECTATION_FAILED)
            .ok();
        }

        if let Err(err) = database.delete(&state, Default::default()).await {
            if err
                .downcast_ref::<shared::response::DisplayError>()
                .is_some()
            {
                return ApiResponse::from(err).ok();
            }

            tracing::error!(server = %server.uuid, "failed to delete database: {:?}", err);

            return ApiResponse::error("failed to delete database")
                .with_status(StatusCode::INTERNAL_SERVER_ERROR)
                .ok();
        }

        activity_logger
            .log(
                "server:database.delete",
                serde_json::json!({
                    "uuid": database.uuid,
                    "name": database.name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod patch {
    use crate::routes::api::client::servers::_server_::databases::_database_::GetServerDatabase;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            UpdatableModel, server::GetServerActivityLogger,
            server_database::UpdateServerDatabaseOptions, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(patch, path = "/", responses(
        (status = OK, body = inline(Response)),
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
            "database" = uuid::Uuid,
            description = "The database ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(UpdateServerDatabaseOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetServerActivityLogger,
        mut database: GetServerDatabase,
        shared::Payload(data): shared::Payload<UpdateServerDatabaseOptions>,
    ) -> ApiResponseResult {
        permissions.has_server_permission("databases.update")?;

        database.update(&state, data).await?;

        activity_logger
            .log(
                "server:database.update",
                serde_json::json!({
                    "uuid": database.uuid,
                    "name": database.name,
                    "locked": database.locked,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(delete::route))
        .routes(routes!(patch::route))
        .nest("/size", size::router(state))
        .nest("/rotate-password", rotate_password::router(state))
        .nest("/recreate", recreate::router(state))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
