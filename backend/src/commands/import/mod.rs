use aes::cipher::{BlockModeDecrypt, KeyIvInit, block_padding::Pkcs7};
use anyhow::Context;
use base64::Engine;
use colored::Colorize;
use rsa::{pkcs1::DecodeRsaPublicKey, traits::PublicKeyParts};
use serde::Deserialize;
use shared::extensions::commands::CliCommandGroupBuilder;
use spki::der::Decode;
use sqlx::Row;
use sqlx::any::AnyPoolOptions;
use std::{
    collections::HashSet,
    path::{Path, PathBuf},
    sync::Arc,
};

mod issues;
mod model;
mod pelican;
mod pterodactyl;
mod validate;
mod write;

static BASE64_ENGINE: base64::engine::general_purpose::GeneralPurpose =
    base64::engine::general_purpose::GeneralPurpose::new(
        &base64::alphabet::STANDARD,
        base64::engine::general_purpose::GeneralPurposeConfig::new()
            .with_decode_padding_mode(base64::engine::DecodePaddingMode::Indifferent),
    );

pub(super) type SourcePool = sqlx::AnyPool;
pub(super) type SourceRow = sqlx::any::AnyRow;

pub(super) async fn connect_source_database_any(
    environment_path: &str,
) -> Result<SourcePool, anyhow::Error> {
    sqlx::any::install_default_drivers();

    let connection = std::env::var("DB_CONNECTION")
        .unwrap_or_else(|_| "mysql".to_string())
        .trim_matches('"')
        .to_ascii_lowercase();

    let database_url = match connection.as_str() {
        "mysql" | "mariadb" => {
            let source_database_host =
                std::env::var("DB_HOST").context("failed to read source environment DB_HOST")?;
            let source_database_port = std::env::var("DB_PORT")
                .unwrap_or_else(|_| "3306".to_string())
                .parse::<u16>()
                .context("failed to parse source environment DB_PORT")?;
            let source_database_database = std::env::var("DB_DATABASE")
                .context("failed to read source environment DB_DATABASE")?;
            let source_database_username = std::env::var("DB_USERNAME")
                .context("failed to read source environment DB_USERNAME")?;
            let source_database_password = std::env::var("DB_PASSWORD")
                .context("failed to read source environment DB_PASSWORD")?;

            let mut url = reqwest::Url::parse("mysql://localhost")
                .context("failed to construct source mysql database url")?;
            url.set_host(Some(source_database_host.trim_matches('"')))
                .context("failed to set source mysql database host")?;
            url.set_port(Some(source_database_port))
                .map_err(|_| anyhow::anyhow!("failed to set source mysql database port"))?;
            url.set_username(&urlencoding::encode(
                source_database_username.trim_matches('"'),
            ))
            .map_err(|_| anyhow::anyhow!("failed to set source mysql database username"))?;
            url.set_password(Some(&urlencoding::encode(
                source_database_password.trim_matches('"'),
            )))
            .map_err(|_| anyhow::anyhow!("failed to set source mysql database password"))?;
            url.set_path(&urlencoding::encode(
                source_database_database.trim_matches('"'),
            ));
            url.to_string()
        }
        "sqlite" | "sqlite3" => {
            let source_database_database = std::env::var("DB_DATABASE")
                .context("failed to read source environment DB_DATABASE")?;
            let source_database_database = source_database_database.trim_matches('"');

            match source_database_database {
                ":memory:" | "file::memory:" => {
                    return Err(anyhow::anyhow!(
                        "refusing to import from an in-memory sqlite database"
                    ));
                }
                _ => {
                    let source_database_database = Path::new(source_database_database);
                    let source_database_database: PathBuf =
                        if source_database_database.is_absolute() {
                            source_database_database.to_path_buf()
                        } else {
                            Path::new(environment_path)
                                .parent()
                                .unwrap_or_else(|| Path::new("."))
                                .join(source_database_database)
                        };

                    format!("sqlite://{}", source_database_database.to_string_lossy())
                }
            }
        }
        "pgsql" | "postgres" | "postgresql" => {
            let source_database_host =
                std::env::var("DB_HOST").context("failed to read source environment DB_HOST")?;
            let source_database_port = std::env::var("DB_PORT")
                .unwrap_or_else(|_| "5432".to_string())
                .parse::<u16>()
                .context("failed to parse source environment DB_PORT")?;
            let source_database_database = std::env::var("DB_DATABASE")
                .context("failed to read source environment DB_DATABASE")?;
            let source_database_username = std::env::var("DB_USERNAME")
                .context("failed to read source environment DB_USERNAME")?;
            let source_database_password = std::env::var("DB_PASSWORD")
                .context("failed to read source environment DB_PASSWORD")?;

            let mut url = reqwest::Url::parse("postgres://localhost")
                .context("failed to construct source postgres database url")?;
            url.set_host(Some(source_database_host.trim_matches('"')))
                .context("failed to set source postgres database host")?;
            url.set_port(Some(source_database_port))
                .map_err(|_| anyhow::anyhow!("failed to set source postgres database port"))?;
            url.set_username(&urlencoding::encode(
                source_database_username.trim_matches('"'),
            ))
            .map_err(|_| anyhow::anyhow!("failed to set source postgres database username"))?;
            url.set_password(Some(&urlencoding::encode(
                source_database_password.trim_matches('"'),
            )))
            .map_err(|_| anyhow::anyhow!("failed to set source postgres database password"))?;
            url.set_path(&urlencoding::encode(
                source_database_database.trim_matches('"'),
            ));
            url.to_string()
        }
        _ => {
            return Err(anyhow::anyhow!(
                "unsupported source database driver `{connection}`; expected mysql, mariadb, pgsql, postgres, postgresql, sqlite, or sqlite3"
            ));
        }
    };

    AnyPoolOptions::new()
        .connect(&database_url)
        .await
        .with_context(|| format!("failed to connect to source database using `{connection}`"))
}

