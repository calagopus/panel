use futures_util::StreamExt;
use rand::RngExt;
use shared::models::{
    ByUuid, CreatableModel,
    admin_activity::AdminActivity,
    announcement::Announcement,
    backup_configuration::BackupConfiguration,
    egg_repository::EggRepository,
    node::Node,
    oauth_provider_mapping::OAuthProviderMapping,
    server_activity::{CreateServerActivityOptions, ServerActivity},
    server_backup::{BackupDisk, CreateServerBackupOptions, ServerBackup, ServerBackupKind},
    server_database_instance::ServerDatabaseInstance,
    system_backup_policy::SystemBackupPolicy,
    system_backup_policy_run::SystemBackupPolicyRun,
    system_backup_policy_run_target::{
        SystemBackupPolicyRunTarget, SystemBackupPolicyRunTargetClaim,
        SystemBackupPolicyRunTargetReason, SystemBackupPolicyRunTargetStatus,
    },
    user_activity::UserActivity,
    user_api_key::UserApiKey,
    user_email_verification::UserEmailVerification,
    user_password_reset::UserPasswordReset,
    user_security_key::UserSecurityKey,
    user_server_group::UserServerGroup,
    user_session::UserSession,
    user_two_factor_code::UserTwoFactorCode,
};
use std::str::FromStr;

async fn database_instance_running(
    state: &shared::State,
    database_instance: &ServerDatabaseInstance,
) -> bool {
    let api_client = match database_instance
        .database_agent_host
        .api_client(&state.database)
        .await
    {
        Ok(api_client) => api_client,
        Err(err) => {
            tracing::warn!(
                database_instance = %database_instance.uuid,
                "failed to create database agent client for system backup: {err:#?}"
            );

            return false;
        }
    };

    match api_client
        .get_instances_instance_utilization(database_instance.uuid)
        .await
    {
        Ok(utilization) => matches!(
            utilization.utilization.state,
            db_agent_api::ContainerState::Running
        ),
        Err(err) => {
            tracing::debug!(
                database_instance = %database_instance.uuid,
                "failed to load database instance utilization for system backup: {err:#?}"
            );

            false
        }
    }
}

enum SystemBackupTargetOutcome {
    Dispatched(uuid::Uuid),
    Deferred(Option<SystemBackupPolicyRunTargetReason>),
    Skipped(SystemBackupPolicyRunTargetReason),
    Failed(SystemBackupPolicyRunTargetReason),
}

