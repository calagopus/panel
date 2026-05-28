use super::State;
use axum::{
    extract::{Path, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{
    GetState,
    models::{server::GetServer, server_subuser::ServerSubuser, user::GetPermissionManager},
    response::ApiResponse,
};
use utoipa_axum::{router::OpenApiRouter, routes};

pub type GetServerSubuser = shared::extract::ConsumingExtension<ServerSubuser>;

pub async fn auth(
    state: GetState,
    permissions: GetPermissionManager,
    server: GetServer,
    Path(subuser): Path<Vec<String>>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let subuser = match subuser.get(1).map(|s| s.parse::<uuid::Uuid>()) {
        Some(Ok(id)) => id,
        _ => {
            return Ok(ApiResponse::error("invalid subuser uuid")
                .with_status(StatusCode::BAD_REQUEST)
                .into_response());
        }
    };

    if let Err(err) = permissions.has_server_permission("subusers.read") {
        return Ok(err.into_response());
    }

    let subuser =
        ServerSubuser::by_server_uuid_user_uuid(&state.database, server.uuid, subuser).await;
    let subuser = match subuser {
        Ok(Some(subuser)) => subuser,
        Ok(None) => {
            return Ok(ApiResponse::error("subuser not found")
                .with_status(StatusCode::NOT_FOUND)
                .into_response());
        }
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    req.extensions_mut().insert(server.0);
    req.extensions_mut().insert(subuser);

    Ok(next.run(req).await)
}

mod delete {
    use crate::routes::api::client::servers::_server_::subusers::_subuser_::GetServerSubuser;
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
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "subuser" = uuid::Uuid,
            description = "The subuser ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        activity_logger: GetServerActivityLogger,
        subuser: GetServerSubuser,
    ) -> ApiResponseResult {
        permissions.has_server_permission("subusers.delete")?;

        subuser.delete(&state, ()).await?;

        activity_logger
            .log(
                "server:subuser.delete",
                serde_json::json!({
                    "username": subuser.user.username,
                    "email": subuser.user.email,
                }),
            )
            .await;

        tokio::spawn(async move {
            tracing::debug!(server = %server.uuid, "removing subuser permissions in wings");

            let node = match server.node.fetch_cached(&state.database).await {
                Ok(node) => node,
                Err(err) => {
                    tracing::error!(server = %server.uuid, "failed to remove subuser permissions in wings: {:?}", err);

                    return;
                }
            };

            let api_client = match node.api_client(&state.database).await {
                Ok(api_client) => api_client,
                Err(err) => {
                    tracing::error!(server = %server.uuid, "failed to remove subuser permissions in wings: {:?}", err);

                    return;
                }
            };

            if let Err(err) = api_client
               	.post_servers_server_ws_permissions(
                    server.uuid,
                    &wings_api::servers_server_ws_permissions::post::RequestBody {
                        user_permissions: vec![wings_api::servers_server_ws_permissions::post::RequestBodyUserPermissions {
                            user: subuser.user.uuid,
                            permissions: Vec::new(),
                            ignored_files: Vec::new(),
                        }]
                    }
                )
                .await
            {
                tracing::error!(server = %server.uuid, "failed to remove subuser permissions in wings: {:?}", err);
            }

            if let Err(err) = api_client
                .post_servers_server_ws_deny(
                    server.uuid,
                    &wings_api::servers_server_ws_deny::post::RequestBody {
                        jtis: vec![subuser.user.uuid.to_string().into()],
                    },
                )
                .await
            {
                tracing::error!(server = %server.uuid, "failed to remove subuser permissions in wings: {:?}", err);
            }
        });

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod patch {
    use crate::routes::api::client::servers::_server_::subusers::_subuser_::GetServerSubuser;
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            UpdatableModel,
            server::{GetServer, GetServerActivityLogger},
            user::{GetPermissionManager, GetUser},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(inner(custom(shared::permissions::validate_server_permissions)))]
        permissions: Option<Vec<compact_str::CompactString>>,
        #[garde(skip)]
        ignored_files: Option<Vec<compact_str::CompactString>>,
    }

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
            "subuser" = uuid::Uuid,
            description = "The subuser ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        server: GetServer,
        activity_logger: GetServerActivityLogger,
        mut subuser: GetServerSubuser,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        if let Some(permissions) = &data.permissions
            && !user.admin
            && let Some(subuser_permissions) = &server.subuser_permissions
            && permissions.iter().any(|p| !subuser_permissions.contains(p))
        {
            return ApiResponse::error("permissions: more permissions than self")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("subusers.update")?;

        if subuser.user.uuid == user.uuid {
            return ApiResponse::error("cannot update permissions for self")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        subuser
            .update(
                &state,
                shared::models::server_subuser::UpdateServerSubuserOptions {
                    permissions: data.permissions,
                    ignored_files: data.ignored_files,
                },
            )
            .await?;

        activity_logger
            .log(
                "server:subuser.update",
                serde_json::json!({
                    "username": subuser.user.username,
                    "email": subuser.user.email,
                    "permissions": subuser.permissions,
                    "ignored_files": subuser.ignored_files,
                }),
            )
            .await;

        tokio::spawn(async move {
            tracing::debug!(server = %server.uuid, "updating subuser permissions in wings");

            let node = match server.node.fetch_cached(&state.database).await {
                Ok(node) => node,
                Err(err) => {
                    tracing::error!(server = %server.uuid, "failed to update subuser permissions in wings: {:?}", err);

                    return;
                }
            };

            let api_client = match node.api_client(&state.database).await {
                Ok(api_client) => api_client,
                Err(err) => {
                    tracing::error!(server = %server.uuid, "failed to update subuser permissions in wings: {:?}", err);

                    return;
                }
            };

            if let Err(err) = api_client
                .post_servers_server_ws_permissions(
                    server.uuid,
                    &wings_api::servers_server_ws_permissions::post::RequestBody {
                        user_permissions: vec![wings_api::servers_server_ws_permissions::post::RequestBodyUserPermissions {
                            user: subuser.user.uuid,
                            permissions: server.wings_subuser_permissions(
                                match &state.settings.get().await {
                                    Ok(settings) => settings,
                                    Err(_) => return,
                                },
                                &subuser
                            )
                                .into_iter()
                                .map(compact_str::CompactString::from)
                                .collect(),
                            ignored_files: subuser.0.ignored_files,
                        }]
                    }
                )
                .await
            {
                tracing::error!(server = %server.uuid, "failed to update subuser permissions in wings: {:?}", err);
            }
        });

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(delete::route))
        .routes(routes!(patch::route))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