fn source_text(row: &SourceRow, column: &str) -> Result<String, anyhow::Error> {
    row.try_get::<String, _>(column)
        .or_else(|_| {
            row.try_get::<Vec<u8>, _>(column)
                .map(|b| String::from_utf8_lossy(&b).into_owned())
        })
        .with_context(|| format!("failed to read source text column `{column}`"))
}

fn source_optional_text(row: &SourceRow, column: &str) -> Result<Option<String>, anyhow::Error> {
    if let Ok(v) = row.try_get::<Option<String>, _>(column) {
        return Ok(v);
    }
    if let Ok(Some(b)) = row.try_get::<Option<Vec<u8>>, _>(column) {
        return Ok(Some(String::from_utf8_lossy(&b).into_owned()));
    }
    Ok(None)
}

fn source_bool(row: &SourceRow, column: &str) -> Result<bool, anyhow::Error> {
    if let Ok(value) = row.try_get::<bool, _>(column) {
        return Ok(value);
    }

    if let Ok(value) = row.try_get::<i64, _>(column) {
        return Ok(value != 0);
    }

    if let Ok(value) = row.try_get::<i32, _>(column) {
        return Ok(value != 0);
    }

    let value: String = row
        .try_get(column)
        .with_context(|| format!("failed to read source bool column `{column}`"))?;

    Ok(matches!(
        value.trim().to_ascii_lowercase().as_str(),
        "1" | "true" | "yes" | "on"
    ))
}

