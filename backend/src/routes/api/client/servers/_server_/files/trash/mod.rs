use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _entry_;
mod restore;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{Pagination, PaginationParams, server::GetServer, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        entries: Pagination<wings_api::TrashEntry>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "page" = i64, Query,
            description = "The page number for pagination",
            example = "1",
        ),
        (
            "per_page" = i64, Query,
            description = "The number of items per page",
            example = "10",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        Query(pagination): Query<PaginationParams>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&pagination) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("files.read")?;

        let entries = match server
            .node
            .fetch_cached(&state.database)
            .await?
            .api_client(&state.database)
            .await?
            .get_servers_server_files_trash(
                server.uuid,
                &wings_api::servers_server_files_trash::get::Query {
                    ignored: server.0.subuser_ignored_files,
                    per_page: Some(pagination.per_page as u64),
                    page: Some(pagination.page as u64),
                    ..Default::default()
                },
            )
            .await
        {
            Ok(data) => data,
            Err(wings_api::client::ApiHttpError::Http(StatusCode::NOT_FOUND, err)) => {
                return ApiResponse::new_serialized(ApiError::new_wings_value(err))
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
            Err(err) => return Err(err.into()),
        };

        ApiResponse::new_serialized(Response {
            entries: Pagination {
                total: entries.total as i64,
                per_page: pagination.per_page,
                page: pagination.page,
                data: entries.entries,
            },
        })
        .ok()
    }
}

mod delete {
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

    #[derive(ToSchema, Validate, Deserialize)]
    #[serde(rename_all = "snake_case", tag = "type")]
    #[non_exhaustive]
    pub enum TrashSelector {
        Uuids {
            #[garde(length(min = 1, max = 100))]
            #[schema(min_items = 1, max_items = 100)]
            uuids: Vec<uuid::Uuid>,
        },
        All,
    }

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(dive)]
        selector: TrashSelector,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        deleted: u64,
    }

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
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
        server: GetServer,
        activity_logger: GetServerActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("files.delete")?;

        tokio::spawn(async move {
            let client = server
                .0
                .node
                .fetch_cached(&state.database)
                .await?
                .api_client(&state.database)
                .await?;

            let deleted = match data.selector {
                TrashSelector::Uuids { uuids } => {
                    let request_body =
                        wings_api::servers_server_files_trash_purge::post::RequestBody {
                            entries: uuids,
                        };

                    let deleted = match client
                        .ignoring(server.0.subuser_ignored_files.unwrap_or_default())
                        .post_servers_server_files_trash_purge(server.0.uuid, &request_body)
                        .await
                    {
                        Ok(data) => data.deleted,
                        Err(wings_api::client::ApiHttpError::Http(StatusCode::NOT_FOUND, err)) => {
                            return ApiResponse::new_serialized(ApiError::new_wings_value(err))
                                .with_status(StatusCode::NOT_FOUND)
                                .ok();
                        }
                        Err(err) => return Err(err.into()),
                    };

                    activity_logger
                        .log(
                            "server:file.trash.delete",
                            serde_json::json!({
                                "entries": request_body.entries,
                                "deleted": deleted,
                            }),
                        )
                        .await;

                    deleted
                }
                TrashSelector::All => {
                    let deleted = match client
                        .delete_servers_server_files_trash(
                            server.0.uuid,
                            &wings_api::servers_server_files_trash::delete::Query {
                                ignored: server.0.subuser_ignored_files,
                                ..Default::default()
                            },
                        )
                        .await
                    {
                        Ok(data) => data.deleted,
                        Err(wings_api::client::ApiHttpError::Http(StatusCode::NOT_FOUND, err)) => {
                            return ApiResponse::new_serialized(ApiError::new_wings_value(err))
                                .with_status(StatusCode::NOT_FOUND)
                                .ok();
                        }
                        Err(err) => return Err(err.into()),
                    };

                    activity_logger
                        .log(
                            "server:file.trash.empty",
                            serde_json::json!({
                                "deleted": deleted,
                            }),
                        )
                        .await;

                    deleted
                }
            };

            ApiResponse::new_serialized(Response { deleted }).ok()
        })
        .await?
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(delete::route))
        .nest("/restore", restore::router(state))
        .nest("/{entry}", _entry_::router(state))
        .with_state(state.clone())
}
