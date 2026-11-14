use anyhow::Context;
use clap::{Args, FromArgMatches, ValueEnum};
use colored::Colorize;
use dialoguer::{Select, theme::ColorfulTheme};
use serde::Deserialize;
use std::{
    collections::HashMap,
    io::IsTerminal,
    path::{Path, PathBuf},
};
use tokio::process::Command;

const BYTES_PER_BUILD_JOB: u64 = 2 * 1024 * 1024 * 1024;
const CGROUP_ROOT: &str = "/sys/fs/cgroup";

#[derive(ValueEnum, Clone, Copy)]
pub enum ApplyProfile {
    Dev,
    Balanced,
    Optimized,
}

impl ApplyProfile {
    #[inline]
    fn to_rust_profile(self) -> &'static str {
        match self {
            Self::Dev => "dev",
            Self::Balanced => "heavy-release",
            Self::Optimized => "release",
        }
    }

    #[inline]
    fn to_target_path(self) -> &'static str {
        match self {
            Self::Dev => "debug",
            Self::Balanced => "heavy-release",
            Self::Optimized => "release",
        }
    }

    #[inline]
    fn is_dev(self) -> bool {
        matches!(self, Self::Dev)
    }
}

#[derive(Args)]
pub struct ApplyArgs {
    #[arg(
        short = 'p',
        long = "profile",
        help = "the profile to use for building the backend",
        default_value = "balanced"
    )]
    profile: ApplyProfile,
    #[arg(
        long = "skip-replace-binary",
        help = "skip replacing the current binary after building",
        default_value = "false"
    )]
    skip_replace_binary: bool,
    #[arg(
        long = "bin",
        help = "the name of the binary to build",
        default_value = "panel-rs"
    )]
    bin: String,
    #[arg(
        short = 'j',
        long = "jobs",
        help = "the number of parallel cargo jobs, defaults to a value derived from available memory and cpus"
    )]
    jobs: Option<usize>,
}

pub struct ApplyCommand;

impl shared::extensions::commands::CliCommand<ApplyArgs> for ApplyCommand {
    fn get_command(&self, command: clap::Command) -> clap::Command {
        command
    }