fn extract_php_serialized_string(
    serialized_data: &str,
) -> Result<compact_str::CompactString, anyhow::Error> {
    if !serialized_data.starts_with("s:") {
        return Ok(serialized_data.into());
    }

    let first_colon = match serialized_data.find(':') {
        Some(pos) => pos,
        None => return Err(anyhow::anyhow!("invalid PHP serialized string format")),
    };

    let second_colon_start = first_colon + 1;
    let second_colon = match serialized_data[second_colon_start..].find(':') {
        Some(pos) => second_colon_start + pos,
        None => return Err(anyhow::anyhow!("invalid PHP serialized string format")),
    };

    let length_str = &serialized_data[first_colon + 1..second_colon];
    let length: usize = length_str.parse()?;

    if serialized_data.len() <= second_colon + 1
        || &serialized_data[second_colon + 1..second_colon + 2] != "\""
    {
        return Err(anyhow::anyhow!(
            "invalid PHP serialized string format, missing opening quote"
        ));
    }

    let content_start = second_colon + 2;
    let expected_end = content_start + length;

    if serialized_data.len() < expected_end + 2 {
        return Err(anyhow::anyhow!(
            "invalid PHP serialized string format, string is truncated"
        ));
    }

    if &serialized_data[expected_end..expected_end + 2] != "\";" {
        return Err(anyhow::anyhow!(
            "invalid PHP serialized string format, missing closing quote or semicolon"
        ));
    }

    Ok(serialized_data[content_start..expected_end].into())
}

fn decrypt_laravel_value(
    encrypted_value: &str,
    decoded_key: &[u8],
) -> Result<compact_str::CompactString, anyhow::Error> {
    let clean_value = encrypted_value.trim_start_matches("base64:");
    let decoded = BASE64_ENGINE.decode(clean_value)?;

    #[derive(Deserialize)]
    struct LaravelEncrypted {
        iv: compact_str::CompactString,
        value: compact_str::CompactString,
        // Laravel >= 9.x defaults to AES-256-GCM, whose payload carries an
        // authentication tag. Pterodactyl 1.x predates that and stores CBC
        // payloads without a tag, so the field is optional and its PRESENCE
        // selects the cipher rather than any configuration guess.
        tag: Option<compact_str::CompactString>,
    }

    let payload: LaravelEncrypted = serde_json::from_slice(&decoded)?;

    let decoded_iv = BASE64_ENGINE.decode(&payload.iv)?;
    let mut value = BASE64_ENGINE.decode(&payload.value)?;

    let Ok(key) = <&[u8; 32]>::try_from(decoded_key) else {
        return Err(anyhow::anyhow!(
            "decoded key must be exactly 32 bytes, got {}",
            decoded_key.len()
        ));
    };
    let Ok(iv) = <&[u8; 16]>::try_from(decoded_iv.as_slice()) else {
        return Err(anyhow::anyhow!(
            "IV must be 16 bytes for AES-256-CBC, got {}",
            decoded_iv.len()
        ));
    };

    let decrypted = if let Some(tag) = &payload.tag {
        let decoded_tag = BASE64_ENGINE.decode(tag)?;
        // AES-GCM tags are 16 bytes; Laravel stores the tag separately from
        // the ciphertext, while the aes-gcm crate expects it appended. The
        // length check keeps a malformed payload failing loudly here.
        if decoded_tag.len() != 16 {
            return Err(anyhow::anyhow!(
                "GCM tag must be 16 bytes, got {}",
                decoded_tag.len()
            ));
        }
        value.extend_from_slice(&decoded_tag);
        // AES-256-GCM (Laravel >= 9 default cipher).
        use aes_gcm::{Aes256Gcm, KeyInit, aead::Aead, aead::Nonce};
        if decoded_iv.len() != 12 {
            return Err(anyhow::anyhow!(
                "GCM IV must be 12 bytes, got {}",
                decoded_iv.len()
            ));
        }
        let cipher = Aes256Gcm::new(key.into());
        let nonce = Nonce::<Aes256Gcm>::from_slice(&decoded_iv);
        cipher
            .decrypt(nonce, value.as_slice())
            .map_err(|err| anyhow::anyhow!("AES-256-GCM decryption failed: {err}"))?
            .to_vec()
    } else {
        // AES-256-CBC (Pterodactyl 1.x and older Laravel).
        cbc::Decryptor::<aes::Aes256>::new(key.into(), iv.into())
            .decrypt_padded::<Pkcs7>(&mut value)
            .map_err(|err| anyhow::anyhow!("AES-256-CBC decryption failed: {err}"))?
            .to_vec()
    };

    let result = compact_str::CompactString::from_utf8(decrypted)?;

    extract_php_serialized_string(&result)
}

