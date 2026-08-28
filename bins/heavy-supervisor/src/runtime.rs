use crate::{
    build::CommandRunner as _,
    config::Config,
    store::record::{BuildRecord, BuildState},
};
use anyhow::Context;
use std::{
    collections::BTreeSet,
    path::{Path, PathBuf},
    process::{ExitStatus, Stdio},
    sync::Arc,
    time::Duration,
};

const RESTART_QUEUE: usize = 4;
const REQUESTED_RESTART_GRACE: Duration = Duration::from_millis(500);

pub async fn run(config: Config) -> anyhow::Result<()> {
    let shutdown = watch_signals()?;

    config.preflight()?;
    prepare_repo(&config.repo_dir)?;

    let shipped_names = crate::translations::seed_shipped(
        &config.shipped_translations_dir,
        &config.translations_dir,
    )
    .context("seeding the translations volume")?;

    let inputs = crate::cache_key::collect::collect_key_inputs(&config, &shipped_names)?;
    let key = crate::cache_key::cache_key(&inputs);
    let entries = crate::store::list_entries(&config.binaries_dir)
        .with_context(|| format!("reading {}", config.binaries_dir.display()))?;

    let decision = crate::store::select::decide(&crate::store::select::BootInputs {
        key: &key,
        version: &inputs.panel_version,
        bin_name: &config.bin_name,
        has_extensions: !inputs.extensions.is_empty(),
        translations_customized: !inputs.translations.is_empty(),
        failure_recorded: crate::store::read_failure_memo(&config.binaries_dir, &key).is_some(),
        entries: &entries,
    });

    tracing::info!(
        "panel {} ({}), cache key {key}: {decision:?}",
        inputs.panel_version,
        config.bin_name
    );
    let plan = act_on(&config, &decision, &inputs.panel_version, &key);

    let (restart_requests, restart_requested) = tokio::sync::mpsc::channel(1);
    let control = Arc::new(crate::server::Control::new(
        config.binaries_dir.clone(),
        crate::server::Identity {
            panel_version: inputs.panel_version.clone(),
            cache_key: key,
            bin_name: config.bin_name.clone(),
        },
        restart_requests,
    )?);
    let listener = crate::server::bind(&config.socket_path).await?;
    tokio::spawn(crate::server::serve(listener, Arc::clone(&control)));

    if plan.build {
        control.request(false);
    }

    let (installed, restarts) = tokio::sync::mpsc::channel(RESTART_QUEUE);
    let mut supervisor = Supervisor {
        config: &config,
        version: &inputs.panel_version,
        policy: config.panel,
        restarts,
        restart_requested,
        shutdown,
    };

    let config = &config;
    let control = control.as_ref();
    let shipped_names = &shipped_names;
    let inputs = &inputs;
    let driver = crate::server::drive(control, move |ticket, cancel| {
        run_build(
            config,
            control,
            shipped_names,
            inputs,
            ticket,
            cancel,
            installed.clone(),
        )
    });

    tokio::select! {
        outcome = supervisor.run(plan.binary, |binary| panel_command(config, binary)) => outcome,
        () = async {
            driver.await;
            std::future::pending::<()>().await
        } => unreachable!(),
    }
}

fn prepare_repo(repo_dir: &Path) -> anyhow::Result<()> {
    if !crate::build::repo_is_dirty(repo_dir) {
        return Ok(());
    }

    tracing::warn!(
        "an earlier build left {} partial, resetting it before anything runs",
        repo_dir.display()
    );
    crate::build::reset_repo(repo_dir)?;
    crate::build::clear_repo_dirty(repo_dir)
}

#[derive(Debug, PartialEq, Eq)]
struct BootPlan {
    binary: PathBuf,
    build: bool,
}