async fn dispatch_system_backup_target(
    state: &shared::State,
    policy: &SystemBackupPolicy,
    claim: &SystemBackupPolicyRunTargetClaim,
) -> SystemBackupTargetOutcome {
    if let Some(existing_server_backup) = &claim.existing_server_backup {
        return SystemBackupTargetOutcome::Dispatched(existing_server_backup.uuid);
    }

    let Some(server) = &claim.server else {
        return SystemBackupTargetOutcome::Skipped(
            SystemBackupPolicyRunTargetReason::TargetRemoved,
        );
    };
    if policy.kind == ServerBackupKind::DatabaseInstance && claim.database_instance.is_none() {
        return SystemBackupTargetOutcome::Skipped(
            SystemBackupPolicyRunTargetReason::TargetRemoved,
        );
    }

    let server = match server.fetch_optional(&state.database).await {
        Ok(Some(server)) => server,
        Ok(None) => {
            return SystemBackupTargetOutcome::Skipped(
                SystemBackupPolicyRunTargetReason::TargetRemoved,
            );
        }
        Err(err) => {
            tracing::warn!(
                server = %server.uuid,
                "failed to load server for system backup: {err:#?}"
            );
            return SystemBackupTargetOutcome::Deferred(None);
        }
    };
    if server.status.is_some() || server.destination_node.is_some() {
        return SystemBackupTargetOutcome::Deferred(Some(
            SystemBackupPolicyRunTargetReason::ServerBusy,
        ));
    }

    let node = match server.node.fetch_cached(&state.database).await {
        Ok(node) => node,
        Err(err) => {
            tracing::warn!(
                server = %server.uuid,
                "failed to load node for system backup: {err:#?}"
            );
            return SystemBackupTargetOutcome::Deferred(None);
        }
    };
    if node.maintenance_enabled {
        return SystemBackupTargetOutcome::Deferred(Some(
            SystemBackupPolicyRunTargetReason::NodeMaintenance,
        ));
    }

    let database_instance = match &claim.database_instance {
        Some(database_instance) => {
            match ServerDatabaseInstance::by_server_uuid_uuid(
                &state.database,
                server.uuid,
                database_instance.uuid,
            )
            .await
            {
                Ok(Some(database_instance)) => Some(database_instance),
                Ok(None) => {
                    return SystemBackupTargetOutcome::Skipped(
                        SystemBackupPolicyRunTargetReason::TargetRemoved,
                    );
                }
                Err(err) => {
                    tracing::warn!(
                        database_instance = %database_instance.uuid,
                        "failed to load database instance for system backup: {err:#?}"
                    );
                    return SystemBackupTargetOutcome::Deferred(None);
                }
            }
        }
        None => None,
    };
    if let Some(database_instance) = &database_instance {
        if database_instance.status.is_some() {
            return SystemBackupTargetOutcome::Deferred(Some(
                SystemBackupPolicyRunTargetReason::ServerBusy,
            ));
        }
        if database_instance.database_agent_host.maintenance_enabled {
            return SystemBackupTargetOutcome::Deferred(Some(
                SystemBackupPolicyRunTargetReason::DatabaseAgentHostMaintenance,
            ));
        }
    }

    let backup_configuration = match &policy.backup_configuration {
        Some(backup_configuration) => {
            match backup_configuration.fetch_cached(&state.database).await {
                Ok(backup_configuration) => Some(backup_configuration),
                Err(err) => {
                    tracing::warn!(
                        policy = %policy.uuid,
                        "failed to load backup configuration for system backup policy: {err:#?}"
                    );
                    return SystemBackupTargetOutcome::Deferred(None);
                }
            }
        }
        None => server.backup_configuration(&state.database).await,
    };
    let Some(backup_configuration) = backup_configuration else {
        return SystemBackupTargetOutcome::Skipped(
            SystemBackupPolicyRunTargetReason::NoBackupConfiguration,
        );
    };
    if backup_configuration.maintenance_enabled {
        return SystemBackupTargetOutcome::Deferred(Some(
            SystemBackupPolicyRunTargetReason::BackupConfigurationMaintenance,
        ));
    }

    let metadata = match &database_instance {
        Some(database_instance) => {
            if matches!(
                backup_configuration.backup_disk,
                BackupDisk::Btrfs | BackupDisk::Zfs
            ) {
                return SystemBackupTargetOutcome::Skipped(
                    SystemBackupPolicyRunTargetReason::UnsupportedBackupDisk,
                );
            }

            if !database_instance_running(state, database_instance).await {
                return SystemBackupTargetOutcome::Deferred(Some(
                    SystemBackupPolicyRunTargetReason::DatabaseInstanceStopped,
                ));
            }

            ServerBackup::generate_database_metadata(database_instance)
        }
        None => match ServerBackup::generate_metadata(state, &server).await {
            Ok(metadata) => metadata,
            Err(err) => {
                tracing::warn!(
                    server = %server.uuid,
                    "failed to generate metadata for system backup: {err:#?}"
                );
                return SystemBackupTargetOutcome::Deferred(Some(
                    SystemBackupPolicyRunTargetReason::MetadataFailed,
                ));
            }
        },
    };

    let options = CreateServerBackupOptions {
        server: &server,
        name: ServerBackup::default_name(),
        backup_group_uuid: None,
        system_backup_policy_uuid: Some(policy.uuid),
        database_instance: database_instance.as_ref(),
        backup_configuration: Some(backup_configuration),
        ignored_files: Vec::new(),
        metadata,
    };
    let backup = match ServerBackup::create(state, options).await {
        Ok(backup) => backup,
        Err(err) => {
            tracing::error!(
                server = %server.uuid,
                policy = %policy.uuid,
                "failed to create system backup: {err:#?}"
            );
            return SystemBackupTargetOutcome::Failed(
                SystemBackupPolicyRunTargetReason::CreateFailed,
            );
        }
    };

    let (event, data) = match &database_instance {
        Some(database_instance) => (
            "server:database-backup.create",
            serde_json::json!({
                "source": "system-backup-policy",
                "uuid": backup.uuid,
                "name": backup.name,
                "policy": policy.name,
                "database_instance_uuid": database_instance.uuid,
                "database_instance_name": database_instance.name,
            }),
        ),
        None => (
            "server:backup.create",
            serde_json::json!({
                "source": "system-backup-policy",
                "uuid": backup.uuid,
                "name": backup.name,
                "policy": policy.name,
            }),
        ),
    };

    if let Err(err) = ServerActivity::create(
        state,
        CreateServerActivityOptions {
            server_uuid: server.uuid,
            user_uuid: None,
            impersonator_uuid: None,
            api_key_uuid: None,
            schedule_uuid: None,
            event: event.into(),
            ip: None,
            data,
            created: None,
        },
    )
    .await
    {
        tracing::warn!(
            server = %server.uuid,
            "failed to log system backup creation activity: {err:#?}"
        );
    }

    SystemBackupTargetOutcome::Dispatched(backup.uuid)
}

