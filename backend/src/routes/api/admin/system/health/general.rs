use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use serde::{Deserialize, Serialize};
    use shared::{
        GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use std::{collections::BTreeMap, sync::Arc};
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize, Deserialize)]
    struct ResponseMigrationsExtension {
        total: usize,
        applied: usize,
    }

    #[derive(ToSchema, Serialize)]
    struct ResponseMigrations {
        total: usize,
        applied: usize,
        #[schema(inline)]
        extensions: BTreeMap<compact_str::CompactString, ResponseMigrationsExtension>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response<'a> {
        local_time: chrono::DateTime<chrono::Local>,
        #[schema(value_type = BTreeMap<String, shared::ntp::NtpOffset>)]
        ntp_offsets: &'a BTreeMap<std::net::SocketAddr, shared::ntp::NtpOffset>,

        #[schema(inline)]
        migrations: ResponseMigrations,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route(state: GetState, permissions: GetPermissionManager) -> ApiResponseResult {
        permissions.has_admin_permission("stats.read")?;

        let applied_migrations =
            Arc::new(database_migrator::fetch_applied_migrations(state.database.read()).await?);

        let (migrations, extension_migrations) = tokio::try_join!(
            state
                .cache
                .cached("health::embedded_migrations", 300, || async {
                    let applied_migrations = applied_migrations.clone();

                    tokio::task::spawn_blocking(move || {
                        let migrations = database_migrator::collect_embedded_migrations()?;

                        Ok::<_, anyhow::Error>(ResponseMigrationsExtension {
                            total: migrations.len(),
                            applied: migrations
                                .iter()
                                .filter(|m| {
                                    applied_migrations.iter().any(|am| am.id == m.snapshot.id)
                                })
                                .count(),
                        })
                    })
                    .await?
                }),
            state
                .cache
                .cached("health::embedded_extension_migrations", 300, || async {
                    let state = state.0.clone();
                    let applied_migrations = applied_migrations.clone();

                    tokio::task::spawn_blocking(move || {
                        let mut extensions = BTreeMap::new();

                        for extension in state.extensions.blocking_extensions().iter() {
                            let migrations =
                                match database_migrator::collect_embedded_extension_migrations(
                                    &extension.metadata_toml.get_package_identifier(),
                                ) {
                                    Ok(migrations) => migrations,
                                    Err(err) => {
                                        tracing::warn!(
                                            extension = %extension.package_name,
                                            "failed to collect migrations for extension: {:#?}",
                                            err
                                        );
                                        continue;
                                    }
                                };

                            extensions.insert(
                                extension.package_name.into(),
                                ResponseMigrationsExtension {
                                    total: migrations.len(),
                                    applied: migrations
                                        .iter()
                                        .filter(|m| {
                                            applied_migrations.iter().any(|am| am.id == m.id)
                                        })
                                        .count(),
                                },
                            );
                        }

                        Ok::<_, anyhow::Error>(extensions)
                    })
                    .await?
                }),
        )?;

        ApiResponse::new_serialized(Response {
            local_time: chrono::Local::now(),
            ntp_offsets: &*state.ntp.get_last_result().await,
            migrations: ResponseMigrations {
                total: migrations.total,
                applied: migrations.applied,
                extensions: extension_migrations,
            },
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