fn act_on(
    config: &Config,
    decision: &crate::store::select::BootDecision,
    version: &str,
    key: &str,
) -> BootPlan {
    match decision {
        crate::store::select::BootDecision::Exact { entry } => BootPlan {
            binary: entry.join(&config.bin_name),
            build: false,
        },
        crate::store::select::BootDecision::Stock => BootPlan {
            binary: match record_stock_entry(config, version, key) {
                Ok(cached) => cached,
                Err(err) => {
                    tracing::warn!("the stock binary could not be cached as an entry: {err:#}");

                    config.stock_binary.clone()
                }
            },
            build: false,
        },
        crate::store::select::BootDecision::FallbackSuppressed { entry } => BootPlan {
            binary: entry_binary(config, entry.as_ref()),
            build: false,
        },
        crate::store::select::BootDecision::FallbackAndBuild { entry } => BootPlan {
            binary: entry_binary(config, entry.as_ref()),
            build: true,
        },
    }
}

fn entry_binary(config: &Config, entry: Option<&PathBuf>) -> PathBuf {
    entry.map_or_else(
        || config.stock_binary.clone(),
        |dir| dir.join(&config.bin_name),
    )
}

fn record_stock_entry(config: &Config, version: &str, key: &str) -> anyhow::Result<PathBuf> {
    let entry = crate::store::entry_dir(&config.binaries_dir, version, key);
    let installed = crate::store::install_binary(&entry, &config.bin_name, &config.stock_binary)?;

    crate::store::record::write_record(
        &entry,
        &BuildRecord {
            schema: crate::store::record::BUILD_RECORD_SCHEMA,
            build_id: 0,
            state: BuildState::Succeeded,
            panel_version: version.to_string(),
            cache_key: key.to_string(),
            bin_name: config.bin_name.clone(),
            intended_extensions: Vec::new(),
            verified_extensions: Vec::new(),
            verified: true,
            started_at: crate::store::record::now(),
            finished_at: Some(crate::store::record::now()),
            exit_code: Some(0),
            failure_reason: None,
        },
    )?;

    crate::store::prune_entries(&config.binaries_dir, crate::store::KEEP_CACHE_ENTRIES)?;

    Ok(installed)
}

fn fall_back(config: &Config, version: &str, failed: &Path) -> PathBuf {
    let failed_entry = failed
        .parent()
        .filter(|dir| dir.starts_with(&config.binaries_dir))
        .map(Path::to_path_buf);

    if let Some(entry) = &failed_entry {
        match crate::store::mark_unverified(entry) {
            Ok(true) => tracing::warn!("{} no longer counts as verified", entry.display()),
            Ok(false) => {}
            Err(err) => tracing::warn!(
                "{} could not be marked unverified: {err:#}",
                entry.display()
            ),
        }
    }

    let entries = match crate::store::list_entries(&config.binaries_dir) {
        Ok(entries) => entries,
        Err(err) => {
            tracing::warn!("the cached binaries could not be listed: {err:#}");

            Vec::new()
        }
    };
    let usable: Vec<crate::store::select::EntryView> = entries
        .into_iter()
        .filter(|entry| Some(&entry.path) != failed_entry.as_ref())
        .collect();

    crate::store::select::fallback(&usable, version, &config.bin_name).map_or_else(
        || config.stock_binary.clone(),
        |dir| dir.join(&config.bin_name),
    )
}

fn panel_command(config: &Config, binary: &Path) -> tokio::process::Command {
    let mut command = tokio::process::Command::new(binary);
    command.current_dir(&config.repo_dir).stdin(Stdio::null());

    command
}

enum Wake {
    Exited(anyhow::Result<ExitStatus>),
    Install(PathBuf),
    Restart,
    Stop,
}

struct Supervisor<'a> {
    config: &'a Config,
    version: &'a str,
    policy: crate::panel::Policy,
    restarts: tokio::sync::mpsc::Receiver<PathBuf>,
    restart_requested: tokio::sync::mpsc::Receiver<()>,
    shutdown: tokio::sync::watch::Receiver<bool>,
}

