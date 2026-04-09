use anyhow::Context;
use base64::Engine;
use futures_util::StreamExt;
use openssl::symm::Cipher;
use serde::Deserialize;
use shared::extensions::commands::CliCommandGroupBuilder;

mod pelican;
mod pterodactyl;

static BASE64_ENGINE: base64::engine::general_purpose::GeneralPurpose =
    base64::engine::general_purpose::GeneralPurpose::new(
        &base64::alphabet::STANDARD,
        base64::engine::general_purpose::GeneralPurposeConfig::new()
            .with_decode_padding_mode(base64::engine::DecodePaddingMode::Indifferent),
    );

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

    let iv = BASE64_ENGINE.decode(&payload.iv)?;
    let value = BASE64_ENGINE.decode(&payload.value)?;

    let key = &decoded_key[0..32];
    let decrypted = openssl::symm::decrypt(Cipher::aes_256_cbc(), key, Some(&iv), &value)?;

    let result = compact_str::CompactString::from_utf8(decrypted)?;

    extract_php_serialized_string(&result)
}

pub async fn process_table<T, Fut: Future<Output = Result<T, anyhow::Error>>>(
    source_database: &sqlx::Pool<sqlx::MySql>,
    table: &str,
    sql_where: Option<&str>,
    compute: impl Fn(Vec<sqlx::mysql::MySqlRow>) -> Fut,
    page_size: usize,
) -> Result<Vec<T>, anyhow::Error> {
    let total: i64 = sqlx::query_scalar(&format!(
        "SELECT COUNT(*) FROM `{table}` {}",
        if let Some(where_clause) = sql_where {
            format!("WHERE {where_clause}")
        } else {
            String::new()
        }
    ))
    .fetch_one(source_database)
    .await
    .context("failed to count total rows for table")?;

    let query = format!(
        "SELECT * FROM `{table}` {}",
        if let Some(where_clause) = sql_where {
            format!("WHERE {where_clause}")
        } else {
            String::new()
        }
    );
    let mut query_rows = sqlx::query(&query).fetch(source_database);

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
