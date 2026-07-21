use crate::State;
use futures_util::FutureExt;
use std::{borrow::Cow, collections::HashMap, panic::AssertUnwindSafe, sync::Arc};
use tokio::sync::{OwnedRwLockReadGuard, RwLock};

pub struct BackgroundTask {
    pub name: &'static str,
    pub last_execution: std::time::Instant,
    pub last_error: Option<anyhow::Error>,

    pub task: tokio::task::JoinHandle<()>,
}

pub struct BackgroundTaskBuilder {
    state: State,
    tasks: Arc<RwLock<HashMap<&'static str, BackgroundTask>>>,
}

impl BackgroundTaskBuilder {
    pub fn new(state: State) -> Self {
        Self {
            state,
            tasks: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Adds a background task that will be executed periodically, depending on your loop function implementation.
    /// This will only run on primary instances, so be aware of that when implementing your task.
    pub async fn add_task<
        F: Fn(State) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = Result<(), anyhow::Error>> + Send + 'static,
    >(
        &self,
        name: &'static str,
        loop_fn: F,
    ) {
        if !self.state.env.app_primary {
            return;
        }

        let state = self.state.clone();
        let tasks = Arc::clone(&self.tasks);

        self.tasks.write().await.insert(
            name,
            BackgroundTask {
                name,
                last_execution: std::time::Instant::now(),
                last_error: None,
                task: tokio::spawn(async move {
                    loop {
                        if let Some(task) = tasks.write().await.get_mut(name) {
                            task.last_execution = std::time::Instant::now();
                        }

                        tracing::debug!(name, "running background task function");
                        let result = AssertUnwindSafe(loop_fn(state.clone()))
                            .catch_unwind()
                            .await;

                        let result = match result {
                            Ok(result) => result,
                            Err(err) => {
                                let err_msg: Cow<'_, str> =
                                    if let Some(s) = err.downcast_ref::<&str>() {
                                        (*s).into()
                                    } else if let Some(s) = err.downcast_ref::<String>() {
                                        s.clone().into()
                                    } else {
                                        "Unknown panic".into()
                                    };

                                tracing::error!(name, "background task panicked: {}", err_msg);
                                sentry::capture_message(
                                    &format!("Background task '{}' panicked: {}", name, err_msg),
                                    sentry::Level::Error,
                                );

                                if let Some(task) = tasks.write().await.get_mut(name) {
                                    task.last_error = Some(anyhow::anyhow!(err_msg));
                                }

                                return;
                            }
                        };

                        if let Err(err) = &result {
                            tracing::error!(name, "a background task error occurred: {:?}", err);
                            sentry_anyhow::capture_anyhow(err);
                        }

                        if let Some(task) = tasks.write().await.get_mut(name) {
                            task.last_error = result.err();
                        }
                    }
                }),
            },
        );
    }

    /// Adds a background task that will be executed periodically, depending on the cron you provide, with the UTC timezone.
    /// This will only run on primary instances, so be aware of that when implementing your task.
    pub async fn add_cron_task<
        F: Fn(State) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = Result<(), anyhow::Error>> + Send + 'static,
    >(
        &self,
        name: &'static str,
        cron: croner::Cron,
        r#fn: F,
    ) {
        if !self.state.env.app_primary {
            return;
        }

        let state = self.state.clone();
        let tasks = Arc::clone(&self.tasks);

        self.tasks.write().await.insert(
            name,
            BackgroundTask {
                name,
                last_execution: std::time::Instant::now(),
                last_error: None,
                task: tokio::spawn(async move {
                    let schedule_iter = cron.iter_after(chrono::Utc::now());

                    for target_datetime in schedule_iter {
                        let target_timestamp = target_datetime.timestamp();
                        let now_timestamp = chrono::Utc::now().timestamp();
                        let sleep_duration = target_timestamp - now_timestamp;
                        if sleep_duration <= 0 {
                            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                            continue;
                        }

                        tokio::time::sleep(std::time::Duration::from_secs(sleep_duration as u64))
                            .await;

                        if let Some(task) = tasks.write().await.get_mut(name) {
                            task.last_execution = std::time::Instant::now();
                        }

                        tracing::debug!(name, "running background task function");
                        let result = AssertUnwindSafe(r#fn(state.clone())).catch_unwind().await;

                        let result = match result {
                            Ok(result) => result,
                            Err(err) => {
                                let err_msg: Cow<'_, str> =
                                    if let Some(s) = err.downcast_ref::<&str>() {
                                        (*s).into()
                                    } else if let Some(s) = err.downcast_ref::<String>() {
                                        s.clone().into()
                                    } else {
                                        "Unknown panic".into()
                                    };

                                tracing::error!(name, "background task panicked: {}", err_msg);
                                sentry::capture_message(
                                    &format!("Background task '{}' panicked: {}", name, err_msg),
                                    sentry::Level::Error,
                                );

                                if let Some(task) = tasks.write().await.get_mut(name) {
                                    task.last_error = Some(anyhow::anyhow!(err_msg));
                                }

                                return;
                            }
                        };

                        if let Err(err) = &result {
                            tracing::error!(name, "a background task error occurred: {:?}", err);
                            sentry_anyhow::capture_anyhow(err);
                        }

                        if let Some(task) = tasks.write().await.get_mut(name) {
                            task.last_error = result.err();
                        }
                    }
                }),
            },
        );
    }
}

#[derive(Default)]
pub struct BackgroundTaskManager {
    builder: RwLock<Option<BackgroundTaskBuilder>>,
}

impl BackgroundTaskManager {
    pub async fn merge_builder(&self, builder: BackgroundTaskBuilder) {
        self.builder.write().await.replace(builder);
    }

    pub async fn get_tasks(&self) -> OwnedRwLockReadGuard<HashMap<&'static str, BackgroundTask>> {
        let inner = self.builder.read().await;

        inner.as_ref().unwrap().tasks.clone().read_owned().await
    }
}