impl Supervisor<'_> {
    async fn run(
        &mut self,
        mut binary: PathBuf,
        mut command: impl FnMut(&Path) -> tokio::process::Command,
    ) -> anyhow::Result<()> {
        let mut supervision = crate::panel::Supervision::new(self.policy);
        let shutdown = crate::panel::Shutdown::new(self.config.shutdown_grace);
        let mut interrupt = Box::pin(requested_stop(self.shutdown.clone()));

        loop {
            if *self.shutdown.borrow() {
                return Ok(());
            }

            tracing::info!("starting the panel from {}", binary.display());

            match crate::panel::start(|| command(&binary), &mut supervision, &mut interrupt).await {
                crate::panel::StartOutcome::Running(mut process) => {
                    match self.watch(&mut process, &binary).await {
                        Wake::Exited(status) => {
                            tracing::warn!("the panel exited on its own ({status:?}), restarting");

                            if let crate::panel::Decision::Retry { after } =
                                supervision.record(crate::panel::Outcome::Crashed)
                            {
                                tokio::select! {
                                    () = tokio::time::sleep(after) => {}
                                    () = &mut interrupt => return Ok(()),
                                }
                            }
                        }
                        Wake::Install(next) => {
                            tracing::info!("restarting the panel onto {}", next.display());
                            let stopped = process.stop(shutdown).await;
                            tracing::info!("the outgoing panel was {stopped:?}");

                            binary = next;
                            supervision = crate::panel::Supervision::new(self.policy);
                        }
                        Wake::Restart => {
                            tracing::info!("restarting the panel on request");
                            tokio::time::sleep(REQUESTED_RESTART_GRACE).await;

                            let stopped = process.stop(shutdown).await;
                            tracing::info!("the outgoing panel was {stopped:?}");

                            supervision = crate::panel::Supervision::new(self.policy);
                        }
                        Wake::Stop => {
                            let stopped = process.stop(shutdown).await;
                            tracing::info!("the panel was {stopped:?}, exiting");

                            return Ok(());
                        }
                    }
                }
                crate::panel::StartOutcome::Interrupted(process) => {
                    if let Some(mut process) = process {
                        let stopped = process.stop(shutdown).await;
                        tracing::info!("the panel was {stopped:?}, exiting");
                    }

                    return Ok(());
                }
                crate::panel::StartOutcome::FallBack(reason) => {
                    tracing::error!(
                        "the panel would not start from {}: {reason}",
                        binary.display()
                    );
                    binary = fall_back(self.config, self.version, &binary);
                    tracing::warn!("falling back to {}", binary.display());
                }
                crate::panel::StartOutcome::GiveUp(reason) => anyhow::bail!(
                    "the panel failed to start {} times in a row, the last of them because {reason}",
                    supervision.consecutive_failures()
                ),
            }
        }
    }

    async fn watch(&mut self, process: &mut crate::panel::PanelProcess, binary: &Path) -> Wake {
        loop {
            if *self.shutdown.borrow() {
                return Wake::Stop;
            }

            let wake = tokio::select! {
                status = process.wait() => Wake::Exited(status),
                Some(next) = self.restarts.recv() => Wake::Install(next),
                Some(()) = self.restart_requested.recv() => Wake::Restart,
                _ = self.shutdown.changed() => Wake::Stop,
            };

            match wake {
                Wake::Install(next) if next == binary => continue,
                other => return other,
            }
        }
    }
}