async fn record_system_backup_target_outcome(
    state: &shared::State,
    claim: &SystemBackupPolicyRunTargetClaim,
    outcome: SystemBackupTargetOutcome,
) -> Result<(), sqlx::Error> {
    const RETRY_DELAY: chrono::TimeDelta = chrono::TimeDelta::minutes(2);

    match outcome {
        SystemBackupTargetOutcome::Dispatched(server_backup_uuid) => {
            SystemBackupPolicyRunTarget::set_dispatched(
                &state.database,
                claim.uuid,
                server_backup_uuid,
            )
            .await
        }
        SystemBackupTargetOutcome::Deferred(reason) => {
            SystemBackupPolicyRunTarget::set_deferred(
                &state.database,
                claim.uuid,
                reason,
                (chrono::Utc::now() + RETRY_DELAY).naive_utc(),
            )
            .await
        }
        SystemBackupTargetOutcome::Skipped(reason) => {
            SystemBackupPolicyRunTarget::set_resolved(
                &state.database,
                claim.uuid,
                SystemBackupPolicyRunTargetStatus::Skipped,
                reason,
            )
            .await
        }
        SystemBackupTargetOutcome::Failed(reason) => {
            SystemBackupPolicyRunTarget::set_resolved(
                &state.database,
                claim.uuid,
                SystemBackupPolicyRunTargetStatus::Failed,
                reason,
            )
            .await
        }
    }
}

