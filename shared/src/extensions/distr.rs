use anyhow::Context;
use ignore::gitignore::GitignoreBuilder;
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    io::{Read, Write},
    path::Path,
    sync::Arc,
};
use utoipa::ToSchema;
use zip::write::FileOptions;

#[derive(Clone, ToSchema, Deserialize, Serialize)]
pub struct MetadataToml {
    pub package_name: String,
    pub name: String,
    #[schema(value_type = String)]
    pub panel_version: semver::VersionReq,
}

impl MetadataToml {
    /// Get the package identifier for this extension.
    /// This is derived from the package name by replacing `.` with `_`.
    ///
    /// Example: `com.example.myextension` becomes `com_example_myextension`.
    #[inline]
    pub fn get_package_identifier(&self) -> String {
        Self::convert_package_name_to_identifier(&self.package_name)
    }

    /// Convert a package name to an identifier by replacing `.` with `_`.
    ///
    /// Example: `com.example.myextension` becomes `com_example_myextension`.
    #[inline]
    pub fn convert_package_name_to_identifier(package_name: &str) -> String {
        package_name.replace('.', "_")
    }

    /// Convert an identifier to a package name by replacing `_` with `.`.
    ///
    /// Example: `com_example_myextension` becomes `com.example.myextension`.
    #[inline]
    pub fn convert_identifier_to_package_name(identifier: &str) -> String {
        identifier.replace('_', ".")
    }
}

#[derive(Clone, Deserialize, Serialize)]
pub struct CargoPackage {
    pub description: String,
    pub authors: Vec<String>,
    pub version: semver::Version,
}

#[derive(Clone, Deserialize, Serialize)]
pub struct CargoToml {
    pub package: CargoPackage,
    pub dependencies: BTreeMap<String, toml::Value>,
}

#[derive(Clone, Deserialize, Serialize)]
pub struct PackageJson {
    pub dependencies: BTreeMap<String, String>,
}

#[derive(Clone)]
pub struct ExtensionMigration {
    pub id: uuid::Uuid,
    pub name: String,
    pub date: chrono::DateTime<chrono::Utc>,
    pub sql: String,
    pub sql_down: String,
}

impl ExtensionMigration {
    pub fn from_directory_raw(
        path: &Path,
        extension_identifier: &str,
        mut content_up_raw: impl std::io::Read,
        mut content_down_raw: impl std::io::Read,
    ) -> Result<Self, std::io::Error> {
        let mut content_up = String::new();
        content_up_raw.read_to_string(&mut content_up)?;

        let mut content_down = String::new();
        content_down_raw.read_to_string(&mut content_down)?;

        let name = path
            .file_name()
            .ok_or_else(|| {
                std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    format!(
                        "invalid migration directory name `{}`: unable to extract directory name.",
                        path.display()
                    ),
                )
            })?
            .to_string_lossy()
            .to_string();

        if !name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!(
                    "invalid migration directory name `{}`: must be ASCII and contain only alphanumeric characters or underscores.",
                    path.display()
                ),
            ));
        }

        let date = name
            .split('_')
            .next()
            .and_then(|date_str| {
                chrono::NaiveDateTime::parse_from_str(date_str, "%Y%m%d%H%M%S")
                    .ok()
                    .map(|ndt| ndt.and_utc())
            })
            .ok_or_else(|| {
                std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    format!(
                        "invalid migration directory name `{}`: unable to parse date from directory name. expected format `yyyymmddhhmmss_description/`.",
                        path.display()
                    ),
                )
            })?;

        let xxh3 = xxhash_rust::xxh3::xxh3_128(
            format!(
                "{}:{}:{}",
                extension_identifier,
                name,
                date.timestamp_millis()
            )
            .as_bytes(),
        );
        let id = uuid::Builder::from_u128(xxh3)
            .with_variant(uuid::Variant::RFC4122)
            .with_version(uuid::Version::Custom)
            .into_uuid();

        Ok(Self {
            id,
            name,
            date,
            sql: content_up,
            sql_down: content_down,
        })
    }
}

#[derive(Clone)]
pub struct ExtensionDistrFile {
    zip: zip::ZipArchive<Arc<std::fs::File>>,

    pub metadata_toml: MetadataToml,
    pub cargo_toml: CargoToml,
    pub package_json: PackageJson,
}

