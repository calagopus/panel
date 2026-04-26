use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use axum::{extract::Query, http::StatusCode};
    use compact_str::ToCompactString;
    use futures_util::{StreamExt, TryStreamExt};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            ByUuid, IntoAdminApiObject, Pagination, PaginationParams, node::Node,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
        updates::ParsedVersionInformation,
    };
    use std::str::FromStr;
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct ResponseNode {
        version: compact_str::CompactString,
        node: shared::models::node::AdminApiNode,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        outdated_nodes: Pagination<ResponseNode>,
        failed_nodes: usize,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
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
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        Query(params): Query<PaginationParams>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("nodes.read")?;

        let Some(update_information) = state.updates.get_update_information().await else {
            return ApiResponse::error("no update information available, try triggering a recheck")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        };

        let (node_versions, failed_nodes) = state
            .cache
            .cached("nodes::versions", 30, || async {
                let mut versions = Vec::new();
                let mut failed_nodes = 0;

                let mut node_page = 1;
                loop {
                    let nodes =
                        Node::all_with_pagination(&state.database, node_page, 50, None).await?;
                    if nodes.data.is_empty() {
                        break;
                    }

                    let mut versions_futures = Vec::new();
                    for node in &nodes.data {
                        let client = node.api_client(&state.database).await?;
                        versions_futures.push(async move {
                            let overview = tokio::time::timeout(
                                std::time::Duration::from_secs(2),
                                client.get_system_overview(),
                            )
                            .await??;

                            Ok::<_, anyhow::Error>((
                                node.uuid,
                                ParsedVersionInformation::from_str(&overview.version)?,
                            ))
                        });
                    }

                    let mut futures_stream =
                        futures_util::stream::iter(versions_futures).buffer_unordered(10);

                    while let Some(result) = futures_stream.next().await {
                        match result {
                            Ok((node_uuid, version)) => {
                                let Some(created) = nodes
                                    .data
                                    .iter()
                                    .find(|n| n.uuid == node_uuid)
                                    .map(|n| n.created)
                                else {
                                    continue;
                                };

                                versions.push((node_uuid, created, version));
                            }
                            Err(err) => {
                                tracing::warn!(
                                    "failed to get system overview for a node: {:#?}",
                                    err
                                );
                                failed_nodes += 1;
                            }
                        }
                    }

                    node_page += 1;
                }

                versions.sort_unstable_by_key(|a| a.1);

                Ok::<_, anyhow::Error>((versions, failed_nodes))
            })
            .await?;

        let mut outdated_node_uuids = Vec::new();
        for (node_uuid, _, version) in node_versions {
            if version.version < update_information.latest_wings_version {
                outdated_node_uuids.push((node_uuid, version));
            }
        }

        let mut outdated_nodes = Pagination {
            total: outdated_node_uuids.len() as i64,
            per_page: params.per_page,
            page: params.page,
            data: Vec::new(),
        };

        let mut node_futures = Vec::new();

        for (node_uuid, _) in outdated_node_uuids
            .iter()
            .skip(((params.page - 1) * params.per_page) as usize)
            .take(params.per_page as usize)
        {
            node_futures.push(async {
                let node = Node::by_uuid_cached(&state.database, *node_uuid).await?;
                node.into_admin_api_object(&state, ()).await
            });
        }

        let mut futures_stream = futures_util::stream::iter(node_futures).buffered(10);

        while let Some(node) = futures_stream.try_next().await? {
            let version = match outdated_node_uuids
                .iter()
                .find(|(uuid, _)| *uuid == node.uuid)
            {
                Some((_, version)) => version,
                None => continue,
            };

            outdated_nodes.data.push(ResponseNode {
                version: version.to_compact_string(),
                node,
            });
        }

        ApiResponse::new_serialized(Response {
            outdated_nodes,
            failed_nodes,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
