use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use serde::Serialize;
    use shared::{
        GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use sysinfo::System;
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct ResponseCpu<'a> {
        name: &'a str,
        brand: &'a str,
        vendor_id: &'a str,
        frequency_mhz: u64,
        cpu_count: usize,
    }

    #[derive(ToSchema, Serialize)]
    struct ResponseMemory {
        total_bytes: u64,
        free_bytes: u64,
        used_bytes: u64,
        used_bytes_process: u64,
    }

    #[derive(ToSchema, Serialize)]
    struct ResponseCache {
        version: compact_str::CompactString,
        total_calls: u64,
        total_hits: u64,
        total_misses: u64,
        average_call_latency_ns: u64,
        max_call_latency_ns: u64,
    }

    #[derive(ToSchema, Serialize)]
    struct ResponseDatabase {
        version: compact_str::CompactString,
        size_bytes: u64,

        total_read_connections: u32,
        idle_read_connections: usize,
        total_write_connections: u32,
        idle_write_connections: usize,
    }

    #[derive(ToSchema, Serialize)]
    struct Response<'a> {
        version: &'a str,
        container_type: shared::AppContainerType,

        #[schema(inline)]
        cpu: ResponseCpu<'a>,
        #[schema(inline)]
        memory: ResponseMemory,
        #[schema(inline)]
        cache: ResponseCache,
        #[schema(inline)]
        database: ResponseDatabase,

        architecture: &'static str,
        kernel_version: String,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route(state: GetState, permissions: GetPermissionManager) -> ApiResponseResult {
        permissions.has_admin_permission("stats.read")?;

        let mut sys = System::new_all();
        sys.refresh_cpu_all();

        let mut used_bytes_process = 0;
        if let Ok(current_pid) = sysinfo::get_current_pid() {
            sys.refresh_processes_specifics(
                sysinfo::ProcessesToUpdate::Some(&[current_pid]),
                false,
                sysinfo::ProcessRefreshKind::nothing().with_memory(),
            );

            if let Some(process) = sys.process(current_pid) {
                used_bytes_process = process.memory();
            }
        }

        let cpu = &sys.cpus()[0];

        ApiResponse::new_serialized(Response {
            version: &state.version,
            container_type: state.container_type,
            cpu: ResponseCpu {
                name: cpu.name(),
                brand: cpu.brand(),
                vendor_id: cpu.vendor_id(),
                frequency_mhz: cpu.frequency(),
                cpu_count: sys.cpus().len(),
            },
            memory: ResponseMemory {
                total_bytes: sys.total_memory(),
                free_bytes: sys.free_memory(),
                used_bytes: sys.used_memory(),
                used_bytes_process,
            },
            cache: ResponseCache {
                version: state
                    .cache
                    .version()
                    .await
                    .unwrap_or_else(|_| "unknown".into()),
                total_calls: state.cache.cache_calls(),
                total_hits: state.cache.cache_calls() - state.cache.cache_misses(),
                total_misses: state.cache.cache_misses(),
                average_call_latency_ns: state.cache.cache_latency_ns_average(),
                max_call_latency_ns: state.cache.cache_latency_ns_max(),
            },
            database: ResponseDatabase {
                version: state
                    .database
                    .version()
                    .await
                    .unwrap_or_else(|_| "unknown".into()),
                size_bytes: state.database.size().await.unwrap_or(0),
                total_read_connections: state.database.read().size(),
                idle_read_connections: state.database.read().num_idle(),
                total_write_connections: state.database.write().size(),
                idle_write_connections: state.database.write().num_idle(),
            },
            architecture: std::env::consts::ARCH,
            kernel_version: System::kernel_long_version(),
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