impl ExtensionDistrFile {
    pub fn parse_from_reader(file: std::fs::File) -> Result<Self, anyhow::Error> {
        let mut zip = zip::ZipArchive::new(Arc::new(file))?;

        let mut metadata_toml = zip.by_name("Metadata.toml")?;
        let mut metadata_toml_bytes = vec![0; metadata_toml.size() as usize];
        metadata_toml.read_exact(&mut metadata_toml_bytes)?;
        drop(metadata_toml);
        let metadata_toml: MetadataToml = toml::from_slice(&metadata_toml_bytes)?;

        let mut cargo_toml = zip.by_name("backend/Cargo.toml")?;
        let mut cargo_toml_bytes = vec![0; cargo_toml.size() as usize];
        cargo_toml.read_exact(&mut cargo_toml_bytes)?;
        drop(cargo_toml);

        let cargo_toml: CargoToml = toml::from_slice(&cargo_toml_bytes)?;

        let mut package_json = zip.by_name("frontend/package.json")?;
        let mut package_json_bytes = vec![0; package_json.size() as usize];
        package_json.read_exact(&mut package_json_bytes)?;
        drop(package_json);

        let package_json: PackageJson = serde_json::from_slice(&package_json_bytes)?;

        let mut this = Self {
            zip,
            metadata_toml,
            cargo_toml,
            package_json,
        };
        this.validate()?;

        Ok(this)
    }

    pub fn extract_backend(&mut self, path: impl AsRef<Path>) -> Result<(), anyhow::Error> {
        let filesystem = crate::cap::CapFilesystem::new(path.as_ref().to_path_buf())?;

        let mut i = 0;
        while let Ok(mut entry) = self.zip.by_index(i) {
            i += 1;

            if !entry.name().starts_with("backend/") {
                continue;
            }

            let clean_path = match entry.enclosed_name() {
                Some(clean_path) => clean_path,
                None => continue,
            };
            let clean_path = match clean_path.strip_prefix("backend/") {
                Ok(clean_path) => clean_path,
                Err(_) => continue,
            };

            if entry.is_dir() {
                filesystem.create_dir_all(clean_path)?;
            } else if entry.is_file() {
                let mut file = filesystem.create(clean_path)?;

                std::io::copy(&mut entry, &mut file)?;
                file.flush()?;
                file.sync_all()?;
            }
        }

        filesystem.write(
            "Metadata.toml",
            toml::to_string_pretty(&self.metadata_toml)?.into_bytes(),
        )?;

        Ok(())
    }

    pub fn extract_frontend(&mut self, path: impl AsRef<Path>) -> Result<(), anyhow::Error> {
        let filesystem = crate::cap::CapFilesystem::new(path.as_ref().to_path_buf())?;

        let mut i = 0;
        while let Ok(mut entry) = self.zip.by_index(i) {
            i += 1;

            if !entry.name().starts_with("frontend/") {
                continue;
            }

            let clean_path = match entry.enclosed_name() {
                Some(clean_path) => clean_path,
                None => continue,
            };
            let clean_path = match clean_path.strip_prefix("frontend/") {
                Ok(clean_path) => clean_path,
                Err(_) => continue,
            };

            if entry.is_dir() {
                filesystem.create_dir_all(clean_path)?;
            } else if entry.is_file() {
                let mut file = filesystem.create(clean_path)?;

                std::io::copy(&mut entry, &mut file)?;
                file.flush()?;
                file.sync_all()?;
            }
        }

        Ok(())
    }

    pub fn has_migrations(&mut self) -> bool {
        self.zip.by_name("migrations/").is_ok()
    }

    pub fn extract_migrations(&mut self, path: impl AsRef<Path>) -> Result<(), anyhow::Error> {
        let filesystem = crate::cap::CapFilesystem::new(path.as_ref().to_path_buf())?;

        let mut i = 0;
        while let Ok(mut entry) = self.zip.by_index(i) {
            i += 1;

            if !entry.name().starts_with("migrations/") {
                continue;
            }

            let clean_path = match entry.enclosed_name() {
                Some(clean_path) => clean_path,
                None => continue,
            };
            let clean_path = match clean_path.strip_prefix("migrations/") {
                Ok(clean_path) => clean_path,
                Err(_) => continue,
            };

            if entry.is_dir() {
                filesystem.create_dir_all(clean_path)?;
            } else if entry.is_file() {
                let mut file = filesystem.create(clean_path)?;

                std::io::copy(&mut entry, &mut file)?;
                file.flush()?;
                file.sync_all()?;
            }
        }

        Ok(())
    }