const OID_RSA: spki::ObjectIdentifier = spki::ObjectIdentifier::new_unwrap("1.2.840.113549.1.1.1");
const OID_ED25519: spki::ObjectIdentifier = spki::ObjectIdentifier::new_unwrap("1.3.101.112");

fn convert_der_public_key(
    der_data: &[u8],
) -> Result<russh::keys::ssh_key::PublicKey, anyhow::Error> {
    let spki = spki::SubjectPublicKeyInfoOwned::from_der(der_data)?;
    let inner = spki
        .subject_public_key
        .as_bytes()
        .ok_or_else(|| anyhow::anyhow!("SPKI bit string not byte-aligned"))?;

    if spki.algorithm.oid == OID_RSA {
        let rsa_pk = rsa::RsaPublicKey::from_pkcs1_der(inner)?;

        Ok(russh::keys::ssh_key::public::KeyData::Rsa(
            russh::keys::ssh_key::public::RsaPublicKey::new(
                rsa_pk.e().to_bytes_be().as_slice().try_into()?,
                rsa_pk.n().to_bytes_be().as_slice().try_into()?,
            )?,
        )
        .into())
    } else if spki.algorithm.oid == OID_ED25519 {
        Ok(russh::keys::ssh_key::public::KeyData::Ed25519(
            russh::keys::ssh_key::public::Ed25519PublicKey(
                inner
                    .try_into()
                    .map_err(|_| anyhow::anyhow!("invalid ed25519 public key length"))?,
            ),
        )
        .into())
    } else {
        Err(anyhow::anyhow!(
            "unsupported public key algorithm with OID {}",
            spki.algorithm.oid
        ))
    }
}

#[inline]
pub(crate) fn is_sqlite_source() -> bool {
    matches!(
        std::env::var("DB_CONNECTION")
            .unwrap_or_else(|_| "mysql".to_string())
            .trim_matches('"')
            .to_ascii_lowercase()
            .as_str(),
        "sqlite" | "sqlite3"
    )
}

#[inline]
pub(crate) fn is_postgres_source() -> bool {
    matches!(
        std::env::var("DB_CONNECTION")
            .unwrap_or_else(|_| "mysql".to_string())
            .trim_matches('"')
            .to_ascii_lowercase()
            .as_str(),
        "pgsql" | "postgres" | "postgresql"
    )
}

#[inline]
pub(crate) fn is_datetime_column(column: &str) -> bool {
    matches!(
        column,
        "created_at"
            | "updated_at"
            | "deleted_at"
            | "completed_at"
            | "installed_at"
            | "last_run_at"
            | "next_run_at"
    ) || column.ends_with("_at")
}

fn source_i64(row: &SourceRow, column: &str) -> Result<i64, anyhow::Error> {
    source_optional_i64(row, column)?
        .with_context(|| format!("source column `{column}` is unexpectedly null"))
}

fn source_optional_i64(row: &SourceRow, column: &str) -> Result<Option<i64>, anyhow::Error> {
    if let Ok(value) = row.try_get::<Option<i64>, _>(column) {
        return Ok(value);
    }
    if let Ok(value) = row.try_get::<Option<i32>, _>(column) {
        return Ok(value.map(i64::from));
    }
    if let Ok(value) = row.try_get::<Option<bool>, _>(column) {
        return Ok(value.map(i64::from));
    }
    if let Ok(value) = row.try_get::<Option<f64>, _>(column) {
        return Ok(value.map(|value| value as i64));
    }

    match source_optional_text(row, column)? {
        Some(value) => value
            .trim()
            .parse()
            .map(Some)
            .with_context(|| format!("failed to parse source integer column `{column}`")),
        None => row
            .try_column(column)
            .map(|_| None)
            .with_context(|| format!("failed to read source integer column `{column}`")),
    }
}