    fn get_executor(self) -> Box<shared::extensions::commands::ExecutorFunc> {
        Box::new(|_env, arg_matches| {
            Box::pin(async move {
                let mut args = ApplyArgs::from_arg_matches(&arg_matches)?;

                if tokio::fs::metadata(".sqlx")
                    .await
                    .ok()
                    .is_none_or(|e| !e.is_dir())
                {
                    eprintln!(
                        "{} {} {}",
                        "failed to find".red(),
                        ".sqlx".bright_red(),
                        "directory, make sure you are in the panel root.".red()
                    );
                    return Ok(1);
                }

                super::remove_stale_migration_links().await?;

                if !args.profile.is_dev()
                    && tokio::fs::metadata("target/debug")
                        .await
                        .is_ok_and(|m| m.is_dir())
                    && tokio::fs::metadata(Path::new("target").join(args.profile.to_target_path()))
                        .await
                        .is_err()
                    && std::io::stdout().is_terminal()
                {
                    println!(
                        "{} {} {} {} {}",
                        "an existing".yellow(),
                        "target/debug".bright_yellow(),
                        "build was found, but no".yellow(),
                        format!("target/{}", args.profile.to_target_path()).bright_yellow(),
                        "build exists yet - building it from scratch may take a while.".yellow()
                    );

                    let selection = Select::with_theme(&ColorfulTheme::default())
                        .with_prompt("How would you like to continue?")
                        .default(0)
                        .items(&[
                            format!(
                                "build with the {} profile anyway",
                                args.profile.to_rust_profile()
                            ),
                            "switch to the dev profile (reuses target/debug)".to_string(),
                            "abort".to_string(),
                        ])
                        .interact()?;

                    match selection {
                        0 => {}
                        1 => args.profile = ApplyProfile::Dev,
                        _ => {
                            println!("{}", "aborting.".yellow());
                            return Ok(0);
                        }
                    }
                }

                let cargo_bin = which("cargo")
                    .await
                    .context("unable to find `cargo` binary")?;
                let cargo_version = Command::new(&cargo_bin).arg("--version").output().await?;
                let cargo_version = String::from_utf8(cargo_version.stdout)?;

                println!("detected cargo: {}", cargo_version.trim().bright_black());

                let package_json = tokio::fs::read_to_string("frontend/package.json")
                    .await
                    .context("unable to read `frontend/package.json`")?;
                #[derive(Deserialize)]
                struct PackageJson {
                    engines: HashMap<String, semver::VersionReq>,
                }
                let package_json: PackageJson = serde_json::from_str(&package_json)?;

                let node_bin = which("node")
                    .await
                    .context("unable to find `node` binary")?;
                let node_version = Command::new(&node_bin).arg("--version").output().await?;
                let node_version: semver::Version = String::from_utf8(node_version.stdout)?
                    .trim_start_matches('v')
                    .trim()
                    .parse()
                    .context("unable to parse node version as semver")?;

                println!(
                    "detected node:  {}",
                    node_version.to_string().bright_black()
                );
                if let Some(node_req) = package_json.engines.get("node")
                    && !node_req.matches(&node_version)
                {
                    eprintln!(
                        "{} {} {} {}",
                        "node version".red(),
                        node_version.to_string().bright_red(),
                        "does not match requirement".red(),
                        node_req.to_string().bright_red()
                    );
                    return Ok(1);
                }

                let pnpm_bin = which("pnpm")
                    .await
                    .context("unable to find `pnpm` binary, this can usually be installed using `npm i -g pnpm`")?;
                let pnpm_version = Command::new(&pnpm_bin).arg("--version").output().await?;
                let pnpm_version: semver::Version = String::from_utf8(pnpm_version.stdout)?
                    .trim()
                    .parse()
                    .context("unable to parse pnpm version as semver")?;

                println!(
                    "detected pnpm:  {}",
                    pnpm_version.to_string().bright_black()
                );
                if let Some(pnpm_req) = package_json.engines.get("pnpm")
                    && !pnpm_req.matches(&pnpm_version)
                {
                    eprintln!(
                        "{} {} {} {}",
                        "pnpm version".red(),
                        pnpm_version.to_string().bright_red(),
                        "does not match requirement".red(),
                        pnpm_req.to_string().bright_red()
                    );
                    return Ok(1);
                }

                println!();
                println!("┏━━━━━━━━━━━━━━━━━━━┓");
                println!("┃ building frontend ┃");
                println!("┗━━━━━━━━━━━━━━━━━━━┛");

                println!("installing dependencies...");
                let status = Command::new(&pnpm_bin)
                    .arg("install")
                    .arg("--prefer-offline")
                    .current_dir("frontend")
                    .status()
                    .await?;
                if !status.success() {
                    eprintln!(
                        "{} {}",
                        "pnpm install".bright_red(),
                        "did not run successfully, aborting process".red()
                    );
                    return Ok(1);
                }

                println!();
                println!("building frontend...");
                let status = Command::new(&pnpm_bin)
                    .arg("build:fast")
                    .current_dir("frontend")
                    .status()
                    .await?;
                if !status.success() {
                    eprintln!(
                        "{} {}",
                        "pnpm build:fast".bright_red(),
                        "did not run successfully, aborting process".red()
                    );
                    return Ok(1);
                }

                let filesystem =
                    shared::cap::CapFilesystem::new(Path::new("frontend/dist")).await?;
                let mut walker = filesystem.async_walk_dir("").await?;
                let mut total_dist = 0;

                while let Some(Ok(entry)) = walker.next_entry().await {
                    let metadata = filesystem.async_metadata(entry.path).await?;

                    if metadata.is_file() {
                        total_dist += metadata.len();
                    }
                }

                println!(
                    "total dist size: {}",
                    human_bytes::human_bytes(total_dist as f64).bright_black()
                );

                println!();
                println!("┏━━━━━━━━━━━━━━━━━━┓");
                println!("┃ building backend ┃");
                println!("┗━━━━━━━━━━━━━━━━━━┛");

                println!("building backend...");
                let mut jobs = args
                    .jobs
                    .or_else(|| std::env::var("CARGO_BUILD_JOBS").ok()?.parse().ok())
                    .unwrap_or_else(default_build_jobs);
                let status = loop {
                    println!("using {} parallel jobs", jobs.to_string().bright_black());

                    let oom_kills_before = cgroup_oom_kills().await;
                    let status = Command::new(&cargo_bin)
                        .arg("build")
                        .arg("--profile")
                        .arg(args.profile.to_rust_profile())
                        .arg("-p")
                        .arg(&args.bin)
                        .arg("--jobs")
                        .arg(jobs.to_string())
                        .status()
                        .await?;
                    if status.success() || jobs == 1 {
                        break status;
                    }

                    if cgroup_oom_kills().await > oom_kills_before {
                        eprintln!(
                            "{} {}",
                            "cargo build was killed for running out of memory,".yellow(),
                            "retrying with a single job".yellow()
                        );
                        jobs = 1;
                        continue;
                    }

                    break status;
                };
                if !status.success() {
                    eprintln!(
                        "{} {}",
                        format!("cargo build --profile {}", args.profile.to_rust_profile())
                            .bright_red(),
                        "did not run successfully, aborting process".red()
                    );
                    return Ok(1);
                }

                #[cfg(not(windows))]
                let output_location = Path::new("target")
                    .join(args.profile.to_target_path())
                    .join(&args.bin);
                #[cfg(windows)]
                let output_location = Path::new("target")
                    .join(args.profile.to_target_path())
                    .join(format!("{}.exe", &args.bin));

                let output_metadata = tokio::fs::metadata(&output_location).await?;

                println!(
                    "output binary size: {}",
                    human_bytes::human_bytes(output_metadata.len() as f64).bright_black()
                );

                if !args.skip_replace_binary {
                    let current_exe = std::env::current_exe().with_context(|| {
                        format!(
                            "unable to retrieve current executable, manually move `{}`",
                            output_location.display()
                        )
                    })?;

                    #[cfg(not(windows))]
                    {
                        if let Err(err) = tokio::fs::rename(&output_location, &current_exe).await {
                            eprintln!(
                                "{} {} {} {}: {}",
                                "unable to automatically move binary, manually move".red(),
                                output_location.to_string_lossy().bright_red(),
                                "to".red(),
                                current_exe.to_string_lossy().bright_red(),
                                err
                            );
                        }
                    }
                    #[cfg(windows)]
                    {
                        eprintln!(
                            "{} {} {} {}",
                            "unable to automatically move binary on windows, move".red(),
                            output_location.to_string_lossy().bright_red(),
                            "to".red(),
                            current_exe.to_string_lossy().bright_red()
                        );
                    }
                }

                Ok(0)
            })
        })
    }
}

