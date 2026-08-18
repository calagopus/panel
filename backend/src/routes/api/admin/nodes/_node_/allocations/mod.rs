use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod available;
mod ips;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoAdminApiObject, Pagination, PaginationParams,
            node::GetNode,
            node_allocation::{AllocationFilter, NodeAllocation},
            user::GetPermissionManager,
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
        (
            "ip" = Option<String>, Query,
            description = "Only include allocations on this IP",
            example = "10.0.0.5",
        ),
        (
            "port_from" = Option<i32>, Query,
            description = "Only include allocations with a port at or above this",
            example = "25565",
        ),
        (
            "port_to" = Option<i32>, Query,
            description = "Only include allocations with a port at or below this",
            example = "25600",
        ),
        (
            "assigned" = Option<bool>, Query,
            description = "Only include allocations that are assigned to a server, or only those that are not",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        node: GetNode,
        Query(params): Query<PaginationParams>,
        Query(filter): Query<AllocationFilter>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }
        if let Err(errors) = shared::utils::validate_data(&filter) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("nodes.allocations")?;

        let allocations = NodeAllocation::by_node_uuid_with_pagination(
            &state.database,
            node.uuid,
            &filter,
            params.page,
            params.per_page,
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
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            admin_activity::GetAdminActivityLogger,
            node::GetNode,
            node_allocation::{AllocationSelector, NodeAllocation},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(dive)]
        selector: AllocationSelector,
        #[garde(skip)]
        #[serde(default)]
        force: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        deleted: i64,
        skipped: i64,
    }

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = CONFLICT, body = ApiError),
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

        let (matched, deleted) = NodeAllocation::delete_by_selector(
            &state.database,
            node.uuid,
            &data.selector,
            data.force,
        )
        .await?;

        if deleted == 0 && matched > 0 {
            return ApiResponse::error(
                "every matched allocation is assigned to a server, force deletion to remove them anyway",
            )
            .with_status(StatusCode::CONFLICT)
            .ok();
        }

        let skipped = matched - deleted;

        activity_logger
            .log(
                "node:allocation.delete",
                serde_json::json!({
                    "node_uuid": node.uuid,

                    "selector": data.selector,
                    "force": data.force,
                    "deleted": deleted,
                    "skipped": skipped,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response { deleted, skipped }).ok()
    }
}

mod post {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            admin_activity::GetAdminActivityLogger,
            node::GetNode,
            node_allocation::{CREATE_MAX_PORTS, NodeAllocation},
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
        #[garde(length(min = 1, max = CREATE_MAX_PORTS))]
        #[schema(min_items = 1, max_items = 65535)]
        ports: Vec<u16>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        created: u64,
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
        let ports: Vec<i32> = data
            .ports
            .iter()
            .copied()
            .filter(|port| *port != 0)
            .map(i32::from)
            .collect();

        let created = NodeAllocation::create_many(
            &state.database,
            node.uuid,
            &allocation_ip,
            data.ip_alias.as_deref(),
            &ports,
        )
        .await?;

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
            admin_activity::GetAdminActivityLogger,
            node::GetNode,
            node_allocation::{AllocationSelector, NodeAllocation},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(dive)]
        selector: AllocationSelector,

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
        updated: i64,
        skipped: i64,
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
        let (matched, updated) = NodeAllocation::update_by_selector(
            &state.database,
            node.uuid,
            &data.selector,
            &allocation_ip,
            data.ip_alias.as_ref().map(Option::as_deref),
        )
        .await?;

        let skipped = matched - updated;

        activity_logger
            .log(
                "node:allocation.update",
                serde_json::json!({
                    "node_uuid": node.uuid,

                    "ip": allocation_ip,
                    "ip_alias": data.ip_alias,
                    "selector": data.selector,
                    "updated": updated,
                    "skipped": skipped,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response { updated, skipped }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(delete::route))
        .routes(routes!(post::route))
        .routes(routes!(patch::route))
        .nest("/available", available::router(state))
        .nest("/ips", ips::router(state))
        .with_state(state.clone())
}