/// Reads a timestamp, treating missing and unparseable values (such as MySQL zero dates) alike.
fn source_timestamp(row: &SourceRow, column: &str) -> Option<chrono::DateTime<chrono::Utc>> {
    let value = source_optional_text(row, column).ok()??;

    chrono::DateTime::parse_from_rfc3339(&value)
        .map(|value| value.with_timezone(&chrono::Utc))
        .or_else(|_| {
            chrono::NaiveDateTime::parse_from_str(&value, "%Y-%m-%d %H:%M:%S%.f")
                .map(|value| value.and_utc())
        })
        .ok()
}

fn source_readable_uuid(row: &SourceRow, column: &str) -> model::Readable<uuid::Uuid> {
    let value = source_optional_text(row, column)
        .ok()
        .flatten()
        .unwrap_or_default();

    value
        .trim()
        .parse()
        .map_err(|err| model::Unreadable::new(value.as_str(), format!("not a uuid: {err}")))
}

pub(super) struct SourceColumns(HashSet<String>);

impl SourceColumns {
    pub fn has(&self, column: &str) -> bool {
        self.0.contains(column)
    }
}

pub(super) struct SourceContext {
    pool: SourcePool,
    app_key: Vec<u8>,
    prefix: String,
}

impl SourceContext {
    async fn column_types(&self, table: &str) -> Result<Vec<(String, String)>, anyhow::Error> {
        let table = format!("{}{table}", self.prefix);

        let (query, name_column, type_column) = if is_sqlite_source() {
            (format!("PRAGMA table_info(`{table}`)"), "name", "type")
        } else if is_postgres_source() {
            (
                format!(
                    "SELECT column_name::TEXT AS column_name, data_type::TEXT AS data_type FROM information_schema.columns \
                    WHERE table_schema = current_schema() AND table_name = '{table}' \
                    ORDER BY ordinal_position"
                ),
                "column_name",
                "data_type",
            )
        } else {
            (
                format!(
                    "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS \
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '{table}' \
                    ORDER BY ORDINAL_POSITION"
                ),
                "COLUMN_NAME",
                "DATA_TYPE",
            )
        };

        sqlx::query(sqlx::AssertSqlSafe(query))
            .fetch_all(&self.pool)
            .await
            .with_context(|| format!("failed to inspect source table `{table}`"))?
            .iter()
            .map(|column| {
                Ok((
                    source_text(column, name_column)?,
                    source_text(column, type_column)?.to_ascii_lowercase(),
                ))
            })
            .collect()
    }

    pub async fn has_table(&self, table: &str) -> Result<bool, anyhow::Error> {
        Ok(!self.column_types(table).await?.is_empty())
    }

