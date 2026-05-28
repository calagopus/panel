use serde::Deserialize;
use std::{fs::File, io::Write, path::Path};

#[derive(Deserialize)]
struct GithubRelease {
    tag_name: String,
    assets: Vec<GithubAsset>,
}

#[derive(Deserialize)]
struct GithubAsset {
    name: String,
    browser_download_url: String,
}

fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-env-changed=WINGS_RELEASE");

    let target_arch =
        std::env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_else(|_| "unknown".to_string());
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_else(|_| "unknown".to_string());
    let target_env =
        std::env::var("CARGO_CFG_TARGET_ENV").unwrap_or_else(|_| "unknown".to_string());
    let release_env = std::env::var("WINGS_RELEASE").unwrap_or_default();

    println!("cargo:rustc-env=CARGO_TARGET={target_arch}-{target_env}");

    let bin_dir = Path::new("bins");
    if !bin_dir.exists() {
        std::fs::create_dir_all(bin_dir).ok();
    }

    let bin_path = bin_dir.join("wings-rs");
    let version_path = bin_dir.join("wings-rs.version");

    let existing_version = std::fs::read_to_string(&version_path)
        .map(|s| s.trim().to_string())
        .unwrap_or_default();

    let mut final_version = existing_version.clone();

    let should_check_github = if release_env.starts_with("latest") {
        true
    } else if release_env.is_empty() && bin_path.exists() {
        false
    } else {
        !bin_path.exists() || (!release_env.is_empty() && release_env != existing_version)
    };

    if should_check_github
        && target_os == "linux"
        && let Some((tag, url)) = fetch_release_metadata(&target_arch)
        && (tag != existing_version || release_env.starts_with("latest"))
        && let Ok(mut resp) = ureq::get(url).call()
        && resp.status().is_success()
    {
        println!(
            "cargo:warning=Downloading and Compressing wings-rs version {tag} for {target_arch} from GitHub..."
        );

        let compressed_data = zstd::encode_all(resp.body_mut().as_reader(), 22)
            .expect("Failed to compress binary with zstd");

        println!(
            "cargo:warning=Compressed binary size: {} bytes -> {} bytes",
            resp.headers()
                .get("Content-Length")
                .map_or("?", |v| v.to_str().unwrap_or("?")),
            compressed_data.len()
        );

        let mut file = File::create(&bin_path).expect("Failed to create bin");
        file.write_all(&compressed_data)
            .expect("Failed to write compressed bin");

        std::fs::write(&version_path, &tag).ok();
        final_version = tag;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&bin_path, std::fs::Permissions::from_mode(0o755)).ok();
        }
    }

    if !bin_path.exists() {
        File::create(&bin_path).ok();
    }

    println!("cargo:rustc-env=WINGS_VERSION={final_version}");
}

fn fetch_release_metadata(arch: &str) -> Option<(String, String)> {
    let mut resp = ureq::get("https://api.github.com/repos/calagopus/wings/releases/latest")
        .header("User-Agent", "rust-build-script")
        .call()
        .ok()?;
    let release: GithubRelease = serde_json::from_reader(resp.body_mut().as_reader()).ok()?;

    let expected_name = format!("wings-rs-{arch}-linux");
    let asset = release
        .assets
        .into_iter()
        .find(|a| a.name == expected_name)?;

    Some((release.tag_name, asset.browser_download_url))
}
