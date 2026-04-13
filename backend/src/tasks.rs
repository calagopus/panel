use rand::RngExt;

pub async fn define_background_tasks(
    background_task_builder: &shared::extensions::background_tasks::BackgroundTaskBuilder,
) {
    background_task_builder
        .add_task("collect_telemetry", async |state| {
            fn generate_randomized_cron_schedule() -> cron::Schedule {
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

            let schedule_iter = cron_schedule.upcoming(chrono::Utc);

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
        .add_task("delete_expired_sessions", async |state| {
            tokio::time::sleep(std::time::Duration::from_mins(5)).await;

            let deleted_sessions =
                shared::models::user_session::UserSession::delete_unused(&state.database).await?;
            if deleted_sessions > 0 {
                tracing::info!("deleted {} expired user sessions", deleted_sessions);
            }

            Ok(())
        })
        .await;
    background_task_builder
        .add_task("delete_expired_api_keys", async |state| {
            tokio::time::sleep(std::time::Duration::from_mins(30)).await;

            let deleted_api_keys =
                shared::models::user_api_key::UserApiKey::delete_expired(&state.database).await?;
            if deleted_api_keys > 0 {
                tracing::info!("deleted {} expired user api keys", deleted_api_keys);
            }

            Ok(())
        })
        .await;
    background_task_builder
        .add_task("delete_unconfigured_security_keys", async |state| {
            tokio::time::sleep(std::time::Duration::from_mins(30)).await;

            let deleted_security_keys =
                shared::models::user_security_key::UserSecurityKey::delete_unconfigured(
                    &state.database,
                )
                .await?;
            if deleted_security_keys > 0 {
                tracing::info!(
                    "deleted {} unconfigured user security keys",
                    deleted_security_keys
                );
            }

            Ok(())
        })
        .await;
    background_task_builder
        .add_task("delete_old_activity", async |state| {
            tokio::time::sleep(std::time::Duration::from_hours(1)).await;

            let settings = state.settings.get().await?;
            let admin_retention_days = settings.activity.admin_log_retention_days;
            let user_retention_days = settings.activity.user_log_retention_days;
            let server_retention_days = settings.activity.server_log_retention_days;
            drop(settings);

            let deleted_admin_activity =
                shared::models::admin_activity::AdminActivity::delete_older_than(
                    &state.database,
                    chrono::Utc::now() - chrono::Duration::days(admin_retention_days as i64),
                )
                .await?;
            if deleted_admin_activity > 0 {
                tracing::info!("deleted {} old admin activity logs", deleted_admin_activity);
            }

            let deleted_user_activity =
                shared::models::user_activity::UserActivity::delete_older_than(
                    &state.database,
                    chrono::Utc::now() - chrono::Duration::days(user_retention_days as i64),
                )
                .await?;
            if deleted_user_activity > 0 {
                tracing::info!("deleted {} old user activity logs", deleted_user_activity);
            }

            let deleted_server_activity =
                shared::models::server_activity::ServerActivity::delete_older_than(
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

            Ok(())
        })
        .await;
}
