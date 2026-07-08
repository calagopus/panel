use compact_str::ToCompactString;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::{collections::BTreeMap, fmt::Display, str::FromStr, sync::Arc};
use tokio::sync::{RwLock, RwLockReadGuard};
use utoipa::ToSchema;

#[derive(ToSchema, Serialize, Deserialize, Clone)]
pub struct VersionHistoryEntry {
    version: compact_str::CompactString,
    timestamp: chrono::DateTime<chrono::Utc>,
}

/// Accepted formats:
/// - `1.0.0`
/// - `1.0.0:commit`
/// - `1.0.0:commit@branch`
#[derive(ToSchema, Serialize, Deserialize, Clone)]
pub struct ParsedVersionInformation {
    #[schema(value_type = String)]
    pub version: semver::Version,
    pub commit: Option<compact_str::CompactString>,
    pub branch: Option<compact_str::CompactString>,
}

impl FromStr for ParsedVersionInformation {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        if let Ok(version) = semver::Version::parse(s) {
            return Ok(Self {
                version,
                commit: None,
                branch: None,
            });
        }

        let (version, commit_branch) = if let Some((version, commit)) = s.split_once(':') {
            (version, Some(commit))
        } else {
            (s, None)
        };
        let (commit, branch) =
            if let Some((commit, branch)) = commit_branch.and_then(|cb| cb.split_once('@')) {
                (
                    Some(commit.to_compact_string()),
                    Some(branch.to_compact_string()),
                )
            } else {
                (commit_branch.map(|c| c.to_compact_string()), None)
            };

        Ok(Self {
            version: semver::Version::parse(version)?,
            commit,
            branch,
        })
    }
}

impl Display for ParsedVersionInformation {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        if let Some(commit) = &self.commit {
            if let Some(branch) = &self.branch {
                write!(f, "{}:{}@{}", self.version, commit, branch)
            } else {
                write!(f, "{}:{}", self.version, commit)
            }
        } else {
            write!(f, "{}", self.version)
        }
    }
}

#[derive(ToSchema, Serialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ExtensionUpdateCheckResult {
    NoUpdate,
    UpdateAvailable {
        #[schema(value_type = String)]
        version: semver::Version,
        #[schema(value_type = String)]
        latest_version: semver::Version,
        changes: Vec<compact_str::CompactString>,
    },
    Error {
        error: compact_str::CompactString,
    },
}

#[derive(ToSchema, Serialize, Clone)]
pub struct UpdateInformation {
    pub panel_version: compact_str::CompactString,
    #[schema(value_type = String)]
    pub latest_panel_version: semver::Version,
    #[schema(value_type = String)]
    pub latest_wings_version: semver::Version,
    #[schema(value_type = String)]
    pub latest_db_agent_version: semver::Version,

    pub extensions: BTreeMap<&'static str, ExtensionUpdateCheckResult>,
}

type ChannelData = Result<Arc<UpdateInformation>, Arc<anyhow::Error>>;

pub struct UpdateManager {
    recheck_notifier: Arc<tokio::sync::Notify>,
    recheck_finished_receiver: tokio::sync::broadcast::Receiver<ChannelData>,
    recheck_finished_sender: tokio::sync::broadcast::Sender<ChannelData>,

    latest_info: Arc<RwLock<Option<Arc<UpdateInformation>>>>,
    panel_version_history: Arc<RwLock<Vec<VersionHistoryEntry>>>,
    extension_version_history: Arc<RwLock<BTreeMap<&'static str, Vec<VersionHistoryEntry>>>>,
}

impl Default for UpdateManager {
    fn default() -> Self {
        let (recheck_finished_sender, recheck_finished_receiver) =
            tokio::sync::broadcast::channel(1);

        Self {
            recheck_notifier: Arc::new(tokio::sync::Notify::new()),
            recheck_finished_receiver,
            recheck_finished_sender,
            latest_info: Arc::new(RwLock::new(None)),
            panel_version_history: Arc::new(RwLock::new(Vec::new())),
            extension_version_history: Arc::new(RwLock::new(BTreeMap::new())),
        }
    }
}