    pub fn get_migrations(&mut self) -> Result<Vec<ExtensionMigration>, anyhow::Error> {
        let mut migrations = Vec::new();

        let mut migration_dirs = Vec::new();
        let mut i = 0;
        while let Ok(entry) = self.zip.by_index(i) {
            i += 1;

            let entry_name = entry.name().to_string();
            if entry_name.starts_with("migrations/")
                && entry_name.ends_with("/up.sql")
                && !entry.is_dir()
                && let Some(dir_name) = entry_name
                    .strip_prefix("migrations/")
                    .and_then(|s| s.strip_suffix("/up.sql"))
            {
                migration_dirs.push(dir_name.to_string());
            }
        }

        for dir_name in migration_dirs {
            let up_path = Path::new("migrations").join(&dir_name).join("up.sql");
            let down_path = Path::new("migrations").join(&dir_name).join("down.sql");

            let mut up_entry = self.zip.by_path(&up_path)?;
            let mut up_bytes = vec![0; up_entry.size() as usize];
            up_entry.read_exact(&mut up_bytes)?;
            drop(up_entry);

            let mut down_entry = self.zip.by_path(&down_path)?;
            let mut down_bytes = vec![0; down_entry.size() as usize];
            down_entry.read_exact(&mut down_bytes)?;
            drop(down_entry);

            let dir_path = Path::new(&dir_name);

            migrations.push(ExtensionMigration::from_directory_raw(
                dir_path,
                &self.metadata_toml.get_package_identifier(),
                &up_bytes[..],
                &down_bytes[..],
            )?);
        }

        Ok(migrations)
    }

    pub fn validate(&mut self) -> Result<(), anyhow::Error> {
        const MUST_EXIST_DIRECTORIES: &[&str] =
            &["backend/", "backend/src/", "frontend/", "frontend/src/"];
        const MUST_EXIST_FILES: &[&str] = &[
            "Metadata.toml",
            "backend/Cargo.toml",
            "backend/src/lib.rs",
            "frontend/package.json",
        ];

        let mut package_segments = self.metadata_toml.package_name.split('.');
        let tld_segment = package_segments.next().ok_or_else(|| {
            anyhow::anyhow!("invalid package name in calagopus extension archive. (too few segments, expected 3)")
        })?;
        let author_segment = package_segments.next().ok_or_else(|| {
            anyhow::anyhow!("invalid package name in calagopus extension archive. (too few segments, expected 3)")
        })?;
        let identifier_segment = package_segments.next().ok_or_else(|| {
            anyhow::anyhow!("invalid package name in calagopus extension archive. (too few segments, expected 3)")
        })?;

        if package_segments.next().is_some() {
            return Err(anyhow::anyhow!(
                "invalid package name in calagopus extension archive. (too many segments, expected 3)"
            ));
        }

        if tld_segment.len() < 2 || tld_segment.len() > 6 {
            return Err(anyhow::anyhow!(
                "invalid tld segment `{}` in calagopus extension archive package name.",
                tld_segment
            ));
        }

        if author_segment.len() < 3 || author_segment.len() > 30 {
            return Err(anyhow::anyhow!(
                "invalid author segment `{}` in calagopus extension archive package name.",
                author_segment
            ));
        }

        if identifier_segment.len() < 4 || identifier_segment.len() > 30 {
            return Err(anyhow::anyhow!(
                "invalid identifier segment `{}` in calagopus extension archive package name.",
                identifier_segment
            ));
        }

        for c in tld_segment.chars() {
            if !c.is_ascii_lowercase() {
                return Err(anyhow::anyhow!(
                    "invalid character `{c}` in tld segment of calagopus extension archive package name."
                ));
            }
        }

        for c in author_segment.chars() {
            if !c.is_ascii_lowercase() && !c.is_ascii_digit() && c != '-' {
                return Err(anyhow::anyhow!(
                    "invalid character `{c}` in author segment of calagopus extension archive package name."
                ));
            }
        }

        for c in identifier_segment.chars() {
            if !c.is_ascii_lowercase() && !c.is_ascii_digit() && c != '-' {
                return Err(anyhow::anyhow!(
                    "invalid character `{c}` in identifier segment of calagopus extension archive package name."
                ));
            }
        }

        for dir in MUST_EXIST_DIRECTORIES {
            if self.zip.by_name(dir).ok().is_none_or(|e| !e.is_dir()) {
                return Err(anyhow::anyhow!(
                    "unable to find directory `{dir}` in calagopus extension archive."
                ));
            }
        }

        for file in MUST_EXIST_FILES {
            if self.zip.by_name(file).ok().is_none_or(|e| !e.is_file()) {
                return Err(anyhow::anyhow!(
                    "unable to find file `{file}` in calagopus extension archive."
                ));
            }
        }

        if self.zip.by_name("frontend/src/index.ts").is_err()
            && self.zip.by_name("frontend/src/index.tsx").is_err()
        {
            return Err(anyhow::anyhow!(
                "unable to find file `frontend/src/index.ts` or `frontend/src/index.tsx` in calagopus extension archive."
            ));
        }

        {
            let mut lib = self.zip.by_name("backend/src/lib.rs")?;
            let mut lib_string = String::new();
            lib_string.reserve_exact(lib.size() as usize);
            lib.read_to_string(&mut lib_string)?;
            drop(lib);

            if !lib_string.contains("pub struct ExtensionStruct") {
                return Err(anyhow::anyhow!(
                    "unable to find `pub struct ExtensionStruct` in calagopus extension archive backend/src/lib.rs."
                ));
            }
        }

        {
            let mut index = if let Ok(index) = self.zip.by_name("frontend/src/index.ts") {
                index
            } else {
                self.zip.by_name("frontend/src/index.tsx")?
            };
            let mut index_string = String::new();
            index_string.reserve_exact(index.size() as usize);
            index.read_to_string(&mut index_string)?;
            drop(index);

            if !index_string.contains("export default ") {
                return Err(anyhow::anyhow!(
                    "unable to find `export default ` in calagopus extension archive frontend/src/index.ts."
                ));
            }
        }

        if self.has_migrations()
            && let Err(err) = self.get_migrations()
        {
            return Err(anyhow::anyhow!(
                "unable to parse migrations in calagopus extension archive. make sure they are formatted as directories `20260125115245_xxx_xxx/` containing `up.sql` and `down.sql`. {err}"
            ));
        }

        Ok(())
    }