    /// Builds the query for a whole table, casting driver-specific column types to ones
    /// every source database returns the same way.
    async fn select(
        &self,
        table: &str,
        sql_where: Option<&str>,
    ) -> Result<(SourceColumns, String), anyhow::Error> {
        let columns = self.column_types(table).await?;
        if columns.is_empty() {
            anyhow::bail!(
                "table `{}{table}` does not exist in the source database",
                self.prefix
            );
        }

        let is_pg = is_postgres_source();
        let is_sqlite = is_sqlite_source();
        let q = if is_pg { '"' } else { '`' };

        let projection = columns
            .iter()
            .map(|(name, data_type)| {
                let cast = if is_sqlite {
                    is_datetime_column(name).then_some("TEXT")
                } else if is_pg {
                    match data_type.as_str() {
                        "timestamp without time zone"
                        | "timestamp with time zone"
                        | "date"
                        | "time without time zone"
                        | "time with time zone"
                        | "uuid"
                        | "json"
                        | "jsonb" => Some("TEXT"),
                        "smallint" => Some("INTEGER"),
                        _ => None,
                    }
                } else {
                    match data_type.as_str() {
                        "datetime" | "timestamp" | "date" | "time" | "year" | "tinytext"
                        | "text" | "mediumtext" | "longtext" | "tinyblob" | "blob"
                        | "mediumblob" | "longblob" | "json" => Some("CHAR"),
                        "tinyint" | "smallint" | "mediumint" | "int" | "bigint" | "bit" => {
                            Some("SIGNED")
                        }
                        _ => None,
                    }
                };

                match cast {
                    Some(cast) => format!("CAST({q}{name}{q} AS {cast}) AS {q}{name}{q}"),
                    None => format!("{q}{name}{q}"),
                }
            })
            .collect::<Vec<_>>()
            .join(", ");

        let query = format!(
            "SELECT {projection} FROM {q}{}{table}{q} {}",
            self.prefix,
            sql_where.map_or_else(String::new, |sql_where| format!("WHERE {sql_where}"))
        );

        Ok((
            SourceColumns(columns.into_iter().map(|(name, _)| name).collect()),
            query,
        ))
    }

    /// Reads a whole table at once, only meant for small tables.
    pub async fn table(
        &self,
        table: &str,
        sql_where: Option<&str>,
    ) -> Result<Vec<SourceRow>, anyhow::Error> {
        self.map_table(table, sql_where, |_, row| Ok(row.clone()))
            .await
    }

    /// Reads a table row by row, converting each row as it arrives so the driver's rows
    /// are never all held at once.
    pub async fn map_table<T>(
        &self,
        table: &str,
        sql_where: Option<&str>,
        mut map: impl FnMut(&SourceColumns, &SourceRow) -> Result<T, anyhow::Error>,
    ) -> Result<Vec<T>, anyhow::Error> {
        use futures_util::TryStreamExt;

        let (columns, query) = self.select(table, sql_where).await?;
        let mut rows = sqlx::query(sqlx::AssertSqlSafe(query)).fetch(&self.pool);
        let mut mapped = Vec::new();

        while let Some(row) = rows
            .try_next()
            .await
            .with_context(|| format!("failed to read source table `{table}`"))?
        {
            mapped.push(map(&columns, &row).with_context(|| {
                format!(
                    "failed to read row {} of source table `{table}`",
                    mapped.len() + 1
                )
            })?);
        }

        mapped.shrink_to_fit();
        tracing::info!("read {} rows from {table}", mapped.len());

        Ok(mapped)
    }

    pub fn decrypt(&self, value: &str) -> model::Readable<compact_str::CompactString> {
        decrypt_laravel_value(value, &self.app_key).map_err(|err| {
            model::Unreadable::new(
                "<encrypted>",
                format!("cannot be decrypted with the source APP_KEY: {err}"),
            )
        })
    }
}

#[derive(clap::Args)]
pub(super) struct ImportArgs {
    #[arg(
        long = "on-invalid",
        help = "what to do with rows that fail validation",
        value_enum,
        default_value = "ask"
    )]
    on_invalid: issues::OnInvalid,
    #[arg(
        long = "dry-run",
        help = "validate the source data and report problems without writing anything"
    )]
    dry_run: bool,
    #[arg(
        long = "force",
        help = "import into a panel that already contains users, nodes, servers, nests or locations"
    )]
    force: bool,
    #[arg(
        long = "unlimited-as",
        help = "the limit given to servers whose database, allocation or backup limit is unlimited in the source panel",
        default_value_t = 100
    )]
    unlimited_as: i32,
    #[arg(
        long = "report",
        help = "write every problem, fix and skipped row to this file as JSON",
        value_hint = clap::ValueHint::FilePath
    )]
    report: Option<String>,
    #[arg(
        short = 'y',
        long = "yes",
        help = "do not ask for confirmation before writing"
    )]
    yes: bool,
}