async fn run_build(
    config: &Config,
    control: &crate::server::Control,
    shipped_names: &BTreeSet<String>,
    inputs: &crate::cache_key::KeyInputs,
    ticket: crate::server::Ticket,
    cancel: Arc<crate::build::Cancellation>,
    installed: tokio::sync::mpsc::Sender<PathBuf>,
) -> crate::server::Completion {
    if cancel.is_cancelled() {
        explain(
            config,
            ticket.build_id,
            "the build was cancelled before it started",
        )
        .await;

        return failed("the build was cancelled before it started".to_string());
    }

    let request = match crate::build::BuildRequest::resolve(
        config,
        shipped_names,
        inputs.panel_version.clone(),
        inputs.target.clone(),
        ticket.build_id,
    ) {
        Ok(request) => request,
        Err(err) => return failed(format!("the build inputs could not be read: {err:#}")),
    };

    control.retarget(request.cache_key.clone());

    match crate::server::plan_ticket(
        &config.binaries_dir,
        &request.cache_key,
        control.bin_name(),
        ticket,
    ) {
        Ok(crate::server::Plan::Build) => {}
        Ok(crate::server::Plan::AlreadySatisfied) => {
            explain(
                config,
                request.build_id,
                "these inputs are already built, nothing to do",
            )
            .await;

            if let Some(binary) = satisfied_binary(config, &request.cache_key) {
                restart_onto(control, &installed, binary).await;
            }

            return crate::server::Completion::Succeeded;
        }
        Ok(crate::server::Plan::SuppressedByFailure) => {
            let memo = crate::store::read_failure_memo(&config.binaries_dir, &request.cache_key);
            let reason = memo
                .as_ref()
                .and_then(|record| record.failure_reason.clone())
                .unwrap_or_else(|| "an earlier build of these exact inputs failed".to_string());

            explain(
                config,
                request.build_id,
                &format!(
                    "not building: {reason}. rebuild with force, or change the extensions or \
                     translations, to try again"
                ),
            )
            .await;

            return crate::server::Completion::Failed {
                exit_code: memo.and_then(|record| record.exit_code),
                reason,
            };
        }
        Err(err) => return failed(format!("the build could not be planned: {err:#}")),
    }

    let log = match crate::build::open_log(&config.binaries_dir, request.build_id) {
        Ok(log) => log,
        Err(err) => return failed(format!("the build log could not be opened: {err:#}")),
    };
    let mut runner = crate::build::ProcessRunner::new(log, Arc::clone(&cancel));
    let mut report = |phase| control.report(phase);

    match crate::build::run(
        config,
        &request,
        shipped_names,
        &mut runner,
        &cancel,
        &mut report,
    )
    .await
    {
        Ok(crate::build::BuildOutcome::Succeeded { entry, record }) => {
            restart_onto(control, &installed, entry.join(&record.bin_name)).await;

            crate::server::Completion::Succeeded
        }
        Ok(crate::build::BuildOutcome::Failed { record }) => crate::server::Completion::Failed {
            exit_code: record.exit_code,
            reason: record
                .failure_reason
                .unwrap_or_else(|| "the build failed without saying why".to_string()),
        },
        Err(err) => failed(format!("{err:#}")),
    }
}

async fn restart_onto(
    control: &crate::server::Control,
    installed: &tokio::sync::mpsc::Sender<PathBuf>,
    binary: PathBuf,
) {
    control.report(shared::heavy::BuildPhase::Restarting);
    let _ = installed.send(binary).await;
}

async fn explain(config: &Config, build_id: u64, message: &str) {
    let written = match crate::build::open_log(&config.binaries_dir, build_id) {
        Ok(log) => {
            crate::build::ProcessRunner::new(log, Arc::new(crate::build::Cancellation::new()))
                .note(message)
                .await
        }
        Err(err) => Err(err),
    };

    if let Err(err) = written {
        tracing::warn!("the reason this build did not run could not be recorded: {err:#}");
    }
}

fn satisfied_binary(config: &Config, key: &str) -> Option<PathBuf> {
    let entries = crate::store::list_entries(&config.binaries_dir).ok()?;

    crate::store::select::exact_match(&entries, key, &config.bin_name)
        .map(|entry| entry.path.join(&config.bin_name))
}

fn failed(reason: String) -> crate::server::Completion {
    crate::server::Completion::Failed {
        reason,
        exit_code: None,
    }
}

async fn requested_stop(mut shutdown: tokio::sync::watch::Receiver<bool>) {
    let _ = shutdown.wait_for(|stop| *stop).await;
}

fn watch_signals() -> anyhow::Result<tokio::sync::watch::Receiver<bool>> {
    use tokio::signal::unix::SignalKind;

    let mut terminate =
        tokio::signal::unix::signal(SignalKind::terminate()).context("listening for SIGTERM")?;
    let mut interrupt =
        tokio::signal::unix::signal(SignalKind::interrupt()).context("listening for SIGINT")?;
    let (sender, receiver) = tokio::sync::watch::channel(false);

    tokio::spawn(async move {
        let name = tokio::select! {
            _ = terminate.recv() => "SIGTERM",
            _ = interrupt.recv() => "SIGINT",
        };

        tracing::info!("{name} received, stopping the panel and its process group");
        let _ = sender.send(true);
    });

    Ok(receiver)
}