    #[inline]
    pub fn total_size(&self) -> u128 {
        self.zip.decompressed_size().unwrap_or_default()
    }
}

pub struct SlimExtensionDistrFile {
    pub metadata_toml: MetadataToml,
    pub cargo_toml: CargoToml,
    pub package_json: PackageJson,
}

impl SlimExtensionDistrFile {
    pub fn parse_from_directory(path: impl AsRef<Path>) -> Result<Vec<Self>, anyhow::Error> {
        let filesystem = crate::cap::CapFilesystem::new(path.as_ref().to_path_buf())?;
        let mut results = Vec::new();

        let mut dir = filesystem.read_dir("backend-extensions")?;
        while let Some(Ok((is_dir, name))) = dir.next_entry() {
            if !is_dir || name == "internal-list" {
                continue;
            }

            let metadata_toml = filesystem.read_to_string(
                Path::new("backend-extensions")
                    .join(&name)
                    .join("Metadata.toml"),
            )?;
            let metadata_toml: MetadataToml = toml::from_str(&metadata_toml)?;

            let cargo_toml = filesystem.read_to_string(
                Path::new("backend-extensions")
                    .join(&name)
                    .join("Cargo.toml"),
            )?;
            let cargo_toml: CargoToml = toml::from_str(&cargo_toml)?;

            let package_json = filesystem.read_to_string(
                Path::new("frontend/extensions")
                    .join(&name)
                    .join("package.json"),
            )?;
            let package_json: PackageJson = serde_json::from_str(&package_json)?;

            results.push(Self {
                metadata_toml,
                cargo_toml,
                package_json,
            });
        }

        Ok(results)
    }
}

pub struct ExtensionDistrFileBuilder {
    zip: zip::ZipWriter<std::fs::File>,
    wrote_backend: bool,
    wrote_frontend: bool,
    wrote_migrations: bool,
}

impl ExtensionDistrFileBuilder {
    pub fn new(file: std::fs::File) -> Self {
        Self {
            zip: zip::ZipWriter::new(file),
            wrote_backend: false,
            wrote_frontend: false,
            wrote_migrations: false,
        }
    }

