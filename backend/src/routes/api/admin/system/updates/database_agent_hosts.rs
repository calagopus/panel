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
            ByUuid, IntoAdminApiObject, Pagination, PaginationParams,
            database_agent_host::DatabaseAgentHost, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
        updates::ParsedVersionInformation,
    };
    use std::str::FromStr;
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct ResponseDatabaseAgentHost {
        version: compact_str::CompactString,
        database_agent_host: shared::models::database_agent_host::AdminApiDatabaseAgentHost,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        outdated_database_agent_hosts: Pagination<ResponseDatabaseAgentHost>,
        failed_database_agent_hosts: usize,
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

        permissions.has_admin_permission("database-agent-hosts.read")?;

        let Some(update_information) = state.updates.get_update_information().await else {
            return ApiResponse::error("no update information available, try triggering a recheck")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        };

        let (host_versions, failed_database_agent_hosts) = state
            .cache
            .cached("database_agent_hosts::versions", 30, || async {
                let mut versions = Vec::new();
                let mut failed_hosts = 0;

                let mut host_page = 1;
                loop {
                    let hosts = DatabaseAgentHost::all_with_pagination(
                        &state.database,
                        host_page,
                        50,
                        None,
                    )
                    .await?;
                    if hosts.data.is_empty() {
                        break;
                    }

                    let mut versions_futures = Vec::new();
                    for host in &hosts.data {
                        let client = host.api_client(&state.database).await?;
                        versions_futures.push(async move {
                            let overview = tokio::time::timeout(
                                std::time::Duration::from_secs(2),
                                client.get_system_overview(),
                            )
                            .await??;

                            Ok::<_, anyhow::Error>((
                                host.uuid,
                                ParsedVersionInformation::from_str(&overview.version)?,
                            ))
                        });
                    }

                    let mut futures_stream =
                        futures_util::stream::iter(versions_futures).buffer_unordered(10);

                    while let Some(result) = futures_stream.next().await {
                        match result {
                            Ok((host_uuid, version)) => {
                                let Some(created) = hosts
                                    .data
                                    .iter()
                                    .find(|h| h.uuid == host_uuid)
                                    .map(|h| h.created)
                                else {
                                    continue;
                                };

                                versions.push((host_uuid, created, version));
                            }
                            Err(err) => {
                                tracing::warn!(
                                    "failed to get system overview for a database agent host: {:#?}",
                                    err
                                );
                                failed_hosts += 1;
                            }
                        }
                    }

                    host_page += 1;
                }

                versions.sort_unstable_by_key(|a| a.1);

                Ok::<_, anyhow::Error>((versions, failed_hosts))
            })
            .await?;

        let mut outdated_host_uuids = Vec::new();
        for (host_uuid, _, version) in host_versions {
            if version.version < update_information.latest_db_agent_version {
                outdated_host_uuids.push((host_uuid, version));
            }
        }

        let mut outdated_database_agent_hosts = Pagination {
            total: outdated_host_uuids.len() as i64,
            per_page: params.per_page,
            page: params.page,
            data: Vec::new(),
        };

        let mut host_futures = Vec::new();

        for (host_uuid, _) in outdated_host_uuids
            .iter()
            .skip(((params.page - 1) * params.per_page) as usize)
            .take(params.per_page as usize)
        {
            host_futures.push(async {
                let host = DatabaseAgentHost::by_uuid_cached(&state.database, *host_uuid).await?;
                host.into_admin_api_object(&state, ()).await
            });
        }

        let mut futures_stream = futures_util::stream::iter(host_futures).buffered(10);

        while let Some(host) = futures_stream.try_next().await? {
            let version = match outdated_host_uuids
                .iter()
                .find(|(uuid, _)| *uuid == host.uuid)
            {
                Some((_, version)) => version,
                None => continue,
            };

            outdated_database_agent_hosts
                .data
                .push(ResponseDatabaseAgentHost {
                    version: version.to_compact_string(),
                    database_agent_host: host,
                });
        }

        ApiResponse::new_serialized(Response {
            outdated_database_agent_hosts,
            failed_database_agent_hosts,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