pub async fn define_background_tasks(
    background_task_builder: &shared::extensions::background_tasks::BackgroundTaskBuilder,
) {
    background_task_builder
        .add_task("collect_telemetry", async |state| {
            fn generate_randomized_cron_schedule() -> croner::Cron {
                let mut rng = rand::rng();
                let seconds: u8 = rng.random_range(0..60);
                let minutes: u8 = rng.random_range(0..60);
                let hours: u8 = rng.random_range(0..24);

                format!("{} {} {} * * *", seconds, minutes, hours)
                    .parse()
                    .unwrap()
            }

            let settings = state.settings.get().await?;
            if !settings.app.telemetry_enabled {
                drop(settings);
                tokio::time::sleep(std::time::Duration::from_mins(60)).await;

                return Ok(());
            }
            let cron_schedule = settings
                .telemetry_cron_schedule
                .clone()
                .unwrap_or_else(generate_randomized_cron_schedule);
            if settings.telemetry_cron_schedule.is_none() {
                drop(settings);
                let mut new_settings = state.settings.get_mut().await?;
                new_settings.telemetry_cron_schedule = Some(cron_schedule.clone());
                new_settings.save().await?;
            } else {
                drop(settings);
            }

            let schedule_iter = cron_schedule.iter_after(chrono::Utc::now());

            for target_datetime in schedule_iter {
                let target_timestamp = target_datetime.timestamp();
                let now_timestamp = chrono::Utc::now().timestamp();
                let sleep_duration = target_timestamp - now_timestamp;
                if sleep_duration <= 0 {
                    tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                    continue;
                }

                tokio::time::sleep(std::time::Duration::from_secs(sleep_duration as u64)).await;

                let telemetry_data = match shared::telemetry::TelemetryData::collect(&state).await {
                    Ok(data) => data,
                    Err(err) => {
                        tracing::error!("failed to collect telemetry data: {:#?}", err);
                        continue;
                    }
                };

                if let Err(err) = state
                    .client
                    .post("https://calagopus.com/api/telemetry")
                    .json(&telemetry_data)
                    .send()
                    .await
                {
                    tracing::error!("failed to send telemetry data: {:#?}", err);
                } else {
                    tracing::info!("successfully sent telemetry data");
                }
            }

            Ok(())
        })
        .await;
    background_task_builder
        .add_cron_task(
            "delete_expired_sessions",
            croner::Cron::from_str("0 */5 * * * *").unwrap(),
            async |state| {
                let session_duration = state
                    .settings
                    .get_as(|s| s.app.session_duration_seconds)
                    .await?;

                let deleted_sessions =
                    UserSession::delete_unused(&state.database, session_duration as i64).await?;
                if deleted_sessions > 0 {
                    tracing::info!("deleted {} expired user sessions", deleted_sessions);
                }

                Ok(())
            },
        )
        .await;
    background_task_builder
        .add_cron_task(
            "delete_expired_api_keys",
            croner::Cron::from_str("0 */30 * * * *").unwrap(),
            async |state| {
                let deleted_api_keys = UserApiKey::delete_expired(&state.database).await?;
                if deleted_api_keys > 0 {
                    tracing::info!("deleted {} expired user api keys", deleted_api_keys);
                }

                Ok(())
            },
        )
        .await;
    background_task_builder
        .add_cron_task(
            "delete_expired_email_verifications",
            croner::Cron::from_str("0 */30 * * * *").unwrap(),
            async |state| {
                let deleted_email_verifications =
                    UserEmailVerification::delete_expired(&state.database).await?;
                if deleted_email_verifications > 0 {
                    tracing::info!(
                        "deleted {} expired user email verifications",
                        deleted_email_verifications
                    );
                }

                Ok(())
            },
        )
        .await;
    background_task_builder
        .add_cron_task(
            "delete_expired_two_factor_codes",
            croner::Cron::from_str("0 */5 * * * *").unwrap(),
            async |state| {
                let deleted_two_factor_codes =
                    UserTwoFactorCode::delete_expired(&state.database).await?;
                if deleted_two_factor_codes > 0 {
                    tracing::info!(
                        "deleted {} expired user two factor codes",
                        deleted_two_factor_codes
                    );
                }

                Ok(())
            },
        )
        .await;
    background_task_builder
        .add_cron_task(
            "delete_expired_password_resets",
            croner::Cron::from_str("0 */30 * * * *").unwrap(),
            async |state| {
                let deleted_password_resets =
                    UserPasswordReset::delete_expired(&state.database).await?;
                if deleted_password_resets > 0 {
                    tracing::info!(
                        "deleted {} expired user password resets",
                        deleted_password_resets
                    );
                }

                Ok(())
            },
        )
        .await;
    background_task_builder
        .add_cron_task(
            "delete_unconfigured_security_keys",
            croner::Cron::from_str("0 */30 * * * *").unwrap(),
            async |state| {
                let registration_timeout = state
                    .settings
                    .get_as(|s| s.webauthn.registration_timeout_seconds)
                    .await?;

                let deleted_security_keys = UserSecurityKey::delete_unconfigured(
                    &state.database,
                    registration_timeout as i64,
                )
                .await?;
                if deleted_security_keys > 0 {
                    tracing::info!(
                        "deleted {} unconfigured user security keys",
                        deleted_security_keys
                    );
                }

                Ok(())
            },
        )
        .await;
    background_task_builder
        .add_cron_task(
            "cleanup_uuid_arrays",
            croner::Cron::from_str("0 * * * * *").unwrap(),
            async |state| {
                let cleaned_announcements =
                    Announcement::cleanup_uuid_arrays(&state.database).await?;
                if cleaned_announcements > 0 {
                    tracing::info!(
                        "cleaned up {} invalid UUIDs in announcements",
                        cleaned_announcements
                    );
                }

                let cleaned_user_server_groups =
                    UserServerGroup::cleanup_uuid_arrays(&state.database).await?;
                if cleaned_user_server_groups > 0 {
                    tracing::info!(
                        "cleaned up {} invalid UUIDs in user server groups",
                        cleaned_user_server_groups
                    );
                }

                let cleaned_prune_jobs =
                    BackupConfiguration::cleanup_uuid_arrays(&state.database).await?;
                if cleaned_prune_jobs > 0 {
                    tracing::info!(
                        "cleaned up stale node uuids in {} backup configuration prune jobs",
                        cleaned_prune_jobs
                    );
                }

                let cleaned_oauth_provider_mappings =
                    OAuthProviderMapping::cleanup_uuid_arrays(&state.database).await?;
                if cleaned_oauth_provider_mappings > 0 {
                    tracing::info!(
                        "cleaned up {} oauth provider mappings with stale references",
                        cleaned_oauth_provider_mappings
                    );
                }

                let cleaned_ratelimit_exempt_api_keys =
                    state.settings.cleanup_ratelimit_exempt_api_keys().await?;
                if cleaned_ratelimit_exempt_api_keys > 0 {
                    tracing::info!(
                        "cleaned up {} stale api key uuids in ratelimit exemptions",
                        cleaned_ratelimit_exempt_api_keys
                    );
                }

                Ok(())
            },
        )
        .await;
    background_task_builder
        .add_task("run_restic_prune_jobs", async |state| {
            const CHECK_INTERVAL: std::time::Duration = std::time::Duration::from_secs(60);
            const NODE_REQUEST_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(30);

            let mut interval = tokio::time::interval(CHECK_INTERVAL);
            interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

            let mut last_check = chrono::Utc::now();

            loop {
                interval.tick().await;
                let now = chrono::Utc::now();

                let mut page = 1;
                let mut completed = true;

                loop {
                    let backup_configurations = match BackupConfiguration::all_with_pagination(
                        &state.database,
                        page,
                        50,
                        None,
                    )
                    .await
                    {
                        Ok(configs) => configs,
                        Err(err) => {
                            tracing::error!(
                                page,
                                "failed to load backup configurations for prune sweep: {err:#?}"
                            );
                            completed = false;
                            break;
                        }
                    };

                    if backup_configurations.data.is_empty() {
                        break;
                    }

                    for backup_configuration in &backup_configurations.data {
                        if backup_configuration.maintenance_enabled {
                            continue;
                        }

                        let config_uuid = backup_configuration.uuid;
                        let Some(restic) = &backup_configuration.backup_configs.restic else {
                            continue;
                        };
                        if restic.prune_jobs.is_empty() {
                            continue;
                        }

                        let mut due_nodes: std::collections::HashSet<uuid::Uuid> = Default::default();
                        for prune_job in &restic.prune_jobs {
                            let due = prune_job
                                .cron
                                .iter_after(last_check)
                                .next()
                                .is_some_and(|next| next <= now);
                            if due {
                                due_nodes.extend(prune_job.nodes.iter().copied());
                            }
                        }

                        if due_nodes.is_empty() {
                            continue;
                        }

                        let mut restic = restic.clone();
                        if let Err(err) = restic.decrypt(&state.database).await {
                            tracing::error!(
                                backup_configuration = %config_uuid,
                                "failed to decrypt restic configuration for prune job: {err:#?}"
                            );
                            continue;
                        }
                        let configuration = restic.into_wings_configuration();

                        for node_uuid in due_nodes {
                            let node = match Node::by_uuid_optional_cached(&state.database, node_uuid).await {
                                Ok(Some(node)) => node,
                                Ok(None) => continue,
                                Err(err) => {
                                    tracing::warn!(node = %node_uuid, "failed to load node for restic prune job: {err:#?}");
                                    continue;
                                }
                            };

                            let client = match node.api_client(&state.database).await {
                                Ok(client) => client,
                                Err(err) => {
                                    tracing::warn!(node = %node_uuid, "failed to create wings client for restic prune job: {err:#?}");
                                    continue;
                                }
                            };

                            let request_data = wings_api::system_restic_prune::post::RequestBody {
                                configuration: Some(configuration.clone()),
                                dry_run: false,
                                foreground: false,
                            };
                            let request = client.post_system_restic_prune(
                                &request_data
                            );

                            match tokio::time::timeout(NODE_REQUEST_TIMEOUT, request).await {
                                Ok(Ok(_)) => tracing::info!(
                                    node = %node_uuid,
                                    backup_configuration = %config_uuid,
                                    "started restic prune job"
                                ),
                                Ok(Err(err)) => tracing::error!(
                                    node = %node_uuid,
                                    backup_configuration = %config_uuid,
                                    "failed to start restic prune job: {err:#?}"
                                ),
                                Err(_) => tracing::error!(
                                    node = %node_uuid,
                                    backup_configuration = %config_uuid,
                                    "restic prune request timed out"
                                ),
                            }
                        }
                    }

                    if (backup_configurations.data.len() as i64) < backup_configurations.per_page {
                        break;
                    }

                    page += 1;
                }

                if completed {
                    last_check = now;
                }
            }
        })
        .await;
    background_task_builder
        .add_cron_task("delete_old_activity", croner::Cron::from_str("0 */30 * * * *").unwrap(), async |state| {
            let settings = state.settings.get().await?;
            let admin_retention_days = settings.activity.admin_log_retention_days;
            let admin_retention_count = settings.activity.admin_log_retention_count;
            let user_retention_days = settings.activity.user_log_retention_days;
            let user_retention_count = settings.activity.user_log_retention_count;
            let server_retention_days = settings.activity.server_log_retention_days;
            let server_retention_count = settings.activity.server_log_retention_count;
            drop(settings);

            let deleted_admin_activity = AdminActivity::delete_older_than(
                &state.database,
                chrono::Utc::now() - chrono::Duration::days(admin_retention_days as i64),
            )
            .await?;
            if deleted_admin_activity > 0 {
                tracing::info!("deleted {} old admin activity logs", deleted_admin_activity);
            }

            if let Some(admin_retention_count) = admin_retention_count {
                let deleted_admin_activity = AdminActivity::retain_latest_logs(
                    &state.database,
                    admin_retention_count as i64,
                )
                .await?;
                if deleted_admin_activity > 0 {
                    tracing::info!(
                        "deleted {} old admin activity logs to retain latest {} logs",
                        deleted_admin_activity,
                        admin_retention_count
                    );
                }
            }

            let deleted_user_activity = UserActivity::delete_older_than(
                &state.database,
                chrono::Utc::now() - chrono::Duration::days(user_retention_days as i64),
            )
            .await?;
            if deleted_user_activity > 0 {
                tracing::info!("deleted {} old user activity logs", deleted_user_activity);
            }

            if let Some(user_retention_count) = user_retention_count {
                let deleted_user_activity = UserActivity::retain_latest_logs_per_user(
                    &state.database,
                    user_retention_count as i64,
                )
                .await?;
                if deleted_user_activity > 0 {
                    tracing::info!(
                        "deleted {} old user activity logs to retain latest {} logs",
                        deleted_user_activity,
                        user_retention_count
                    );
                }
            }

            let deleted_server_activity = ServerActivity::delete_older_than(
                &state.database,
                chrono::Utc::now() - chrono::Duration::days(server_retention_days as i64),
            )
            .await?;
            if deleted_server_activity > 0 {
                tracing::info!(
                    "deleted {} old server activity logs",
                    deleted_server_activity
                );
            }

            if let Some(server_retention_count) = server_retention_count {
                let deleted_server_activity = ServerActivity::retain_latest_logs_per_server(
                    &state.database,
                    server_retention_count as i64,
                )
                .await?;
                if deleted_server_activity > 0 {
                    tracing::info!(
                        "deleted {} old server activity logs to retain latest {} logs per server",
                        deleted_server_activity,
                        server_retention_count
                    );
                }
            }

            Ok(())
        })
        .await;
    background_task_builder
        .add_cron_task(
            "redispatch_stale_backup_deletions",
            croner::Cron::from_str("0 * * * * *").unwrap(),
            async |state| {
                let redispatched =
                    shared::models::server_backup::ServerBackup::redispatch_stale_deletions(&state)
                        .await?;
                if redispatched > 0 {
                    tracing::info!("retried {} pending backup deletions", redispatched);
                }

                Ok(())
            },
        )
        .await;
    background_task_builder
        .add_cron_task(
            "flush_permission_invalidations",
            croner::Cron::from_str("*/10 * * * * *").unwrap(),
            async |state| {
                Node::flush_due_permission_invalidations(&state.database).await?;

                Ok(())
            },
        )
        .await;
    background_task_builder
        .add_cron_task(
            "prune_backup_groups",
            croner::Cron::from_str("0 0 * * * *").unwrap(),
            async |state| {
                let pruned =
                    shared::models::server_backup::ServerBackup::prune_group_backups(&state)
                        .await?;
                if pruned > 0 {
                    tracing::info!("pruned {} backups outside their group retention", pruned);
                }

                Ok(())
            },
        )
        .await;
    background_task_builder
        .add_cron_task(
            "sync_egg_repositories",
            croner::Cron::from_str("0 0 3 * * *").unwrap(),
            async |state| {
                for egg_repository in EggRepository::all_auto_sync(&state.database).await? {
                    match egg_repository.sync(&state).await {
                        Ok(found) => tracing::info!(
                            egg_repository = %egg_repository.uuid,
                            "synced egg repository {}, found {} eggs",
                            egg_repository.name,
                            found
                        ),
                        Err(err) => tracing::error!(
                            egg_repository = %egg_repository.uuid,
                            "failed to sync egg repository {}: {:#?}",
                            egg_repository.name,
                            err
                        ),
                    }
                }

                Ok(())
            },
        )
        .await;
    background_task_builder
        .add_cron_task(
            "prune_ungrouped_backups",
            croner::Cron::from_str("0 15 * * * *").unwrap(),
            async |state| {
                let pruned =
                    shared::models::server_backup::ServerBackup::prune_ungrouped_backups(&state)
                        .await?;
                if pruned > 0 {
                    tracing::info!("pruned {} failed ungrouped backups", pruned);
                }

                Ok(())
            },
        )
        .await;
    background_task_builder
        .add_task("run_system_backup_policies", async |state| {
            const CHECK_INTERVAL: std::time::Duration = std::time::Duration::from_secs(60);
            const CLAIM_LIMIT: i64 = 256;
            const MAX_CLAIMS_PER_TICK: usize = 16;
            const DISPATCH_CONCURRENCY: usize = 8;

            let mut interval = tokio::time::interval(CHECK_INTERVAL);
            interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

            loop {
                interval.tick().await;
                let now = chrono::Utc::now();

                let policies = match SystemBackupPolicy::all_schedulable(&state.database).await {
                    Ok(policies) => policies,
                    Err(err) => {
                        tracing::error!(
                            "failed to load system backup policies for scheduling: {err:#?}"
                        );
                        continue;
                    }
                };

                for policy in policies {
                    if policy.enabled {
                        if let Some(occurrence) = policy.cron.iter_before(now).next()
                            && occurrence.naive_utc() >= policy.created
                            && let Err(err) = SystemBackupPolicyRun::create(
                                &state.database,
                                &policy,
                                false,
                                occurrence.naive_utc(),
                            )
                            .await
                        {
                            tracing::error!(
                                policy = %policy.uuid,
                                "failed to start system backup policy run: {err:#?}"
                            );
                        }
                    } else if let Err(err) =
                        SystemBackupPolicyRun::skip_pending_scheduled_by_system_backup_policy_uuid(
                            &state.database,
                            policy.uuid,
                            SystemBackupPolicyRunTargetReason::PolicyDisabled,
                        )
                        .await
                    {
                        tracing::error!(
                            policy = %policy.uuid,
                            "failed to skip scheduled targets of disabled system backup policy: {err:#?}"
                        );
                    }

                    for _ in 0..MAX_CLAIMS_PER_TICK {
                        let claims = match SystemBackupPolicyRunTarget::claimable(
                            &state.database,
                            policy.uuid,
                            policy.kind,
                            policy.parallelism,
                            CLAIM_LIMIT,
                        )
                        .await
                        {
                            Ok(claims) => claims,
                            Err(err) => {
                                tracing::error!(
                                    policy = %policy.uuid,
                                    "failed to claim system backup policy run targets: {err:#?}"
                                );
                                break;
                            }
                        };
                        let claimed = claims.len() as i64;

                        futures_util::stream::iter(claims)
                            .for_each_concurrent(DISPATCH_CONCURRENCY, |claim| {
                                let state = &state;
                                let policy = &policy;

                                async move {
                                    let outcome =
                                        dispatch_system_backup_target(state, policy, &claim).await;
                                    if let Err(err) =
                                        record_system_backup_target_outcome(state, &claim, outcome)
                                            .await
                                    {
                                        tracing::error!(
                                            policy = %policy.uuid,
                                            target = %claim.uuid,
                                            "failed to record system backup policy run target outcome: {err:#?}"
                                        );
                                    }
                                }
                            })
                            .await;

                        if claimed < CLAIM_LIMIT {
                            break;
                        }
                    }

                    let runs = match SystemBackupPolicyRun::open_by_system_backup_policy_uuid(
                        &state.database,
                        policy.uuid,
                    )
                    .await
                    {
                        Ok(runs) => runs,
                        Err(err) => {
                            tracing::error!(
                                policy = %policy.uuid,
                                "failed to load open system backup policy runs: {err:#?}"
                            );
                            continue;
                        }
                    };

                    for run in runs {
                        if run.pending_targets == 0
                            && run.running_targets == 0
                            && let Err(err) = run.complete(&state.database).await
                        {
                            tracing::error!(
                                policy = %policy.uuid,
                                run = %run.uuid,
                                "failed to complete system backup policy run: {err:#?}"
                            );
                        }
                    }
                }
            }
        })
        .await;
    background_task_builder
        .add_cron_task(
            "prune_system_backups",
            croner::Cron::from_str("0 30 * * * *").unwrap(),
            async |state| {
                const RUNS_KEPT: i64 = 200;
                const RUN_TARGETS_KEPT: i64 = 20;

                let pruned =
                    shared::models::server_backup::ServerBackup::prune_system_backups(&state)
                        .await?;
                if pruned > 0 {
                    tracing::info!(
                        "pruned {} system backups past their policy retention window",
                        pruned
                    );
                }

                let pruned =
                    SystemBackupPolicyRun::prune(&state.database, RUNS_KEPT, RUN_TARGETS_KEPT)
                        .await?;
                if pruned > 0 {
                    tracing::info!("pruned {} old system backup policy runs", pruned);
                }

                Ok(())
            },
        )
        .await;
}
