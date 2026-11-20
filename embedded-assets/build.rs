use flate2::{Compression, read::GzDecoder, write::GzEncoder};
use std::path::{Path, PathBuf};

const COMPRESSIBLE_EXTENSIONS: &[&str] = &[
    "css",
    "html",
    "ico",
    "js",
    "json",
    "svg",
    "wasm",
    "webmanifest",
    "woff",
];
const MIN_COMPRESS_SIZE: usize = 1024;

fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=../database/extension-migrations");

    slim_frontend_dist();
}

fn slim_frontend_dist() {
    let dist_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap())
        .join("..")
        .join("frontend")
        .join("dist");
    println!("cargo:rerun-if-changed={}", dist_dir.display());

    let out_dir = PathBuf::from(std::env::var("OUT_DIR").unwrap()).join("frontend-dist");
    if out_dir.exists() {
        std::fs::remove_dir_all(&out_dir).expect("Failed to clear frontend-dist");
    }
    std::fs::create_dir_all(&out_dir).expect("Failed to create frontend-dist");

    if !dist_dir.is_dir() {
        panic!(
            "frontend/dist not found at {}, build the frontend first",
            dist_dir.display()
        );
    }

    slim_dir(&dist_dir, &out_dir).expect("Failed to slim frontend/dist");
}

fn slim_dir(source: &Path, destination: &Path) -> std::io::Result<()> {
    for entry in std::fs::read_dir(source)? {
        let entry = entry?;
        let path = entry.path();
        let file_name = entry.file_name();

        if path.is_dir() {
            let destination = destination.join(&file_name);
            std::fs::create_dir_all(&destination)?;
            slim_dir(&path, &destination)?;
            continue;
        }

        let name = file_name.to_string_lossy();
        if name.ends_with(".gz") {
            continue;
        }

        let destination_gz = destination.join(format!("{name}.gz"));
        let contents = std::fs::read(&path)?;

        let mut gz_path = path.clone().into_os_string();
        gz_path.push(".gz");
        if let Ok(twin) = std::fs::read(&gz_path)
            && gzip_matches(&twin, &contents)
        {
            std::fs::write(&destination_gz, twin)?;
            continue;
        }

        if contents.len() >= MIN_COMPRESS_SIZE
            && path
                .extension()
                .and_then(|ext| ext.to_str())
                .is_some_and(|ext| {
                    COMPRESSIBLE_EXTENSIONS.contains(&ext.to_ascii_lowercase().as_str())
                })
        {
            let mut encoder = GzEncoder::new(Vec::new(), Compression::best());
            std::io::Write::write_all(&mut encoder, &contents)?;
            let compressed = encoder.finish()?;

            if compressed.len() < contents.len() {
                std::fs::write(&destination_gz, compressed)?;
                continue;
            }
        }

        std::fs::copy(&path, destination.join(&file_name))?;
    }

    Ok(())
}

fn gzip_matches(compressed: &[u8], contents: &[u8]) -> bool {
    let mut decompressed = Vec::with_capacity(contents.len());

    std::io::Read::read_to_end(&mut GzDecoder::new(compressed), &mut decompressed).is_ok()
        && decompressed == contents
}