    pub fn add_backend(mut self, path: impl AsRef<Path>) -> Result<Self, anyhow::Error> {
        if self.wrote_backend {
            return Err(anyhow::anyhow!(
                "Cannot write backend, it has already been written."
            ));
        }

        let filesystem = crate::cap::CapFilesystem::new(path.as_ref().to_path_buf())?;

        let metadata_toml = filesystem
            .read_to_string("Metadata.toml")
            .context("Failed to read Metadata.toml from backend extension directory.")?;
        self.zip
            .start_file("Metadata.toml", FileOptions::<()>::default())?;
        self.zip.write_all(metadata_toml.as_bytes())?;

        self.zip.add_directory(
            "backend",
            FileOptions::<()>::default().compression_level(Some(9)),
        )?;

        let ignored = &[GitignoreBuilder::new("/")
            .add_line(None, "Metadata.toml")?
            .build()?];

        let mut walker = filesystem.walk_dir(path)?.with_ignored(ignored);
        while let Some(Ok((_, name))) = walker.next_entry() {
            let metadata = filesystem.metadata(&name)?;
            let virtual_path = Path::new("backend").join(&name);

            let options: FileOptions<()> = FileOptions::default().compression_level(Some(9));

            if metadata.is_dir() {
                self.zip
                    .add_directory(virtual_path.to_string_lossy(), options)?;
            } else if metadata.is_file() {
                self.zip
                    .start_file(virtual_path.to_string_lossy(), options)?;

                let mut reader = filesystem.open(&name)?;
                std::io::copy(&mut reader, &mut self.zip)?;
            }
        }

        self.wrote_backend = true;

        Ok(self)
    }

    pub fn add_frontend(mut self, path: impl AsRef<Path>) -> Result<Self, anyhow::Error> {
        if self.wrote_frontend {
            return Err(anyhow::anyhow!(
                "Cannot write frontend, it has already been written."
            ));
        }

        let filesystem = crate::cap::CapFilesystem::new(path.as_ref().to_path_buf())?;

        self.zip.add_directory(
            "frontend",
            FileOptions::<()>::default().compression_level(Some(9)),
        )?;

        let ignored = &[GitignoreBuilder::new("/")
            .add_line(None, "node_modules/")?
            .build()?];

        let mut walker = filesystem.walk_dir(path)?.with_ignored(ignored);
        while let Some(Ok((_, name))) = walker.next_entry() {
            let metadata = filesystem.metadata(&name)?;
            let virtual_path = Path::new("frontend").join(&name);

            let options: FileOptions<()> = FileOptions::default().compression_level(Some(9));

            if metadata.is_dir() {
                self.zip
                    .add_directory(virtual_path.to_string_lossy(), options)?;
            } else if metadata.is_file() {
                self.zip
                    .start_file(virtual_path.to_string_lossy(), options)?;

                let mut reader = filesystem.open(&name)?;
                std::io::copy(&mut reader, &mut self.zip)?;
            }
        }

        self.wrote_frontend = true;

        Ok(self)
    }

    pub fn add_migrations(mut self, path: impl AsRef<Path>) -> Result<Self, anyhow::Error> {
        if self.wrote_migrations {
            return Err(anyhow::anyhow!(
                "Cannot write migrations, they have already been written."
            ));
        }

        let filesystem = crate::cap::CapFilesystem::new(path.as_ref().to_path_buf())?;

        self.zip.add_directory(
            "migrations",
            FileOptions::<()>::default().compression_level(Some(9)),
        )?;

        let mut walker = filesystem.walk_dir(path)?;
        while let Some(Ok((_, name))) = walker.next_entry() {
            let metadata = filesystem.metadata(&name)?;
            let virtual_path = Path::new("migrations").join(&name);

            let options: FileOptions<()> = FileOptions::default().compression_level(Some(9));

            if metadata.is_dir() {
                self.zip
                    .add_directory(virtual_path.to_string_lossy(), options)?;
            } else if metadata.is_file() {
                self.zip
                    .start_file(virtual_path.to_string_lossy(), options)?;

                let mut reader = filesystem.open(&name)?;
                std::io::copy(&mut reader, &mut self.zip)?;
            }
        }

        self.wrote_migrations = true;

        Ok(self)
    }

