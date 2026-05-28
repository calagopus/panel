use aes::cipher::{BlockModeDecrypt, KeyIvInit, block_padding::Pkcs7};
use anyhow::Context;
use base64::Engine;
use futures_util::StreamExt;
use rsa::{pkcs1::DecodeRsaPublicKey, traits::PublicKeyParts};
use serde::Deserialize;
use shared::extensions::commands::CliCommandGroupBuilder;
use spki::der::Decode;
use sqlx::Row;
use sqlx::any::AnyPoolOptions;
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
};

mod pelican;
mod pterodactyl;

static BASE64_ENGINE: base64::engine::general_purpose::GeneralPurpose =
    base64::engine::general_purpose::GeneralPurpose::new(
        &base64::alphabet::STANDARD,
        base64::engine::general_purpose::GeneralPurposeConfig::new()
            .with_decode_padding_mode(base64::engine::DecodePaddingMode::Indifferent),
    );

#[inline]
fn collect_mappings<K: std::hash::Hash + Eq>(
    mappings: Vec<HashMap<K, uuid::Uuid>>,
) -> HashMap<K, uuid::Uuid> {
    mappings.into_iter().flatten().collect()
}

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
            url.set_username(source_database_username.trim_matches('"'))
                .map_err(|_| anyhow::anyhow!("failed to set source mysql database username"))?;
            url.set_password(Some(source_database_password.trim_matches('"')))
                .map_err(|_| anyhow::anyhow!("failed to set source mysql database password"))?;
            url.set_path(source_database_database.trim_matches('"'));
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
            url.set_username(source_database_username.trim_matches('"'))
                .map_err(|_| anyhow::anyhow!("failed to set source postgres database username"))?;
            url.set_password(Some(source_database_password.trim_matches('"')))
                .map_err(|_| anyhow::anyhow!("failed to set source postgres database password"))?;
            url.set_path(source_database_database.trim_matches('"'));
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

fn source_uuid(row: &SourceRow, column: &str) -> Result<uuid::Uuid, anyhow::Error> {
    row.try_get::<String, _>(column)
        .with_context(|| format!("failed to read source uuid column `{column}`"))?
        .parse::<uuid::Uuid>()
        .with_context(|| format!("failed to parse source uuid column `{column}`"))
}

fn source_datetime(
    row: &SourceRow,
    column: &str,
) -> Result<chrono::DateTime<chrono::Utc>, anyhow::Error> {
    let value: String = row
        .try_get(column)
        .with_context(|| format!("failed to read source datetime column `{column}`"))?;

    chrono::DateTime::parse_from_rfc3339(&value)
        .map(|value| value.with_timezone(&chrono::Utc))
        .or_else(|_| {
            chrono::NaiveDateTime::parse_from_str(&value, "%Y-%m-%d %H:%M:%S%.f")
                .map(|value| value.and_utc())
        })
        .or_else(|_| {
            chrono::NaiveDateTime::parse_from_str(&value, "%Y-%m-%d %H:%M:%S")
                .map(|value| value.and_utc())
        })
        .with_context(|| format!("failed to parse source datetime column `{column}`"))
}

fn source_optional_datetime(
    row: &SourceRow,
    column: &str,
) -> Result<Option<chrono::DateTime<chrono::Utc>>, anyhow::Error> {
    let value = row
        .try_get::<Option<String>, _>(column)
        .with_context(|| format!("failed to read source datetime column `{column}`"))?;

    value
        .map(|value| {
            chrono::DateTime::parse_from_rfc3339(&value)
                .map(|value| value.with_timezone(&chrono::Utc))
                .or_else(|_| {
                    chrono::NaiveDateTime::parse_from_str(&value, "%Y-%m-%d %H:%M:%S%.f")
                        .map(|value| value.and_utc())
                })
                .or_else(|_| {
                    chrono::NaiveDateTime::parse_from_str(&value, "%Y-%m-%d %H:%M:%S")
                        .map(|value| value.and_utc())
                })
                .with_context(|| format!("failed to parse source datetime column `{column}`"))
        })
        .transpose()
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
    }

    let payload: LaravelEncrypted = serde_json::from_slice(&decoded)?;

    let decoded_iv = BASE64_ENGINE.decode(&payload.iv)?;
    let mut value = BASE64_ENGINE.decode(&payload.value)?;

    let Ok(key) = <&[u8; 32]>::try_from(decoded_key) else {
        return Err(anyhow::anyhow!(
            "decoded key must be at least 32 bytes, got {}",
            decoded_key.len()
        ));
    };
    let Ok(iv) = <&[u8; 16]>::try_from(decoded_iv.as_slice()) else {
        return Err(anyhow::anyhow!(
            "IV must be 16 bytes for AES-256-CBC, got {}",
            decoded_iv.len()
        ));
    };

    let decrypted = cbc::Decryptor::<aes::Aes256>::new(key.into(), iv.into())
        .decrypt_padded::<Pkcs7>(&mut value)
        .map_err(|e| anyhow::anyhow!("AES-256-CBC decryption failed: {e}"))?;

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

