use crate::build::Cancellation;
use anyhow::Context;
use shared::heavy::{BuildPhase, Request, Response, Status, SupervisorState};
use std::{
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    sync::{Arc, Mutex, MutexGuard},
    time::Duration,
};
use tokio::{
    io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt},
    net::{UnixListener, UnixStream},
};

const MAX_REQUEST: u64 = 8 * 1024;

const LOG_CHUNK: u64 = 64 * 1024;

const ACCEPT_RETRY: Duration = Duration::from_millis(100);

const EXCHANGE_DEADLINE: Duration = Duration::from_secs(30);

const MAX_CONNECTIONS: usize = 64;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Identity {
    pub panel_version: String,
    pub cache_key: String,
    pub bin_name: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Ticket {
    pub build_id: u64,
    pub force: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Completion {
    Succeeded,
    Failed {
        reason: String,
        exit_code: Option<i32>,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Admission {
    Accepted { build_id: u64 },
    AlreadyRunning { build_id: u64 },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Plan {
    Build,
    AlreadySatisfied,
    SuppressedByFailure,
}

pub fn plan(force: bool, satisfied: bool, memo_recorded: bool) -> Plan {
    if force {
        return Plan::Build;
    }

    if satisfied {
        return Plan::AlreadySatisfied;
    }
    if memo_recorded {
        return Plan::SuppressedByFailure;
    }

    Plan::Build
}

pub fn plan_ticket(
    binaries: &Path,
    cache_key: &str,
    bin_name: &str,
    ticket: Ticket,
) -> anyhow::Result<Plan> {
    if ticket.force {
        crate::store::clear_failure_memo(binaries, cache_key)?;

        return Ok(Plan::Build);
    }

    let entries = crate::store::list_entries(binaries)?;
    let satisfied = crate::store::select::exact_match(&entries, cache_key, bin_name).is_some();
    let memo_recorded = crate::store::read_failure_memo(binaries, cache_key).is_some();

    Ok(plan(false, satisfied, memo_recorded))
}

struct Running {
    build_id: u64,
    force: bool,
    claimed: bool,
    phase: BuildPhase,
    started_at: String,
    cancel: Arc<Cancellation>,
}

struct Finished {
    build_id: u64,
    succeeded: bool,
    started_at: String,
    finished_at: String,
    exit_code: Option<i32>,
    failure_reason: Option<String>,
}

struct Live {
    cache_key: String,
    running: Option<Running>,
    pending: Option<bool>,
    last: Option<Finished>,
    next_id: u64,
}

impl Live {
    fn take_id(&mut self) -> u64 {
        let id = self.next_id;
        self.next_id = self.next_id.saturating_add(1);

        id
    }

    fn begin(&mut self, force: bool) -> u64 {
        let build_id = self.take_id();
        self.running = Some(Running {
            build_id,
            force,
            claimed: false,
            phase: BuildPhase::Preparing,
            started_at: crate::store::record::now(),
            cancel: Arc::new(Cancellation::new()),
        });

        build_id
    }
}

pub struct Control {
    binaries: PathBuf,
    panel_version: String,
    bin_name: String,
    live: Mutex<Live>,
    wake: tokio::sync::Notify,
    restart_requests: tokio::sync::mpsc::Sender<()>,
}

impl Control {
    pub fn new(
        binaries: PathBuf,
        identity: Identity,
        restart_requests: tokio::sync::mpsc::Sender<()>,
    ) -> anyhow::Result<Self> {
        let next_id = crate::store::next_build_id(&binaries)?;
        let last =
            crate::store::read_failure_memo(&binaries, &identity.cache_key).map(|memo| Finished {
                build_id: memo.build_id,
                succeeded: false,
                started_at: memo.started_at.clone(),
                finished_at: memo.finished_at.unwrap_or(memo.started_at),
                exit_code: memo.exit_code,
                failure_reason: memo.failure_reason,
            });

        Ok(Self {
            binaries,
            panel_version: identity.panel_version,
            bin_name: identity.bin_name,
            live: Mutex::new(Live {
                cache_key: identity.cache_key,
                running: None,
                pending: None,
                last,
                next_id,
            }),
            wake: tokio::sync::Notify::new(),
            restart_requests,
        })
    }

    /// Asks the supervisor to stop the running panel and start it again from the same binary,
    /// used to apply changes that only take effect at boot, such as toggling extensions.
    pub fn request_restart(&self) -> bool {
        self.restart_requests.try_send(()).is_ok()
    }

    pub fn bin_name(&self) -> &str {
        &self.bin_name
    }

    pub fn retarget(&self, cache_key: String) {
        self.live().cache_key = cache_key;
    }

    fn live(&self) -> MutexGuard<'_, Live> {
        self.live.lock().unwrap_or_else(|err| err.into_inner())
    }

    pub fn request(&self, force: bool) -> Admission {
        let mut live = self.live();

        if let Some(build_id) = live.running.as_ref().map(|running| running.build_id) {
            live.pending = Some(live.pending.unwrap_or_default() || force);

            return Admission::AlreadyRunning { build_id };
        }

        let build_id = live.begin(force);
        drop(live);
        self.wake.notify_one();

        Admission::Accepted { build_id }
    }

    fn claim(&self) -> Option<(Ticket, Arc<Cancellation>)> {
        let mut live = self.live();
        let running = live.running.as_mut()?;
        if running.claimed {
            return None;
        }
        running.claimed = true;

        Some((
            Ticket {
                build_id: running.build_id,
                force: running.force,
            },
            Arc::clone(&running.cancel),
        ))
    }

    pub fn cancel(&self, build_id: Option<u64>) -> Option<u64> {
        let cancelling = {
            let mut live = self.live();
            let running = live.running.as_ref()?;
            if build_id.is_some_and(|named| named != running.build_id) {
                return None;
            }

            let cancelling = (running.build_id, Arc::clone(&running.cancel));
            live.pending = None;

            cancelling
        };

        cancelling.1.cancel();

        Some(cancelling.0)
    }

    pub fn report(&self, phase: BuildPhase) {
        if let Some(running) = self.live().running.as_mut() {
            running.phase = phase;
        }
    }

    fn release(&self, completion: Completion) {
        let mut live = self.live();
        let Some(running) = live.running.take() else {
            return;
        };

        let (succeeded, exit_code, failure_reason) = match completion {
            Completion::Succeeded => (true, Some(0), None),
            Completion::Failed { reason, exit_code } => (false, exit_code, Some(reason)),
        };
        live.last = Some(Finished {
            build_id: running.build_id,
            succeeded,
            started_at: running.started_at,
            finished_at: crate::store::record::now(),
            exit_code,
            failure_reason,
        });
    }

    fn start_pending(&self) {
        let mut live = self.live();
        if live.running.is_some() {
            return;
        }

        let Some(force) = live.pending.take() else {
            return;
        };
        live.begin(force);
        drop(live);
        self.wake.notify_one();
    }

    pub fn status(&self) -> Status {
        let mut status = Status {
            state: SupervisorState::Idle,
            panel_version: self.panel_version.clone(),
            cache_key: String::new(),
            bin_name: self.bin_name.clone(),
            build_id: None,
            started_at: None,
            finished_at: None,
            exit_code: None,
            failure_reason: None,
            log_len: 0,
        };

        {
            let live = self.live();
            status.cache_key = live.cache_key.clone();

            if let Some(running) = &live.running {
                status.state = if running.claimed {
                    SupervisorState::Building {
                        phase: running.phase,
                    }
                } else {
                    SupervisorState::Queued
                };
                status.build_id = Some(running.build_id);
                status.started_at = Some(running.started_at.clone());
            } else if let Some(last) = &live.last {
                status.state = if last.succeeded {
                    SupervisorState::Succeeded
                } else {
                    SupervisorState::Failed
                };
                status.build_id = Some(last.build_id);
                status.started_at = Some(last.started_at.clone());
                status.finished_at = Some(last.finished_at.clone());
                status.exit_code = last.exit_code;
                status.failure_reason = last.failure_reason.clone();
            }
        }

        if let Some(build_id) = status.build_id {
            status.log_len = self
                .log_path(build_id)
                .and_then(|path| std::fs::metadata(path).ok())
                .map_or(0, |metadata| metadata.len());
        }

        status
    }

    pub fn read_log(&self, build_id: Option<u64>, from_offset: u64) -> Response {
        let Some(build_id) = build_id.or_else(|| self.newest_build_id()) else {
            return Response::Error {
                message: "no build has run yet".to_string(),
            };
        };

        let Some(path) = self.log_path(build_id) else {
            if self.is_live(build_id) {
                return Response::LogChunk {
                    offset: 0,
                    data: String::new(),
                    eof: false,
                };
            }

            return Response::Error {
                message: format!("build {build_id} has no log, it was pruned or never started"),
            };
        };

        match read_chunk(&path, from_offset) {
            Ok(chunk) => chunk,
            Err(err) => Response::Error {
                message: format!("{err:#}"),
            },
        }
    }

    fn newest_build_id(&self) -> Option<u64> {
        {
            let live = self.live();
            let known = live
                .running
                .as_ref()
                .map(|running| running.build_id)
                .or_else(|| live.last.as_ref().map(|last| last.build_id));
            if known.is_some() {
                return known;
            }
        }

        crate::store::list_build_ids(&self.binaries)
            .ok()?
            .first()
            .copied()
    }

    fn is_live(&self, build_id: u64) -> bool {
        self.live()
            .running
            .as_ref()
            .is_some_and(|running| running.build_id == build_id)
    }

    fn log_path(&self, build_id: u64) -> Option<PathBuf> {
        let recorded = crate::store::build_record_dir(&self.binaries, build_id)
            .join(crate::store::record::BUILD_LOG_FILE);
        if recorded.is_file() {
            return Some(recorded);
        }

        let key = self.live().cache_key.clone();
        let memo = crate::store::failure_memo_dir(&self.binaries, &key);
        let copied = memo.join(crate::store::record::BUILD_LOG_FILE);

        (copied.is_file()
            && crate::store::read_failure_memo(&self.binaries, &key)
                .is_some_and(|record| record.build_id == build_id))
        .then_some(copied)
    }
}

fn read_chunk(path: &Path, from_offset: u64) -> anyhow::Result<Response> {
    let mut file =
        std::fs::File::open(path).with_context(|| format!("opening {}", path.display()))?;
    let len = file.metadata()?.len();

    file.seek(SeekFrom::Start(from_offset))?;
    let mut buffer = Vec::with_capacity(LOG_CHUNK as usize);
    file.take(LOG_CHUNK).read_to_end(&mut buffer)?;

    Ok(log_chunk(from_offset, &buffer, len))
}

fn log_chunk(from_offset: u64, buffer: &[u8], len: u64) -> Response {
    let (data, advanced) = match std::str::from_utf8(buffer) {
        Ok(text) => (text.to_string(), buffer.len()),
        Err(err) if err.valid_up_to() > 0 => (
            String::from_utf8_lossy(&buffer[..err.valid_up_to()]).into_owned(),
            err.valid_up_to(),
        ),
        Err(_) => (String::from_utf8_lossy(buffer).into_owned(), buffer.len()),
    };

    let offset = from_offset.saturating_add(advanced as u64);

    Response::LogChunk {
        eof: data.is_empty() || offset >= len,
        offset,
        data,
    }
}

pub async fn bind(path: &Path) -> anyhow::Result<UnixListener> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .with_context(|| format!("creating {}", parent.display()))?;
    }

    match tokio::fs::remove_file(path).await {
        Err(err) if err.kind() != std::io::ErrorKind::NotFound => {
            return Err(err).with_context(|| format!("removing the stale {}", path.display()));
        }
        _ => {}
    }

    UnixListener::bind(path).with_context(|| format!("binding {}", path.display()))
}

pub async fn serve(listener: UnixListener, control: Arc<Control>) {
    serve_bounded(listener, control, EXCHANGE_DEADLINE, MAX_CONNECTIONS).await;
}

async fn serve_bounded(
    listener: UnixListener,
    control: Arc<Control>,
    deadline: Duration,
    connections: usize,
) {
    let permits = Arc::new(tokio::sync::Semaphore::new(connections));

    loop {
        let Ok(permit) = Arc::clone(&permits).acquire_owned().await else {
            return;
        };

        match listener.accept().await {
            Ok((stream, _)) => {
                let control = Arc::clone(&control);
                tokio::spawn(async move {
                    let _permit = permit;

                    match tokio::time::timeout(deadline, handle(stream, &control)).await {
                        Ok(Ok(())) => {}
                        Ok(Err(err)) => {
                            tracing::debug!("a control connection ended early: {err:#}");
                        }
                        Err(_) => {
                            tracing::debug!("a control connection went quiet and was dropped");
                        }
                    }
                });
            }
            Err(err) => {
                tracing::warn!("accepting a control connection failed: {err}");
                tokio::time::sleep(ACCEPT_RETRY).await;
            }
        }
    }
}

async fn handle(stream: UnixStream, control: &Control) -> anyhow::Result<()> {
    let (reader, mut writer) = stream.into_split();
    let mut line = Vec::new();
    tokio::io::BufReader::new(reader.take(MAX_REQUEST))
        .read_until(b'\n', &mut line)
        .await?;

    if line.iter().all(u8::is_ascii_whitespace) {
        return Ok(());
    }

    let response = match serde_json::from_str::<Request>(&String::from_utf8_lossy(&line)) {
        Ok(request) => respond(request, control),
        Err(err) => Response::Error {
            message: format!("unreadable request: {err}"),
        },
    };

    let mut encoded = serde_json::to_vec(&response)?;
    encoded.push(b'\n');
    writer.write_all(&encoded).await?;

    writer.flush().await.context("answering a request")
}

fn respond(request: Request, control: &Control) -> Response {
    match request {
        Request::GetStatus => Response::Status(control.status()),
        Request::RequestRebuild { force } => match control.request(force) {
            Admission::Accepted { build_id } => Response::RebuildAccepted { build_id },
            Admission::AlreadyRunning { build_id } => Response::RebuildAlreadyRunning { build_id },
        },
        Request::StreamLog {
            build_id,
            from_offset,
        } => control.read_log(build_id, from_offset),
        Request::Cancel { build_id } => match control.cancel(build_id) {
            Some(build_id) => Response::CancelAccepted { build_id },
            None => Response::CancelNotRunning,
        },
        Request::RequestRestart => {
            if control.request_restart() {
                Response::RestartAccepted
            } else {
                Response::Error {
                    message: "a restart is already queued".to_string(),
                }
            }
        }
    }
}

pub async fn drive<Fut: Future<Output = Completion>, F: FnMut(Ticket, Arc<Cancellation>) -> Fut>(
    control: &Control,
    mut build: F,
) {
    loop {
        while let Some((ticket, cancel)) = control.claim() {
            let active = Active {
                control,
                completed: false,
            };

            match poll_catching_unwind(build(ticket, cancel)).await {
                Ok(completion) => active.finish(completion),
                Err(_) => {
                    drop(active);
                    tracing::error!("a build panicked, the supervisor is carrying on without it");
                }
            }

            control.start_pending();
        }

        control.wake.notified().await;
    }
}

async fn poll_catching_unwind<T>(
    future: impl Future<Output = T>,
) -> Result<T, Box<dyn std::any::Any + Send>> {
    let mut future = Box::pin(future);

    std::future::poll_fn(move |cx| {
        match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| future.as_mut().poll(cx))) {
            Ok(polled) => polled.map(Ok),
            Err(payload) => std::task::Poll::Ready(Err(payload)),
        }
    })
    .await
}

struct Active<'a> {
    control: &'a Control,
    completed: bool,
}

impl Active<'_> {
    fn finish(mut self, completion: Completion) {
        self.completed = true;
        self.control.release(completion);
    }
}

impl Drop for Active<'_> {
    fn drop(&mut self) {
        if !self.completed {
            self.control.release(Completion::Failed {
                reason: "the build ended without reporting an outcome".to_string(),
                exit_code: None,
            });
        }
    }
}