impl UpdateManager {
    pub fn init(&self, state: super::State) {
        if !state.env.app_primary {
            return;
        }

        let recheck_notifier = self.recheck_notifier.clone();
        let recheck_finished_sender = self.recheck_finished_sender.clone();
        let latest_info = self.latest_info.clone();

        tokio::spawn({
            let state = state.clone();

            async move {
                loop {
                    let run_inner = async || -> Result<(), anyhow::Error> {
                        let data: Response = state
                            .client
                            .get("https://calagopus.com/api/latest")
                            .send()
                            .await?
                            .json()
                            .await?;

                        #[derive(Deserialize)]
                        struct Response {
                            versions: ResponseVersions,
                        }

                        #[derive(Deserialize)]
                        struct ResponseVersions {
                            panel: semver::Version,
                            wings: semver::Version,
                            db_agent: semver::Version,
                        }

                        let mut update_info = UpdateInformation {
                            panel_version: state.version.to_compact_string(),
                            latest_panel_version: data.versions.panel,
                            latest_wings_version: data.versions.wings,
                            latest_db_agent_version: data.versions.db_agent,
                            extensions: BTreeMap::new(),
                        };

                        for extension in state.extensions.extensions().await.iter() {
                            let update_information = match extension
                                .check_for_updates(state.clone(), &extension.version)
                                .await
                            {
                                Ok(info) => info,
                                Err(err) => {
                                    tracing::error!(
                                        "failed to check for updates for extension {}: {:#?}",
                                        extension.package_name,
                                        err
                                    );

                                    update_info.extensions.insert(
                                        extension.package_name,
                                        ExtensionUpdateCheckResult::Error {
                                            error: err.to_compact_string(),
                                        },
                                    );

                                    continue;
                                }
                            };

                            if let Some(info) = update_information {
                                update_info.extensions.insert(
                                    extension.package_name,
                                    ExtensionUpdateCheckResult::UpdateAvailable {
                                        version: extension.version.clone(),
                                        latest_version: info.version,
                                        changes: info.changes,
                                    },
                                );
                            } else {
                                update_info.extensions.insert(
                                    extension.package_name,
                                    ExtensionUpdateCheckResult::NoUpdate,
                                );
                            }
                        }

                        let update_info = Arc::new(update_info);
                        *latest_info.write().await = Some(update_info.clone());
                        let _ = recheck_finished_sender.send(Ok(update_info));

                        Ok(())
                    };

                    if let Err(err) = run_inner().await {
                        tracing::error!("failed to check for updates: {:#?}", err);
                        let _ = recheck_finished_sender.send(Err(Arc::new(err)));
                    }

                    tracing::info!("finished update check, waiting for 12h or recheck trigger");

                    tokio::select! {
                        _ = recheck_notifier.notified() => {}
                        _ = tokio::time::sleep(std::time::Duration::from_hours(12)) => {}
                    }
                }
            }
        });

        tokio::spawn(async move {
            let run = async || -> Result<(), anyhow::Error> {
                sqlx::query(
                    "INSERT INTO version_history (extension, version) VALUES ('', $1)
                    ON CONFLICT (extension, version) DO NOTHING",
                )
                .bind(&state.version)
                .execute(state.database.write())
                .await?;

                for extension in state.extensions.extensions().await.iter() {
                    sqlx::query(
                        "INSERT INTO version_history (extension, version) VALUES ($1, $2)
                        ON CONFLICT (extension, version) DO NOTHING",
                    )
                    .bind(extension.package_name)
                    .bind(extension.version.to_string())
                    .execute(state.database.write())
                    .await?;
                }

                let rows = sqlx::query("SELECT extension, version, installed FROM version_history ORDER BY version_history.installed DESC")
                    .fetch_all(state.database.read())
                    .await?;

                let mut panel_history = Vec::new();
                let mut extension_history = BTreeMap::new();

                for row in rows {
                    let extension: compact_str::CompactString = row.try_get("extension")?;

                    let entry = VersionHistoryEntry {
                        version: row.try_get("version")?,
                        timestamp: row
                            .try_get::<chrono::NaiveDateTime, _>("installed")?
                            .and_utc(),
                    };

                    if extension.is_empty() {
                        panel_history.push(entry);
                    } else if let Some(ext) = state
                        .extensions
                        .extensions()
                        .await
                        .iter()
                        .find(|ext| ext.package_name == extension)
                    {
                        extension_history
                            .entry(ext.package_name)
                            .or_insert_with(Vec::new)
                            .push(entry);
                    }
                }

                *state.updates.panel_version_history.write().await = panel_history;
                *state.updates.extension_version_history.write().await = extension_history;

                Ok(())
            };

            if let Err(err) = run().await {
                tracing::error!("failed to track version history: {:#?}", err);
            }
        });
    }

    pub async fn get_panel_version_history(&self) -> RwLockReadGuard<'_, Vec<VersionHistoryEntry>> {
        self.panel_version_history.read().await
    }

    pub async fn get_extension_version_history(
        &self,
    ) -> RwLockReadGuard<'_, BTreeMap<&'static str, Vec<VersionHistoryEntry>>> {
        self.extension_version_history.read().await
    }

    pub async fn get_update_information(&self) -> Option<Arc<UpdateInformation>> {
        self.latest_info.read().await.clone()
    }

    pub fn trigger_recheck(&self) {
        self.recheck_notifier.notify_waiters();
    }

    pub async fn trigger_recheck_and_wait(&self) -> ChannelData {
        self.trigger_recheck();
        self.recheck_finished_receiver
            .resubscribe()
            .recv()
            .await
            .map_err(|err| {
                Arc::new(anyhow::anyhow!(
                    "failed to receive update check result: {:#?}",
                    err
                ))
            })
            .flatten()
    }
}
