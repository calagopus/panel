use anyhow::Context;
use clap::{Args, FromArgMatches, ValueEnum};
use colored::Colorize;
use serde::Deserialize;
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
};
use tokio::process::Command;

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
}

pub struct ApplyCommand;

impl shared::extensions::commands::CliCommand<ApplyArgs> for ApplyCommand {
    fn get_command(&self, command: clap::Command) -> clap::Command {
        command
    }

    fn get_executor(self) -> Box<shared::extensions::commands::ExecutorFunc> {
        Box::new(|_env, arg_matches| {
            Box::pin(async move {
                let args = ApplyArgs::from_arg_matches(&arg_matches)?;

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
                    shared::cap::CapFilesystem::async_new(PathBuf::from("frontend/dist")).await?;
                let mut walker = filesystem.async_walk_dir("").await?;
                let mut total_dist = 0;

                while let Some(Ok((_, name))) = walker.next_entry().await {
                    let metadata = filesystem.async_metadata(name).await?;

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
                let status = Command::new(&cargo_bin)
                    .arg("build")
                    .arg("--profile")
                    .arg(args.profile.to_rust_profile())
                    .arg("-p")
                    .arg(&args.bin)
                    .status()
                    .await?;
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
                    .join("panel-rs");
                #[cfg(windows)]
                let output_location = Path::new("target")
                    .join(args.profile.to_target_path())
                    .join("panel-rs.exe");

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

pub async fn which(bin: &'static str) -> Result<PathBuf, anyhow::Error> {
    Ok(tokio::task::spawn_blocking(move || which::which(bin)).await??)
}