fn default_build_jobs() -> usize {
    let cpus = std::thread::available_parallelism().map_or(1, |cpus| cpus.get());

    let Some(memory) = available_memory() else {
        return cpus;
    };

    ((memory / BYTES_PER_BUILD_JOB) as usize).clamp(1, cpus)
}

fn available_memory() -> Option<u64> {
    let meminfo = std::fs::read_to_string("/proc/meminfo").ok()?;
    let mem_available = meminfo
        .lines()
        .find_map(|line| line.strip_prefix("MemAvailable:"))
        .and_then(|value| {
            value
                .trim()
                .trim_end_matches("kB")
                .trim()
                .parse::<u64>()
                .ok()
        })
        .map(|kib| kib * 1024);

    let read_u64 =
        |path: &Path| -> Option<u64> { std::fs::read_to_string(path).ok()?.trim().parse().ok() };
    // a limit can sit on any ancestor (e.g. a systemd slice), so the tightest level wins
    let cgroup_available = own_cgroup_dir()
        .ancestors()
        .take_while(|dir| dir.starts_with(CGROUP_ROOT))
        .filter_map(|dir| {
            let limit = read_u64(&dir.join("memory.max"))?;
            let current = read_u64(&dir.join("memory.current"))?;
            let reclaimable = std::fs::read_to_string(dir.join("memory.stat"))
                .ok()?
                .lines()
                .find_map(|line| line.strip_prefix("inactive_file "))
                .and_then(|value| value.trim().parse::<u64>().ok())
                .unwrap_or(0);

            Some(limit.saturating_sub(current.saturating_sub(reclaimable)))
        })
        .min();

    match (mem_available, cgroup_available) {
        (Some(mem_available), Some(cgroup_available)) => Some(mem_available.min(cgroup_available)),
        (mem_available, cgroup_available) => mem_available.or(cgroup_available),
    }
}

/// The cgroup v2 directory of this process, which cargo and rustc inherit. Its `memory.events`
/// counts oom kills of its members regardless of which ancestor's limit triggered them.
fn own_cgroup_dir() -> PathBuf {
    std::fs::read_to_string("/proc/self/cgroup")
        .ok()
        .and_then(|cgroups| {
            cgroups
                .lines()
                .find_map(|line| line.strip_prefix("0::"))
                .filter(|path| !path.split('/').any(|component| component == ".."))
                .map(|path| Path::new(CGROUP_ROOT).join(path.trim_start_matches('/')))
        })
        .filter(|dir| dir.is_dir())
        .unwrap_or_else(|| PathBuf::from(CGROUP_ROOT))
}

async fn cgroup_oom_kills() -> u64 {
    tokio::fs::read_to_string(own_cgroup_dir().join("memory.events"))
        .await
        .ok()
        .and_then(|events| {
            events
                .lines()
                .find_map(|line| line.strip_prefix("oom_kill "))
                .and_then(|value| value.trim().parse().ok())
        })
        .unwrap_or(0)
}

pub async fn which(bin: &'static str) -> Result<PathBuf, anyhow::Error> {
    Ok(tokio::task::spawn_blocking(move || which::which(bin)).await??)
}