    pub fn write(mut self) -> std::io::Result<std::fs::File> {
        if !self.wrote_backend {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "Cannot finish writing extension archive: backend files not written.",
            ));
        }

        if !self.wrote_frontend {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "Cannot finish writing extension archive: frontend files not written.",
            ));
        }

        self.zip.set_comment(format!(
            "this .c7s.zip extension archive has been generated by calagopus@{}",
            crate::VERSION
        ))?;
        let writer = self.zip.finish()?;

        Ok(writer)
    }
}

pub fn resync_extension_list() -> Result<(), anyhow::Error> {
    let internal_list_extension = Path::new("backend-extensions/internal-list");
    let extensions_path = Path::new("backend-extensions");

    let mut packages = Vec::new();

    for dir in std::fs::read_dir(extensions_path).unwrap().flatten() {
        if !dir.file_type().unwrap().is_dir() || dir.file_name() == "internal-list" {
            continue;
        }

        let metadata_toml = match std::fs::read_to_string(dir.path().join("Metadata.toml")) {
            Ok(file) => file,
            Err(_) => continue,
        };

        let cargo_toml = match std::fs::read_to_string(dir.path().join("Cargo.toml")) {
            Ok(file) => file,
            Err(_) => continue,
        };

        #[derive(Deserialize)]
        struct MetadataToml {
            package_name: String,
            name: String,
            panel_version: semver::VersionReq,
        }

        #[derive(Deserialize)]
        struct CargoToml {
            package: CargoPackage,
        }

        #[derive(Deserialize)]
        struct CargoPackage {
            description: Option<String>,
            authors: Option<Vec<String>>,
            version: semver::Version,
        }

        let metadata_toml: MetadataToml = toml::from_str(&metadata_toml).unwrap();
        let cargo_toml: CargoToml = toml::from_str(&cargo_toml).unwrap();
        packages.push((dir.file_name(), metadata_toml, cargo_toml.package));
    }

    std::fs::create_dir_all(internal_list_extension).unwrap();
    std::fs::create_dir_all(internal_list_extension.join("src")).unwrap();

    let mut deps = String::new();

    for (path, metadata, _) in packages.iter() {
        deps.push_str(&metadata.package_name.replace('.', "_"));
        deps.push_str(" = { path = \"../");
        deps.push_str(&path.to_string_lossy());
        deps.push_str("\" }\n");
    }

    const CARGO_TEMPLATE_TOML: &str =
        include_str!("../../../backend-extensions/internal-list/Cargo.template.toml");

    std::fs::write(
        internal_list_extension.join("Cargo.toml"),
        format!("{CARGO_TEMPLATE_TOML}{}", deps),
    )?;

    let mut exts = String::new();

    for (_, metadata, package) in packages {
        exts.push_str(&format!(
            r#"
        ConstructedExtension {{
            metadata_toml: MetadataToml {{
                package_name: {}.to_string(),
                name: {}.to_string(),
                panel_version: semver::VersionReq::parse({}).unwrap(),
            }},
            package_name: {},
            description: {},
            authors: &{},
            version: semver::Version::parse({}).unwrap(),
            extension: Arc::new({}::ExtensionStruct::default()),
        }},"#,
            toml::Value::String(metadata.package_name.clone()),
            toml::Value::String(metadata.name),
            toml::Value::String(metadata.panel_version.to_string()),
            toml::Value::String(metadata.package_name.clone()),
            toml::Value::String(package.description.unwrap_or_default()),
            toml::Value::Array(
                package
                    .authors
                    .unwrap_or_default()
                    .into_iter()
                    .map(toml::Value::String)
                    .collect(),
            ),
            toml::Value::String(package.version.to_string()),
            metadata.package_name.replace('.', "_"),
        ));
    }

    let exts_vec = if exts.is_empty() {
        "vec![]".to_string()
    } else {
        format!("vec![{}\n    ]", exts)
    };

    std::fs::write(
        internal_list_extension.join("src/lib.rs"),
        format!(
            r#"#![allow(clippy::default_constructed_unit_structs)]
#![allow(unused_imports)]

use shared::extensions::{{ConstructedExtension, distr::MetadataToml}};
use std::sync::Arc;

pub fn list() -> Vec<ConstructedExtension> {{
    {}
}}
"#,
            exts_vec,
        ),
    )?;

    Ok(())
}
