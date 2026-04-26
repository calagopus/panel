use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod available;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoAdminApiObject, Pagination, PaginationParamsWithSearch, node::GetNode,
            node_allocation::NodeAllocation, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        allocations: Pagination<shared::models::node_allocation::AdminApiNodeAllocation>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "node" = uuid::Uuid,
            description = "The node ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "page" = i64, Query,
            description = "The page number",
            example = "1",
        ),
        (
            "per_page" = i64, Query,
            description = "The number of items per page",
            example = "10",
        ),
        (
            "search" = Option<String>, Query,
            description = "Search term for items",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        node: GetNode,
        Query(params): Query<PaginationParamsWithSearch>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("nodes.allocations")?;

        let allocations = NodeAllocation::by_node_uuid_with_pagination(
            &state.database,
            node.uuid,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        let storage_url_retriever = state.storage.retrieve_urls().await?;

        ApiResponse::new_serialized(Response {
            allocations: allocations
                .try_async_map(|allocation| {
                    allocation.into_admin_api_object(&state, &storage_url_retriever)
                })
                .await?,
        })
        .ok()
    }
}

mod delete {
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            admin_activity::GetAdminActivityLogger, node::GetNode, node_allocation::NodeAllocation,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        uuids: Vec<uuid::Uuid>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        deleted: u64,
    }

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "node" = uuid::Uuid,
            description = "The node ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        node: GetNode,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("nodes.allocations")?;

        let deleted =
            NodeAllocation::delete_by_uuids(&state.database, node.uuid, &data.uuids).await?;

        activity_logger
            .log(
                "node:allocation.delete",
                serde_json::json!({
                    "node_uuid": node.uuid,

                    "uuids": data.uuids
                }),
            )
            .await;

        ApiResponse::new_serialized(Response { deleted }).ok()
    }
}

mod post {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            admin_activity::GetAdminActivityLogger, node::GetNode, node_allocation::NodeAllocation,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(skip)]
        #[schema(value_type = String)]
        ip: std::net::IpAddr,
        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        ip_alias: Option<String>,
        #[garde(skip)]
        ports: Vec<u16>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        created: usize,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "node" = uuid::Uuid,
            description = "The node ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        node: GetNode,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("nodes.allocations")?;

        let allocation_ip = data.ip.into();
        let mut futures = Vec::new();
        futures.reserve_exact(data.ports.len());

        for port in data.ports.iter().copied() {
            if port < 1024 {
                continue;
            }

            futures.push(NodeAllocation::create(
                &state.database,
                node.uuid,
                &allocation_ip,
                data.ip_alias.as_deref(),
                port as i32,
            ));
        }

        let results = futures_util::future::join_all(futures).await;
        let created = results.iter().filter(|r| r.is_ok()).count();

        activity_logger
            .log(
                "node:allocation.create",
                serde_json::json!({
                    "node_uuid": node.uuid,

                    "ip": allocation_ip,
                    "ip_alias": data.ip_alias,
                    "ports": data.ports,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response { created }).ok()
    }
}

mod patch {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            admin_activity::GetAdminActivityLogger, node::GetNode, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(skip)]
        uuids: Vec<uuid::Uuid>,

        #[garde(skip)]
        #[schema(value_type = String)]
        ip: std::net::IpAddr,
        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        #[serde(default, with = "::serde_with::rust::double_option")]
        ip_alias: Option<Option<String>>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        updated: u64,
    }

    #[utoipa::path(patch, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "node" = uuid::Uuid,
            description = "The node ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        node: GetNode,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("nodes.allocations")?;

        let allocation_ip: sqlx::types::ipnetwork::IpNetwork = data.ip.into();
        let updated = if let Some(ip_alias) = &data.ip_alias {
            sqlx::query!(
                "UPDATE node_allocations
                SET ip = $3, ip_alias = $4
                WHERE node_allocations.node_uuid = $1 AND node_allocations.uuid = ANY($2)",
                node.uuid,
                &data.uuids,
                allocation_ip,
                ip_alias.as_deref()
            )
            .execute(state.database.write())
            .await?
            .rows_affected()
        } else {
            sqlx::query!(
                "UPDATE node_allocations
                SET ip = $3
                WHERE node_allocations.node_uuid = $1 AND node_allocations.uuid = ANY($2)",
                node.uuid,
                &data.uuids,
                allocation_ip
            )
            .execute(state.database.write())
            .await?
            .rows_affected()
        };

        activity_logger
            .log(
                "node:allocation.update",
                serde_json::json!({
                    "node_uuid": node.uuid,

                    "ip": allocation_ip,
                    "ip_alias": data.ip_alias,
                    "uuids": data.uuids
                }),
            )
            .await;

        ApiResponse::new_serialized(Response { updated }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(delete::route))
        .routes(routes!(post::route))
        .routes(routes!(patch::route))
        .nest("/available", available::router(state))
        .with_state(state.clone())
}