pub async fn process_table<DB, T, Fut: Future<Output = Result<T, anyhow::Error>>>(
    source_database: &sqlx::Pool<DB>,
    table: &str,
    sql_where: Option<&str>,
    compute: impl Fn(Vec<DB::Row>) -> Fut,
    page_size: usize,
) -> Result<Vec<T>, anyhow::Error>
where
    DB: sqlx::Database,
    for<'q> <DB as sqlx::Database>::Arguments: sqlx::IntoArguments<DB>,
    for<'c> &'c sqlx::Pool<DB>: sqlx::Executor<'c, Database = DB>,
    for<'r> &'r str: sqlx::ColumnIndex<DB::Row>,
    usize: sqlx::ColumnIndex<DB::Row>,
    for<'r> i64: sqlx::Decode<'r, DB> + sqlx::Type<DB>,
    for<'r> String: sqlx::Decode<'r, DB> + sqlx::Type<DB>,
{
    let is_pg = is_postgres_source();
    let q = if is_pg { '"' } else { '`' };

    let projection = if is_sqlite_source() {
        let pragma_query = format!("PRAGMA table_info(`{table}`)");
        let columns: Vec<DB::Row> = sqlx::query::<DB>(sqlx::AssertSqlSafe(pragma_query))
            .fetch_all(source_database)
            .await?;
        columns
            .into_iter()
            .map(|column| {
                let name: String = column.try_get("name")?;
                Ok::<_, anyhow::Error>(if is_datetime_column(&name) {
                    format!("CAST(`{name}` AS TEXT) AS `{name}`")
                } else {
                    format!("`{name}`")
                })
            })
            .collect::<Result<Vec<_>, _>>()?
            .join(", ")
    } else if is_pg {
        let info_query = format!(
            "SELECT column_name::TEXT, data_type::TEXT FROM information_schema.columns \
            WHERE table_schema = 'public' AND table_name = '{table}' \
            ORDER BY ordinal_position"
        );
        let columns: Vec<DB::Row> = sqlx::query::<DB>(sqlx::AssertSqlSafe(info_query))
            .fetch_all(source_database)
            .await?;
        if columns.is_empty() {
            "*".to_string()
        } else {
            columns
                .into_iter()
                .map(|column| {
                    let name: String = column.try_get("column_name")?;
                    let data_type: String = column.try_get("data_type")?;
                    Ok::<_, anyhow::Error>(match data_type.as_str() {
                        "timestamp without time zone"
                        | "timestamp with time zone"
                        | "date"
                        | "time without time zone"
                        | "time with time zone"
                        | "uuid"
                        | "json"
                        | "jsonb" => {
                            format!("CAST(\"{name}\" AS TEXT) AS \"{name}\"")
                        }
                        "smallint" => format!("CAST(\"{name}\" AS INTEGER) AS \"{name}\""),
                        _ => format!("\"{name}\""),
                    })
                })
                .collect::<Result<Vec<_>, _>>()?
                .join(", ")
        }
    } else {
        let info_query = format!(
            "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS \
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '{table}' \
            ORDER BY ORDINAL_POSITION"
        );
        let columns: Vec<DB::Row> = sqlx::query::<DB>(sqlx::AssertSqlSafe(info_query))
            .fetch_all(source_database)
            .await?;
        if columns.is_empty() {
            "*".to_string()
        } else {
            columns
                .into_iter()
                .map(|column| {
                    let name: String = column.try_get("COLUMN_NAME")?;
                    let data_type: String = column.try_get("DATA_TYPE")?;
                    Ok::<_, anyhow::Error>(match data_type.to_ascii_lowercase().as_str() {
                        "datetime" | "timestamp" | "date" | "time" | "year" => {
                            format!("CAST(`{name}` AS CHAR) AS `{name}`")
                        }
                        "tinyint" | "smallint" | "mediumint" | "bit" => {
                            format!("CAST(`{name}` AS SIGNED) AS `{name}`")
                        }
                        "tinytext" | "text" | "mediumtext" | "longtext" | "tinyblob" | "blob"
                        | "mediumblob" | "longblob" => {
                            format!("CAST(`{name}` AS CHAR) AS `{name}`")
                        }
                        _ => format!("`{name}`"),
                    })
                })
                .collect::<Result<Vec<_>, _>>()?
                .join(", ")
        }
    };

    let total: i64 = sqlx::query_scalar::<DB, i64>(sqlx::AssertSqlSafe(format!(
        "SELECT COUNT(*) FROM {q}{table}{q} {}",
        if let Some(where_clause) = sql_where {
            format!("WHERE {where_clause}")
        } else {
            String::new()
        }
    )))
    .fetch_one(source_database)
    .await
    .context("failed to count total rows for table")?;

    let query = format!(
        "SELECT {projection} FROM {q}{table}{q} {}",
        if let Some(where_clause) = sql_where {
            format!("WHERE {where_clause}")
        } else {
            String::new()
        }
    );
    let mut query_rows = sqlx::query::<DB>(sqlx::AssertSqlSafe(query)).fetch(source_database);

    let mut processed_rows: usize = 0;
    let mut results = Vec::new();
    let mut rows = Vec::new();

    loop {
        rows.reserve_exact(page_size);
        while let Some(row) = query_rows.next().await {
            rows.push(row?);

            if rows.len() >= page_size {
                break;
            }
        }

        if rows.is_empty() {
            break;
        }

        let batch = std::mem::take(&mut rows);
        let batch_len = batch.len();
        let result = compute(batch).await?;

        if std::mem::size_of::<T>() > 0 {
            results.push(result);
        }

        processed_rows += batch_len;

        let percent = if total > 0 {
            (processed_rows as f64 / total as f64) * 100.0
        } else {
            100.0
        };

        let bar_width = 40;
        let filled = if total > 0 {
            (processed_rows as f64 / total as f64 * bar_width as f64).round() as usize
        } else {
            bar_width
        };
        let empty = bar_width.saturating_sub(filled);

        tracing::info!(
            "{} [{}{}] {:.2}% ({}/{})",
            table,
            "=".repeat(filled),
            " ".repeat(empty),
            percent,
            processed_rows,
            total
        );
    }

    tracing::info!("");
    results.shrink_to_fit();

    Ok(results)
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