async fn apply_settings(
    settings: &shared::settings::Settings,
    source: &model::SourceSettings,
) -> Result<(), anyhow::Error> {
    let mut guard = settings.get_mut().await?;

    guard.app.url = source.app_url.clone();
    if let Some(app_name) = &source.app_name {
        guard.app.name = app_name.clone();
    }

    if let Some(mail) = &source.mail {
        guard.mail_mode = shared::settings::MailMode::Smtp {
            host: mail.host.clone(),
            port: mail.port,
            username: mail.username.clone(),
            password: mail.password.clone(),
            tls_mode: if mail.start_tls {
                shared::settings::TlsMode::StartTls
            } else {
                shared::settings::TlsMode::None
            },
            skip_cert_validation: false,
            helo_domain: None,
            from_address: mail.from_address.clone(),
            from_name: mail.from_name.clone(),
        };
    }

    guard.save().await?;
    settings.set_oobe_step(None).await?;

    Ok(())
}

pub(super) async fn run(
    kind: model::SourceKind,
    environment: &str,
    args: ImportArgs,
    env: Option<Arc<shared::env::Env>>,
) -> Result<i32, anyhow::Error> {
    let start_time = std::time::Instant::now();
    let name = kind.name();

    let Some(env) = env else {
        eprintln!(
            "{}",
            "please setup the new panel environment before importing.".red()
        );
        return Ok(1);
    };

    if let Err(err) = dotenvy::from_path(environment) {
        eprintln!(
            "{}: {:#?}",
            format!("failed to read {name} environment file").red(),
            err
        );
        return Ok(1);
    }

    let app_url = match std::env::var("APP_URL") {
        Ok(value) => value,
        Err(err) => {
            eprintln!(
                "{}: {:#?}",
                format!("failed to read {name} environment APP_URL").red(),
                err
            );
            return Ok(1);
        }
    };
    let app_key = match std::env::var("APP_KEY") {
        Ok(value) => {
            let bytes = if let Some(encoded) = value.strip_prefix("base64:") {
                match BASE64_ENGINE.decode(encoded) {
                    Ok(bytes) => bytes,
                    Err(err) => {
                        eprintln!(
                            "{}: {:#?}",
                            format!("failed to base64-decode {name} APP_KEY").red(),
                            err
                        );
                        return Ok(1);
                    }
                }
            } else {
                value.into_bytes()
            };

            if bytes.len() != 32 {
                eprintln!(
                    "{}: expected 32 bytes, got {}",
                    format!("{name} APP_KEY has wrong length").red(),
                    bytes.len()
                );
                return Ok(1);
            }

            bytes
        }
        Err(err) => {
            eprintln!(
                "{}: {:#?}",
                format!("failed to read {name} environment APP_KEY").red(),
                err
            );
            return Ok(1);
        }
    };
    let pool = match connect_source_database_any(environment).await {
        Ok(pool) => pool,
        Err(err) => {
            eprintln!(
                "{}: {:#?}",
                format!("failed to connect to {name} database").red(),
                err
            );
            return Ok(1);
        }
    };

    let context = SourceContext {
        pool,
        app_key,
        prefix: if is_sqlite_source() {
            String::new()
        } else {
            std::env::var("DB_PREFIX")
                .unwrap_or_default()
                .trim_matches('"')
                .to_string()
        },
    };

    let source = match kind {
        model::SourceKind::Pterodactyl => pterodactyl::read(&context, &app_url).await,
        model::SourceKind::Pelican => pelican::read(&context, &app_url).await,
    };
    let source = match source {
        Ok(source) => source,
        Err(err) => {
            eprintln!(
                "{}: {:#}",
                format!("failed to read the {name} database").red(),
                err
            );
            return Ok(1);
        }
    };

    let cache = shared::cache::Cache::new(&env).await;
    let database = Arc::new(shared::database::Database::new(&env, cache.clone()).await);
    let settings = Arc::new(
        shared::settings::Settings::new(database.clone())
            .await
            .context("failed to load settings")?,
    );

    let target_counts = write::target_counts(&mut *database.write().acquire().await?).await?;
    let occupied: Vec<String> = target_counts
        .iter()
        .filter(|(_, count)| *count > 0)
        .map(|(table, count)| format!("{count} {table}"))
        .collect();
    let target = if occupied.is_empty() {
        model::TargetSnapshot::default()
    } else if args.force {
        eprintln!(
            "{} the panel already contains {}, colliding rows will be reported",
            "warning:".yellow(),
            occupied.join(", ")
        );
        write::load_target_snapshot(&database).await?
    } else {
        eprintln!(
            "{}: it already contains {}. import into a fresh panel, or pass --force to import next to the existing data.",
            "the panel database is not empty".red(),
            occupied.join(", ")
        );
        return Ok(1);
    };

    let options = validate::Options {
        unlimited_as: args.unlimited_as.max(0),
        default_language: settings.get().await?.app.language.clone(),
        languages: shared::FRONTEND_LANGUAGES.clone(),
        server_permissions: shared::permissions::base_server_permission_keys(),
    };

    let interactive = args.on_invalid == issues::OnInvalid::Ask && issues::is_interactive();
    let mut decisions = issues::Decisions::new(args.on_invalid);
    decisions.provisional = !interactive;

    let (plan, findings) = loop {
        let (plan, findings) = validate::build_plan(&source, &target, &options, &decisions);
        if findings.pending.is_empty() {
            break (plan, findings);
        }

        if !interactive {
            findings.print_pending();
            if let Some(report) = &args.report {
                findings.write_report(report)?;
            }
            eprintln!(
                "{}: {} problem(s) found, nothing was written. run the import in a terminal to decide per problem, or pass --on-invalid=fix or --on-invalid=skip.",
                "import aborted".red(),
                findings.pending.len()
            );
            return Ok(1);
        }

        if issues::prompt(&findings, &mut decisions).is_err() {
            eprintln!("{}", "import aborted, nothing was written.".red());
            return Ok(1);
        }
    };

    findings.print_summary();
    if let Some(report) = &args.report {
        findings.write_report(report)?;
    }

    eprintln!("{}", "ready to import:".green().bold());
    for (table, count) in plan.counts() {
        eprintln!("  {count} {table}");
    }

    if args.dry_run {
        eprintln!("{}", "dry run, nothing was written.".green());
        return Ok(0);
    }

    if issues::is_interactive()
        && !args.yes
        && !dialoguer::Confirm::with_theme(&dialoguer::theme::ColorfulTheme::default())
            .with_prompt("Write this to the panel database?")
            .default(true)
            .interact()?
    {
        eprintln!("{}", "import aborted, nothing was written.".red());
        return Ok(1);
    }

    if let Err(err) = write::write_plan(&database, &plan, &target_counts).await {
        eprintln!(
            "{}: {:#}",
            "import failed and was rolled back, nothing was written".red(),
            err
        );
        return Ok(1);
    }

    if let Err(err) = apply_settings(&settings, &source.settings).await {
        eprintln!(
            "{}: {:#}",
            "the data was imported, but the panel settings (url, name, mail) could not be saved; set them in the admin area"
                .yellow(),
            err
        );
    }

    tracing::info!(
        "finished import, took {:.2} seconds. restart the panel if it is running.",
        start_time.elapsed().as_secs_f32()
    );

    Ok(0)
}

pub fn commands(cli: CliCommandGroupBuilder) -> CliCommandGroupBuilder {
    cli.add_command(
        "pterodactyl",
        "Imports data from a Pterodactyl panel.",
        pterodactyl::PterodactylCommand,
    )
    .add_command(
        "pelican",
        "Imports data from a Pelican panel.",
        pelican::PelicanCommand,
    )
}
