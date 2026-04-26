use super::{
    BASE64_ENGINE, collect_mappings, decrypt_laravel_value, is_datetime_column, is_sqlite_source,
    process_table,
};
use anyhow::Context;
use base64::Engine;
use clap::{Args, FromArgMatches};
use colored::Colorize;
use compact_str::ToCompactString;
use shared::models::database_host::DatabaseCredentials;
use sqlx::Row;
use sqlx::any::AnyPoolOptions;
use std::{
    collections::{HashMap, HashSet},
    path::{Path, PathBuf},
    str::FromStr,
    sync::Arc,
};

type SourcePool = sqlx::AnyPool;
type SourceRow = sqlx::any::AnyRow;

#[inline]
fn first_import_tag(raw_tags: Option<&str>, fallback: &str) -> compact_str::CompactString {
    raw_tags
        .and_then(|raw_tags| serde_json::from_str::<Vec<String>>(raw_tags).ok())
        .and_then(|tags| {
            tags.into_iter().find_map(|tag| {
                let tag = tag.trim();
                (!tag.is_empty()).then(|| tag.to_compact_string())
            })
        })
        .unwrap_or_else(|| fallback.to_compact_string())
}

#[inline]
fn derive_name_parts(username: &str) -> (compact_str::CompactString, compact_str::CompactString) {
    let mut parts = username
        .split([' ', '_', '-', '.'])
        .filter(|part| !part.is_empty())
        .map(compact_str::CompactString::from);

    let first = parts.next().unwrap_or_else(|| username.to_compact_string());
    let last = parts.next().unwrap_or_else(|| username.to_compact_string());

    (first, last)
}

async fn connect_source_database_any(environment_path: &str) -> Result<SourcePool, anyhow::Error> {
    sqlx::any::install_default_drivers();

    let connection = std::env::var("DB_CONNECTION")
        .unwrap_or_else(|_| "mysql".to_string())
        .trim_matches('"')
        .to_ascii_lowercase();

    let database_url = match connection.as_str() {
        "mysql" | "mariadb" => {
            let source_database_host =
                std::env::var("DB_HOST").context("failed to read pelican environment DB_HOST")?;
            let source_database_port = std::env::var("DB_PORT")
                .unwrap_or_else(|_| "3306".to_string())
                .parse::<u16>()
                .context("failed to parse pelican environment DB_PORT")?;
            let source_database_database = std::env::var("DB_DATABASE")
                .context("failed to read pelican environment DB_DATABASE")?;
            let source_database_username = std::env::var("DB_USERNAME")
                .context("failed to read pelican environment DB_USERNAME")?;
            let source_database_password = std::env::var("DB_PASSWORD")
                .context("failed to read pelican environment DB_PASSWORD")?;

            let mut url = reqwest::Url::parse("mysql://localhost")
                .context("failed to construct pelican mysql database url")?;
            url.set_host(Some(source_database_host.trim_matches('"')))
                .context("failed to set pelican mysql database host")?;
            url.set_port(Some(source_database_port))
                .map_err(|_| anyhow::anyhow!("failed to set pelican mysql database port"))?;
            url.set_username(source_database_username.trim_matches('"'))
                .map_err(|_| anyhow::anyhow!("failed to set pelican mysql database username"))?;
            url.set_password(Some(source_database_password.trim_matches('"')))
                .map_err(|_| anyhow::anyhow!("failed to set pelican mysql database password"))?;
            url.set_path(source_database_database.trim_matches('"'));
            url.to_string()
        }
        "sqlite" | "sqlite3" => {
            let source_database_database = std::env::var("DB_DATABASE")
                .context("failed to read pelican environment DB_DATABASE")?;
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
        _ => {
            return Err(anyhow::anyhow!(
                "unsupported source database driver `{connection}`; expected mysql, mariadb, sqlite, or sqlite3"
            ));
        }
    };

    AnyPoolOptions::new()
        .connect(&database_url)
        .await
        .with_context(|| format!("failed to connect to source database using `{connection}`"))
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

async fn source_query_rows(
    source_database: &SourcePool,
    table: &str,
    columns: &[&str],
) -> Result<Vec<SourceRow>, anyhow::Error> {
    let projection = columns
        .iter()
        .map(|column| {
            if is_sqlite_source() && is_datetime_column(column) {
                format!("CAST(`{column}` AS TEXT) AS `{column}`")
            } else {
                format!("`{column}`")
            }
        })
        .collect::<Vec<_>>()
        .join(", ");

    let query = format!("SELECT {projection} FROM `{table}`");
    Ok(sqlx::query(&query).fetch_all(source_database).await?)
}

#[derive(Args)]
pub struct PelicanArgs {
    #[arg(
        short = 'e',
        long = "environment",
        help = "the environment variable file location for the pelican panel",
        default_value = "/var/www/pelican/.env",
        value_hint = clap::ValueHint::FilePath
    )]
    environment: String,
}

pub struct PelicanCommand;

impl shared::extensions::commands::CliCommand<PelicanArgs> for PelicanCommand {
    fn get_command(&self, command: clap::Command) -> clap::Command {
        command
    }

    fn get_executor(self) -> Box<shared::extensions::commands::ExecutorFunc> {
        Box::new(|env, arg_matches| {
            Box::pin(async move {
                let args = PelicanArgs::from_arg_matches(&arg_matches)?;

                let start_time = std::time::Instant::now();

                let env = match env {
                    Some(env) => env,
                    None => {
                        eprintln!(
                            "{}",
                            "please setup the new panel environment before importing.".red()
                        );

                        return Ok(1);
                    }
                };

                if let Err(err) = dotenvy::from_path(&args.environment) {
                    eprintln!(
                        "{}: {:#?}",
                        "failed to read pelican environment file".red(),
                        err
                    );

                    return Ok(1);
                }

                let source_app_url = match std::env::var("APP_URL") {
                    Ok(value) => value,
                    Err(err) => {
                        eprintln!(
                            "{}: {:#?}",
                            "failed to read pelican environment APP_URL".red(),
                            err
                        );

                        return Ok(1);
                    }
                };
                let source_app_key = match std::env::var("APP_KEY").map(|v| {
                    BASE64_ENGINE
                        .decode(v.trim_start_matches("base64:"))
                        .unwrap_or_else(|_| v.into_bytes())
                }) {
                    Ok(value) => Arc::new(value),
                    Err(err) => {
                        eprintln!(
                            "{}: {:#?}",
                            "failed to read pelican environment APP_KEY".red(),
                            err
                        );

                        return Ok(1);
                    }
                };
                let source_database = match connect_source_database_any(&args.environment).await {
                    Ok(database) => database,
                    Err(err) => {
                        eprintln!(
                            "{}: {:#?}",
                            "failed to connect to pelican database".red(),
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

                if let Err(err) = process_table(
                    &source_database,
                    "settings",
                    None,
                    async |rows| {
                        let mut settings = settings.get_mut().await?;

                        let mut source_settings: HashMap<&str, compact_str::CompactString> = rows
                            .iter()
                            .map(|r| {
                                (
                                    r.get::<&str, _>("key"),
                                    r.get::<&str, _>("value").to_compact_string(),
                                )
                            })
                            .collect();

                        settings.oobe_step = None;
                        settings.app.url = source_app_url.to_compact_string();
                        if let Some(app_name) = source_settings.remove("settings::app:name") {
                            settings.app.name = app_name;
                        }

                        if let Some(smtp_host) =
                            source_settings.remove("settings::mail:mailers:smtp:host")
                            && let Some(Ok(smtp_port)) = source_settings
                                .remove("settings::mail:mailers:smtp:port")
                                .map(|p| p.parse::<u16>())
                            && let Some(from_address) =
                                source_settings.remove("settings::mail:from:address")
                        {
                            settings.mail_mode = shared::settings::MailMode::Smtp {
                                host: smtp_host,
                                port: smtp_port,
                                username: source_settings
                                    .remove("settings::mail:mailers:smtp:username"),
                                password: source_settings
                                    .remove("settings::mail:mailers:smtp:password")
                                    .and_then(|p| decrypt_laravel_value(&p, &source_app_key).ok()),
                                use_tls: source_settings
                                    .remove("settings::mail:mailers:smtp:encryption")
                                    .is_some_and(|e| e == "tls"),
                                from_address,
                                from_name: source_settings.remove("settings::mail:from:name"),
                            };
                        }

                        settings.save().await?;

                        Ok(())
                    },
                    100000,
                )
                .await
                {
                    tracing::error!("failed to process settings table: {:?}", err);
                    return Ok(1);
                }

                let admin_user_ids = match sqlx::query_scalar::<sqlx::Any, i32>(
                    r#"
                    SELECT DISTINCT model_has_roles.model_id
                    FROM model_has_roles
                    JOIN roles ON roles.id = model_has_roles.role_id
                    WHERE model_has_roles.model_type = 'user'
                      AND LOWER(roles.name) = 'root admin'
                    "#,
                )
                .fetch_all(&source_database)
                .await
                {
                    Ok(ids) => Arc::new(ids.into_iter().collect::<HashSet<i32>>()),
                    Err(err) => {
                        tracing::warn!("failed to load pelican role assignments: {:?}", err);
                        Arc::new(HashSet::new())
                    }
                };

                let user_mappings = match process_table(
                    &source_database,
                    "users",
                    None,
                    async |rows| {
                        let mut mapping = HashMap::with_capacity(rows.len());
                        let mut futures = Vec::with_capacity(rows.len());

                        for row in rows {
                            let id: i32 = row.try_get("id")?;
                            let uuid = source_uuid(&row, "uuid")?;

                            mapping.insert(id, uuid);

                            let admin_user_ids = admin_user_ids.clone();
                            let database = database.clone();
                            futures.push(async move {
                                let external_id: Option<&str> = row.try_get("external_id")?;
                                let username: &str = row.try_get("username")?;
                                let email: &str = row.try_get("email")?;
                                let password: &str = row.try_get("password")?;
                                let language: Option<&str> = row.try_get("language")?;
                                let mfa_app_secret: Option<&str> = row.try_get("mfa_app_secret")?;
                                let created = source_datetime(&row, "created_at")?;
                                let (name_first, name_last) = derive_name_parts(username);
                                let admin = admin_user_ids.contains(&id);
                                let totp_secret = mfa_app_secret.map(compact_str::CompactString::from);
                                let totp_enabled = totp_secret.is_some();

                                sqlx::query(
                                    r#"
                                    INSERT INTO users (uuid, external_id, username, email, name_first, name_last, password, admin, totp_enabled, totp_secret, language, created)
                                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                                    ON CONFLICT DO NOTHING
                                    "#
                                )
                                .bind(uuid)
                                .bind(external_id)
                                .bind(username)
                                .bind(email)
                                .bind(name_first)
                                .bind(name_last)
                                .bind(password.replace("$2y$", "$2a$"))
                                .bind(admin)
                                .bind(totp_enabled)
                                .bind(totp_secret)
                                .bind(language.unwrap_or("en"))
                                .bind(created)
                                .execute(database.write())
                                .await?;

                                Ok::<(), anyhow::Error>(())
                            });
                        }

                        futures_util::future::try_join_all(futures).await?;

                        Ok(mapping)
                    },
                    64,
                )
                .await
                {
                    Ok(mappings) => Arc::new(collect_mappings(mappings)),
                    Err(err) => {
                        tracing::error!("failed to process users table: {:?}", err);
                        return Ok(1);
                    }
                };

                if let Err(err) = process_table(
                    &source_database,
                    "user_ssh_keys",
                    Some("deleted_at IS NULL"),
                    async |rows| {
                        let mut futures = Vec::with_capacity(rows.len());

                        for row in rows {
                            let user_mappings = user_mappings.clone();
                            let database = database.clone();
                            futures.push(async move {
                                let user_id: i32 = row.try_get("user_id")?;
                                let name: &str = row.try_get("name")?;
                                let public_key: &str = row.try_get("public_key")?;
                                let created = source_datetime(&row, "created_at")?;

                                let user_uuid = match user_mappings.get(&user_id) {
                                    Some(uuid) => uuid,
                                    None => return Ok(()),
                                };

                                let base64_data = public_key
                                    .replace("-----BEGIN PUBLIC KEY-----", "")
                                    .replace("-----END PUBLIC KEY-----", "")
                                    .replace("\r\n", "")
                                    .replace("\n", "");
                                let base64_data = BASE64_ENGINE.decode(base64_data)?;

                                let pkey = openssl::pkey::PKey::public_key_from_der(&base64_data)?;
                                let public_key = russh::keys::PublicKey::from(match pkey.id() {
                                    openssl::pkey::Id::RSA => {
                                        let rsa = pkey.rsa()?;

                                        russh::keys::ssh_key::public::KeyData::Rsa(
                                            russh::keys::ssh_key::public::RsaPublicKey {
                                                e: rsa.e().to_vec().as_slice().try_into()?,
                                                n: rsa.n().to_vec().as_slice().try_into()?,
                                            },
                                        )
                                    }
                                    openssl::pkey::Id::ED25519 => {
                                        let data = pkey.raw_public_key()?;

                                        russh::keys::ssh_key::public::KeyData::Ed25519(
                                            russh::keys::ssh_key::public::Ed25519PublicKey(
                                                data.try_into().map_err(|_| {
                                                    anyhow::anyhow!("invalid ed25519 public key length")
                                                })?,
                                            ),
                                        )
                                    }
                                    _ => return Ok(()),
                                });

                                sqlx::query(
                                    r#"
                                    INSERT INTO user_ssh_keys (user_uuid, name, fingerprint, public_key, created)
                                    VALUES ($1, $2, $3, $4, $5)
                                    ON CONFLICT DO NOTHING
                                    "#,
                                )
                                .bind(user_uuid)
                                .bind(name)
                                .bind(
                                    public_key
                                        .fingerprint(russh::keys::HashAlg::Sha256)
                                        .to_string(),
                                )
                                .bind(public_key.to_bytes().unwrap_or_default())
                                .bind(created)
                                .execute(database.write())
                                .await?;

                                Ok::<(), anyhow::Error>(())
                            });
                        }

                        futures_util::future::try_join_all(futures).await?;

                        Ok(())
                    },
                    64,
                )
                .await
                {
                    tracing::error!("failed to process ssh keys table: {:?}", err);
                    return Ok(1);
                }

                let backup_configuration_uuid: uuid::Uuid = {
                    let row = sqlx::query(
                        r#"
                        INSERT INTO backup_configurations (name, description, backup_disk, backup_configs)
                        VALUES ($1, $2, $3, $4)
                        RETURNING uuid
                        "#,
                    )
                    .bind("global")
                    .bind("automatically generated by import")
                    .bind(shared::models::server_backup::BackupDisk::Local)
                    .bind(
                        serde_json::to_value(
                            shared::models::backup_configuration::BackupConfigs::default(),
                        )?,
                    )
                    .fetch_one(database.write())
                    .await?;

                    row.get("uuid")
                };

                let location_mappings = match async {
                    let rows = source_query_rows(&source_database, "nodes", &["id", "tags", "created_at"])
                        .await?;
                        let mut mapping = HashMap::with_capacity(rows.len());
                        let mut created_locations: HashMap<compact_str::CompactString, uuid::Uuid> =
                            HashMap::new();

                        for row in rows {
                            let id: i32 = row.try_get("id")?;
                            let tag = first_import_tag(
                                row.try_get::<Option<&str>, _>("tags")?,
                                "pelican",
                            );
                            let created = source_optional_datetime(&row, "created_at")?;

                            let location_uuid = if let Some(uuid) = created_locations.get(&tag) {
                                *uuid
                            } else {
                                let row = sqlx::query(
                                    r#"
                                    INSERT INTO locations (backup_configuration_uuid, name, description, created)
                                    VALUES ($1, $2, $3, $4)
                                    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                                    RETURNING uuid
                                    "#,
                                )
                                .bind(backup_configuration_uuid)
                                .bind(&tag)
                                .bind(Some(format!(
                                    "generated from Pelican node tag `{tag}` during import"
                                )))
                                .bind(created.unwrap_or_else(chrono::Utc::now))
                                .fetch_one(database.write())
                                .await?;

                                let uuid = row.get("uuid");
                                created_locations.insert(tag, uuid);
                                uuid
                            };

                            mapping.insert(id, location_uuid);
                        }

                        Ok::<Arc<HashMap<i32, uuid::Uuid>>, anyhow::Error>(Arc::new(mapping))
                    }
                .await
                {
                    Ok(mappings) => mappings,
                    Err(err) => {
                        tracing::error!("failed to synthesize locations from pelican tags: {:?}", err);
                        return Ok(1);
                    }
                };

                let node_mappings = match process_table(
                    &source_database,
                    "nodes",
                    None,
                    async |rows| {
                        let mut mapping = HashMap::with_capacity(rows.len());
                        let mut futures = Vec::with_capacity(rows.len());

                        for row in rows {
                            let id: i32 = row.try_get("id")?;
                            let uuid = source_uuid(&row, "uuid")?;

                            mapping.insert(id, uuid);

                            let source_app_key = source_app_key.clone();
                            let location_mappings = location_mappings.clone();
                            let database = database.clone();
                            futures.push(async move {
                                let name: &str = row.try_get("name")?;
                                let description: Option<&str> = row.try_get("description")?;
                                let public = source_bool(&row, "public")?;
                                let maintenance_mode = source_bool(&row, "maintenance_mode")?;
                                let fqdn: &str = row.try_get("fqdn")?;
                                let scheme: &str = row.try_get("scheme")?;
                                let memory: i64 = row.try_get("memory")?;
                                let disk: i64 = row.try_get("disk")?;
                                let token_id: &str = row.try_get("daemon_token_id")?;
                                let token: &str = row.try_get("daemon_token")?;
                                let daemon_listen: i32 = row.try_get("daemon_listen")?;
                                let daemon_sftp: i32 = row.try_get("daemon_sftp")?;
                                let created = source_datetime(&row, "created_at")?;

                                let location_uuid = match location_mappings.get(&id) {
                                    Some(uuid) => uuid,
                                    None => return Ok(()),
                                };

                                let token = match decrypt_laravel_value(token, &source_app_key) {
                                    Ok(token) => token,
                                    Err(_) => return Ok(()),
                                };

                                let url: reqwest::Url = match format!("{}://{}:{}", scheme, fqdn, daemon_listen).parse() {
                                    Ok(url) => url,
                                    Err(_) => return Ok(()),
                                };

                                sqlx::query(
                                    r#"
                                    INSERT INTO nodes (uuid, name, description, deployment_enabled, maintenance_enabled, location_uuid, url, sftp_port, memory, disk, token_id, token, created)
                                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                                    ON CONFLICT DO NOTHING
                                    "#
                                )
                                .bind(uuid)
                                .bind(name)
                                .bind(description)
                                .bind(public)
                                .bind(maintenance_mode)
                                .bind(location_uuid)
                                .bind(url.to_string())
                                .bind(daemon_sftp)
                                .bind(memory)
                                .bind(disk)
                                .bind(token_id)
                                .bind(database.encrypt(token).await.unwrap_or_default())
                                .bind(created)
                                .execute(database.write())
                                .await?;

                                Ok::<(), anyhow::Error>(())
                            });
                        }

                        futures_util::future::try_join_all(futures).await?;

                        Ok(mapping)
                    },
                    64,
                )
                .await
                {
                    Ok(mappings) => Arc::new(collect_mappings(mappings)),
                    Err(err) => {
                        tracing::error!("failed to process nodes table: {:?}", err);
                        return Ok(1);
                    }
                };

                drop(location_mappings);

                let nest_mappings = match async {
                    let rows =
                        source_query_rows(&source_database, "eggs", &["id", "author", "tags", "created_at"])
                            .await?;
                        let mut mapping = HashMap::with_capacity(rows.len());
                        let mut created_nests: HashMap<compact_str::CompactString, uuid::Uuid> =
                            HashMap::new();

                        for row in rows {
                            let id: i32 = row.try_get("id")?;
                            let author: &str = row.try_get("author")?;
                            let tag = first_import_tag(
                                row.try_get::<Option<&str>, _>("tags")?,
                                "pelican",
                            );
                            let created = source_optional_datetime(&row, "created_at")?;

                            let nest_uuid = if let Some(uuid) = created_nests.get(&tag) {
                                *uuid
                            } else {
                                let row = sqlx::query(
                                    r#"
                                    INSERT INTO nests (author, name, description, created)
                                    VALUES ($1, $2, $3, $4)
                                    ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
                                    RETURNING uuid
                                    "#,
                                )
                                .bind(author)
                                .bind(&tag)
                                .bind(Some(format!(
                                    "generated from Pelican egg tag `{tag}` during import"
                                )))
                                .bind(created.unwrap_or_else(chrono::Utc::now))
                                .fetch_one(database.write())
                                .await?;

                                let uuid = row.get("uuid");
                                created_nests.insert(tag, uuid);
                                uuid
                            };

                            mapping.insert(id, nest_uuid);
                        }

                        Ok::<Arc<HashMap<i32, uuid::Uuid>>, anyhow::Error>(Arc::new(mapping))
                    }
                .await
                {
                    Ok(mappings) => mappings,
                    Err(err) => {
                        tracing::error!("failed to synthesize nests from pelican tags: {:?}", err);
                        return Ok(1);
                    }
                };

                let egg_mappings = match process_table(
                    &source_database,
                    "eggs",
                    None,
                    async |rows| {
                        let mut mapping = HashMap::with_capacity(rows.len());

                        for row in rows {
                            let id: i32 = row.try_get("id")?;
                            let uuid = source_uuid(&row, "uuid")?;
                            let author: &str = row.try_get("author")?;
                            let name: &str = row.try_get("name")?;
                            let description: Option<&str> = row.try_get("description")?;
                            let features: Option<&str> = row.try_get("features")?;
                            let docker_images: &str = row.try_get("docker_images")?;
                            let file_denylist: Option<&str> = row.try_get("file_denylist")?;
                            let config_files: Option<&str> = row.try_get("config_files")?;
                            let config_startup: Option<&str> = row.try_get("config_startup")?;
                            let config_stop = row
                                .try_get::<Option<&str>, _>("config_stop")?
                                .map(compact_str::CompactString::from);
                            let config_script = shared::models::nest_egg::NestEggConfigScript {
                                container: row.try_get::<String, _>("script_container")?.into(),
                                entrypoint: row.try_get::<String, _>("script_entry")?.into(),
                                content: row.try_get("script_install").unwrap_or_default(),
                            };
                            let startup_commands: Option<&str> = row.try_get("startup_commands")?;
                            let force_outgoing_ip = source_bool(&row, "force_outgoing_ip")?;
                            let created = source_datetime(&row, "created_at")?;

                            let nest_uuid = match nest_mappings.get(&id) {
                                Some(uuid) => uuid,
                                None => continue,
                            };

                            let features: Vec<String> = features
                                .and_then(|value| serde_json::from_str(value).ok())
                                .unwrap_or_default();
                            let docker_images: serde_json::Value =
                                serde_json::from_str(docker_images).unwrap_or_default();
                            let file_denylist: Vec<String> = file_denylist
                                .and_then(|value| serde_json::from_str(value).ok())
                                .unwrap_or_default();

                            let config_files: Vec<
                                shared::models::nest_egg::ProcessConfigurationFile,
                            > = config_files
                                .and_then(|value| serde_json::from_str(value).ok())
                                .unwrap_or_default();
                            let mut config_startup: shared::models::nest_egg::NestEggConfigStartup =
                                config_startup
                                    .and_then(|value| serde_json::from_str(value).ok())
                                    .unwrap_or_default();
                            let startup = startup_commands
                                .and_then(|value| {
                                    serde_json::from_str::<HashMap<String, String>>(value)
                                        .ok()
                                        .and_then(|mut commands| {
                                            commands
                                                .remove("Default")
                                                .or_else(|| commands.into_values().next())
                                        })
                                })
                                .unwrap_or_default();
                            let config_stop: shared::models::nest_egg::NestEggConfigStop =
                                serde_json::from_str(config_stop.as_deref().unwrap_or(""))
                                    .unwrap_or_else(|_| {
                                        shared::models::nest_egg::NestEggConfigStop {
                                            r#type: if config_stop.as_deref() == Some("^C") || config_stop.as_deref() == Some("^^C") {
                                                "signal".into()
                                            } else {
                                                "command".into()
                                            },
                                            value: match config_stop.as_deref() {
                                                Some("^C") => Some("SIGINT".into()),
                                                Some("^^C") => Some("SIGKILL".into()),
                                                _ => config_stop,
                                            },
                                        }
                                    });

                            if config_startup.done.is_empty() {
                                config_startup.done.push("".into());
                            }

                            let row = sqlx::query(
                                r#"
                                INSERT INTO nest_eggs (
                                    uuid, nest_uuid, author, name, description, features, docker_images,
                                    file_denylist, config_files, config_startup, config_stop,
                                    config_script, startup, force_outgoing_ip, created
                                )
                                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                                ON CONFLICT (nest_uuid, name) DO UPDATE SET description = EXCLUDED.description
                                RETURNING uuid
                                "#,
                            )
                            .bind(uuid)
                            .bind(nest_uuid)
                            .bind(author)
                            .bind(name)
                            .bind(description)
                            .bind(features)
                            .bind(docker_images)
                            .bind(file_denylist)
                            .bind(serde_json::to_value(config_files)?)
                            .bind(serde_json::to_value(config_startup)?)
                            .bind(serde_json::to_value(config_stop)?)
                            .bind(serde_json::to_value(config_script)?)
                            .bind(startup)
                            .bind(force_outgoing_ip)
                            .bind(created)
                            .fetch_one(database.write())
                            .await?;

                            mapping.insert(id, row.get("uuid"));
                        }

                        Ok(mapping)
                    },
                    256,
                )
                .await
                {
                    Ok(mappings) => Arc::new(collect_mappings(mappings)),
                    Err(err) => {
                        tracing::error!("failed to process eggs table: {:?}", err);
                        return Ok(1);
                    }
                };

                drop(nest_mappings);

                let egg_variable_mappings = match process_table(
                    &source_database,
                    "egg_variables",
                    None,
                    async |rows| {
                        let mut mapping: HashMap<i32, uuid::Uuid> = HashMap::with_capacity(rows.len());

                        for row in rows {
                            let id: i32 = row.try_get("id")?;
                            let egg_id: i32 = row.try_get("egg_id")?;
                            let name: &str = row.try_get("name")?;
                            let description: Option<&str> = row.try_get("description")?;
                            let env_variable: &str = row.try_get("env_variable")?;
                            let default_value: Option<&str> = row.try_get("default_value")?;
                            let user_viewable = source_bool(&row, "user_viewable")?;
                            let user_editable = source_bool(&row, "user_editable")?;
                            let rules: &str = row.try_get("rules")?;
                            let created = source_datetime(&row, "created_at")?;

                            let egg_uuid = match egg_mappings.get(&egg_id) {
                                Some(uuid) => uuid,
                                None => continue,
                            };
                            let rules = serde_json::from_str::<Vec<String>>(rules)
                                .map(|rules| {
                                    rules
                                        .into_iter()
                                        .map(compact_str::CompactString::from)
                                        .collect::<Vec<_>>()
                                })
                                .unwrap_or_else(|_| {
                                    rules
                                        .split('|')
                                        .map(compact_str::CompactString::from)
                                        .collect::<Vec<_>>()
                                });

                            if rule_validator::validate_rules(&rules, &()).is_err() {
                                continue;
                            }

                            let row = sqlx::query(
                                r#"
                                INSERT INTO nest_egg_variables (egg_uuid, name, description, env_variable, default_value, user_viewable, user_editable, rules, created)
                                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                                ON CONFLICT (egg_uuid, env_variable) DO UPDATE SET env_variable = EXCLUDED.env_variable
                                RETURNING uuid
                                "#,
                            )
                            .bind(egg_uuid)
                            .bind(name)
                            .bind(description)
                            .bind(env_variable)
                            .bind(default_value)
                            .bind(user_viewable)
                            .bind(user_editable)
                            .bind(rules)
                            .bind(created)
                            .fetch_one(database.write())
                            .await?;

                            mapping.insert(id, row.get("uuid"));
                        }

                        Ok(mapping)
                    },
                    256,
                )
                .await
                {
                    Ok(mappings) => Arc::new(collect_mappings(mappings)),
                    Err(err) => {
                        tracing::error!("failed to process egg_variables table: {:?}", err);
                        return Ok(1);
                    }
                };

                let database_host_mappings = match process_table(
                    &source_database,
                    "database_hosts",
                    None,
                    async |rows| {
                        let mut mapping: HashMap<i32, uuid::Uuid> =
                            HashMap::with_capacity(rows.len());

                        for row in rows {
                            let id: i32 = row.try_get("id")?;
                            let name: &str = row.try_get("name")?;
                            let host: &str = row.try_get("host")?;
                            let port: i32 = row.try_get("port")?;
                            let username: &str = row.try_get("username")?;
                            let password: &str = row.try_get("password")?;
                            let created = source_datetime(&row, "created_at")?;

                            let password = match decrypt_laravel_value(password, &source_app_key) {
                                Ok(password) => password,
                                Err(_) => continue,
                            };

                            let mut credentials = DatabaseCredentials::Details {
                                host: host.into(),
                                port: port as u16,
                                username: username.into(),
                                password,
                            };

                            credentials.encrypt(&database).await?;

                            let row = sqlx::query(
                                r#"
                                INSERT INTO database_hosts (name, type, credentials, created)
                                VALUES ($1, $2, $3, $4)
                                ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                                RETURNING uuid
                                "#,
                            )
                            .bind(name)
                            .bind(shared::models::database_host::DatabaseType::Mysql)
                            .bind(serde_json::to_value(credentials)?)
                            .bind(created)
                            .fetch_one(database.write())
                            .await?;

                            mapping.insert(id, row.get("uuid"));
                        }

                        Ok(mapping)
                    },
                    256,
                )
                .await
                {
                    Ok(mappings) => Arc::new(collect_mappings(mappings)),
                    Err(err) => {
                        tracing::error!("failed to process database hosts table: {:?}", err);
                        return Ok(1);
                    }
                };

                let server_mappings = match process_table(
                    &source_database,
                    "servers",
                    None,
                    async |rows| {
                        let mut mapping = HashMap::with_capacity(rows.len());
                        let mut futures = Vec::with_capacity(rows.len());

                        for row in rows {
                            let id: i32 = row.try_get("id")?;
                            let uuid = source_uuid(&row, "uuid")?;
                            let allocation_id: Option<i32> = row.try_get("allocation_id")?;

                            mapping.insert(id, (uuid, allocation_id));

                            let node_mappings = node_mappings.clone();
                            let user_mappings = user_mappings.clone();
                            let egg_mappings = egg_mappings.clone();
                            let database = database.clone();
                            futures.push(async move {
                                let external_id: Option<&str> = row.try_get("external_id")?;
                                let node_id: i32 = row.try_get("node_id")?;
                                let name: &str = row.try_get("name")?;
                                let description: Option<&str> = row.try_get("description")?;
                                let status: Option<&str> = row.try_get("status")?;
                                let owner_id: i32 = row.try_get("owner_id")?;
                                let memory: i32 = row.try_get("memory")?;
                                let swap: i32 = row.try_get("swap")?;
                                let disk: i32 = row.try_get("disk")?;
                                let io_weight: i32 = row.try_get("io")?;
                                let cpu: i32 = row.try_get("cpu")?;
                                let egg_id: i32 = row.try_get("egg_id")?;
                                let startup: &str = row.try_get("startup")?;
                                let image: &str = row.try_get("image")?;
                                let allocation_limit: Option<i32> = row.try_get("allocation_limit")?;
                                let database_limit: i32 = row.try_get("database_limit")?;
                                let backup_limit: i32 = row.try_get("backup_limit")?;
                                let created = source_datetime(&row, "created_at")?;

                                let node_uuid = match node_mappings.get(&node_id) {
                                    Some(uuid) => uuid,
                                    None => return Ok(()),
                                };

                                let owner_uuid = match user_mappings.get(&owner_id) {
                                    Some(uuid) => uuid,
                                    None => return Ok(()),
                                };

                                let egg_uuid = match egg_mappings.get(&egg_id) {
                                    Some(uuid) => uuid,
                                    None => return Ok(()),
                                };

                                let (status, suspended) = match status {
                                    Some("installing") => (Some(shared::models::server::ServerStatus::Installing), false),
                                    Some("install_failed") => (Some(shared::models::server::ServerStatus::InstallFailed), false),
                                    Some("reinstall_failed") => (Some(shared::models::server::ServerStatus::InstallFailed), false),
                                    Some("restoring_backup") => {
                                        (Some(shared::models::server::ServerStatus::RestoringBackup), false)
                                    }
                                    Some("suspended") => (None, true),
                                    _ => (None, false),
                                };

                                sqlx::query(
                                    r#"
                                    INSERT INTO servers (
                                        uuid, uuid_short, external_id, node_uuid, name, description, status, suspended,
                                        owner_uuid, memory, swap, disk, io_weight, cpu, pinned_cpus, allocation_limit,
                                        database_limit, backup_limit, egg_uuid, startup, image, created
                                    )
                                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
                                    ON CONFLICT DO NOTHING
                                    "#,
                                )
                                .bind(uuid)
                                .bind(uuid.as_fields().0 as i32)
                                .bind(external_id)
                                .bind(node_uuid)
                                .bind(name)
                                .bind(description)
                                .bind(status)
                                .bind(suspended)
                                .bind(owner_uuid)
                                .bind(memory as i64)
                                .bind(swap as i64)
                                .bind(disk as i64)
                                .bind(io_weight as i16)
                                .bind(cpu)
                                .bind(&[] as &[i32])
                                .bind(allocation_limit.unwrap_or_default())
                                .bind(database_limit)
                                .bind(backup_limit)
                                .bind(egg_uuid)
                                .bind(startup)
                                .bind(image)
                                .bind(created)
                                .execute(database.write())
                                .await?;

                                Ok::<(), anyhow::Error>(())
                            });
                        }

                        futures_util::future::try_join_all(futures).await?;

                        Ok(mapping)
                    },
                    64,
                )
                .await
                {
                    Ok(mappings) => Arc::new(
                        mappings
                            .into_iter()
                            .flatten()
                            .collect::<HashMap<i32, (uuid::Uuid, Option<i32>)>>(),
                    ),
                    Err(err) => {
                        tracing::error!("failed to process servers table: {:?}", err);
                        return Ok(1);
                    }
                };

                if let Err(err) = process_table(
                    &source_database,
                    "databases",
                    None,
                    async |rows| {
                        let mut futures = Vec::with_capacity(rows.len());

                        for row in rows {
                            let server_mappings = server_mappings.clone();
                            let database_host_mappings = database_host_mappings.clone();
                            let source_app_key = source_app_key.clone();
                            let database = database.clone();
                            futures.push(async move {
                                let server_id: i32 = row.try_get("server_id")?;
                                let database_host_id: i32 = row.try_get("database_host_id")?;
                                let database_name: &str = row.try_get("database")?;
                                let username: &str = row.try_get("username")?;
                                let password: &str = row.try_get("password")?;
                                let created = source_datetime(&row, "created_at")?;

                                let server_uuid = match server_mappings.get(&server_id) {
                                    Some((uuid, _)) => uuid,
                                    None => return Ok(()),
                                };

                                let database_host_uuid = match database_host_mappings.get(&database_host_id) {
                                    Some(uuid) => uuid,
                                    None => return Ok(()),
                                };

                                let password = match decrypt_laravel_value(password, &source_app_key) {
                                    Ok(password) => password,
                                    Err(_) => return Ok(()),
                                };

                                sqlx::query(
                                    r#"
                                    INSERT INTO server_databases (server_uuid, database_host_uuid, name, username, password, created)
                                    VALUES ($1, $2, $3, $4, $5, $6)
                                    ON CONFLICT DO NOTHING
                                    "#,
                                )
                                .bind(server_uuid)
                                .bind(database_host_uuid)
                                .bind(database_name)
                                .bind(username)
                                .bind(database.encrypt(password).await.unwrap_or_default())
                                .bind(created)
                                .execute(database.write())
                                .await?;

                                Ok::<(), anyhow::Error>(())
                            });
                        }

                        futures_util::future::try_join_all(futures).await?;

                        Ok(())
                    },
                    64,
                )
                .await
                {
                    tracing::error!("failed to process databases table: {:?}", err);
                    return Ok(1);
                }

                if let Err(err) = process_table(
                    &source_database,
                    "server_variables",
                    None,
                    async |rows| {
                        for row in rows {
                            let server_id: i32 = row.try_get("server_id")?;
                            let variable_id: i32 = row.try_get("variable_id")?;
                            let variable_value: Option<&str> = row.try_get("variable_value")?;
                            let created = source_optional_datetime(&row, "created_at")?;

                            let server_uuid = match server_mappings.get(&server_id) {
                                Some((uuid, _)) => uuid,
                                None => continue,
                            };

                            let variable_uuid = match egg_variable_mappings.get(&variable_id) {
                                Some(uuid) => uuid,
                                None => continue,
                            };

                            sqlx::query(
                                r#"
                                INSERT INTO server_variables (server_uuid, variable_uuid, value, created)
                                VALUES ($1, $2, $3, $4)
                                ON CONFLICT DO NOTHING
                                "#,
                            )
                            .bind(server_uuid)
                            .bind(variable_uuid)
                            .bind(variable_value)
                            .bind(created.unwrap_or_else(chrono::Utc::now))
                            .execute(database.write())
                            .await?;
                        }

                        Ok(())
                    },
                    100,
                )
                .await
                {
                    tracing::error!("failed to process server variables table: {:?}", err);
                    return Ok(1);
                }

                if let Err(err) = process_table(
                    &source_database,
                    "backups",
                    None,
                    async |rows| {
                        let mut futures = Vec::with_capacity(rows.len());

                        for row in rows {
                            let server_mappings = server_mappings.clone();
                            let database = database.clone();
                            futures.push(async move {
                                let uuid = source_uuid(&row, "uuid")?;
                                let server_id: i32 = row.try_get("server_id")?;
                                let successful = source_bool(&row, "is_successful")?;
                                let locked = source_bool(&row, "is_locked")?;
                                let name: &str = row.try_get("name")?;
                                let ignored_files: Option<&str> = row.try_get("ignored_files")?;
                                let disk: &str = row.try_get("disk")?;
                                let checksum: Option<&str> = row.try_get("checksum")?;
                                let bytes: i64 = row.try_get("bytes")?;
                                let completed = source_optional_datetime(&row, "completed_at")?;
                                let created = source_datetime(&row, "created_at")?;
                                let deleted = source_optional_datetime(&row, "deleted_at")?;

                                let server_uuid = match server_mappings.get(&server_id) {
                                    Some((uuid, _)) => uuid,
                                    None => return Ok(()),
                                };

                                let ignored_files: Vec<String> = ignored_files
                                    .and_then(|value| serde_json::from_str(value).ok())
                                    .unwrap_or_default();

                                sqlx::query(
                                    r#"
                                    INSERT INTO server_backups (uuid, server_uuid, node_uuid, backup_configuration_uuid, name, successful, browsable, streaming, locked, ignored_files, disk, checksum, bytes, completed, deleted, created)
                                    VALUES ($1, $2, (SELECT node_uuid FROM servers WHERE uuid = $2), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                                    ON CONFLICT DO NOTHING
                                    "#,
                                )
                                .bind(uuid)
                                .bind(server_uuid)
                                .bind(backup_configuration_uuid)
                                .bind(name)
                                .bind(successful)
                                .bind(matches!(disk, "ddup-bak" | "btrfs" | "zfs" | "restic"))
                                .bind(matches!(disk, "ddup-bak" | "btrfs" | "zfs" | "restic"))
                                .bind(locked)
                                .bind(ignored_files)
                                .bind(match disk {
                                    "wings" => shared::models::server_backup::BackupDisk::Local,
                                    "s3" => shared::models::server_backup::BackupDisk::S3,
                                    "ddup-bak" => shared::models::server_backup::BackupDisk::DdupBak,
                                    "btrfs" => shared::models::server_backup::BackupDisk::Btrfs,
                                    "zfs" => shared::models::server_backup::BackupDisk::Zfs,
                                    "restic" => shared::models::server_backup::BackupDisk::Restic,
                                    _ => shared::models::server_backup::BackupDisk::Local,
                                })
                                .bind(checksum)
                                .bind(bytes)
                                .bind(completed)
                                .bind(deleted)
                                .bind(created)
                                .execute(database.write())
                                .await?;

                                Ok::<(), anyhow::Error>(())
                            });
                        }

                        futures_util::future::try_join_all(futures).await?;

                        Ok(())
                    },
                    64,
                )
                .await
                {
                    tracing::error!("failed to process backups table: {:?}", err);
                    return Ok(1);
                }

                if let Err(err) = process_table(
                    &source_database,
                    "subusers",
                    None,
                    async |rows| {
                        let mut futures = Vec::with_capacity(rows.len());

                        for row in rows {
                            let user_mappings = user_mappings.clone();
                            let server_mappings = server_mappings.clone();
                            let database = database.clone();
                            futures.push(async move {
                                let user_id: i32 = row.try_get("user_id")?;
                                let server_id: i32 = row.try_get("server_id")?;
                                let permissions: Option<&str> = row.try_get("permissions")?;
                                let created = source_datetime(&row, "created_at")?;

                                let user_uuid = match user_mappings.get(&user_id) {
                                    Some(uuid) => uuid,
                                    None => return Ok(()),
                                };

                                let server_uuid = match server_mappings.get(&server_id) {
                                    Some((uuid, _)) => uuid,
                                    None => return Ok(()),
                                };

                                let raw_permissions: Vec<String> = permissions
                                    .and_then(|value| serde_json::from_str(value).ok())
                                    .unwrap_or_default();
                                let mut permissions = HashSet::with_capacity(raw_permissions.len());

                                for permission in raw_permissions {
                                    permissions.insert(match permission.as_str() {
                                        "control.console" => "control.console",
                                        "control.start" => "control.start",
                                        "control.stop" => "control.stop",
                                        "control.restart" => "control.restart",
                                        "user.create" => "subusers.create",
                                        "user.read" => "subusers.read",
                                        "user.update" => "subusers.update",
                                        "user.delete" => "subusers.delete",
                                        "file.create" => "files.create",
                                        "file.read" => "files.read",
                                        "file.read-content" => "files.read-content",
                                        "file.update" => "files.update",
                                        "file.delete" => "files.delete",
                                        "file.archive" => "files.archive",
                                        "backup.create" => "backups.create",
                                        "backup.read" => "backups.read",
                                        "backup.download" => "backups.download",
                                        "backup.restore" => "backups.restore",
                                        "backup.delete" => "backups.delete",
                                        "allocation.create" => "allocations.create",
                                        "allocation.read" => "allocations.read",
                                        "allocation.update" => "allocations.update",
                                        "allocation.delete" => "allocations.delete",
                                        "startup.read" => "startup.read",
                                        "startup.update" => "startup.update",
                                        "startup.docker-image" => "startup.docker-image",
                                        "database.create" => "databases.create",
                                        "database.read" => "databases.read",
                                        "database.update" => "databases.update",
                                        "database.view_password" => "databases.read-password",
                                        "database.delete" => "databases.delete",
                                        "schedule.create" => "schedules.create",
                                        "schedule.read" => "schedules.read",
                                        "schedule.update" => "schedules.update",
                                        "schedule.delete" => "schedules.delete",
                                        "settings.rename" => "settings.rename",
                                        "settings.reinstall" => "settings.install",
                                        "activity.read" => "activity.read",
                                        _ => continue,
                                    });

                                    if permission == "control.console" {
                                        permissions.insert("control.read-console");
                                    }
                                }

                                sqlx::query(
                                    r#"
                                    INSERT INTO server_subusers (server_uuid, user_uuid, permissions, ignored_files, created)
                                    VALUES ($1, $2, $3, $4, $5)
                                    ON CONFLICT DO NOTHING
                                    "#,
                                )
                                .bind(server_uuid)
                                .bind(user_uuid)
                                .bind(permissions.into_iter().collect::<Vec<&str>>())
                                .bind(&[] as &[&str])
                                .bind(created)
                                .execute(database.write())
                                .await?;

                                Ok::<(), anyhow::Error>(())
                            });
                        }

                        futures_util::future::try_join_all(futures).await?;

                        Ok(())
                    },
                    100,
                )
                .await
                {
                    tracing::error!("failed to process subusers table: {:?}", err);
                    return Ok(1);
                }

                drop(user_mappings);

                let mount_mappings = match process_table(
                    &source_database,
                    "mounts",
                    None,
                    async |rows| {
                        let mut mapping = HashMap::with_capacity(rows.len());

                        for row in rows {
                            let id: i32 = row.try_get("id")?;
                            let uuid = source_uuid(&row, "uuid")?;
                            let name: &str = row.try_get("name")?;
                            let description: Option<&str> = row.try_get("description")?;
                            let source: &str = row.try_get("source")?;
                            let target: &str = row.try_get("target")?;
                            let read_only = source_bool(&row, "read_only")?;
                            let user_mountable = source_bool(&row, "user_mountable")?;

                            sqlx::query(
                                r#"
                                INSERT INTO mounts (uuid, name, description, source, target, read_only, user_mountable, created)
                                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                                ON CONFLICT DO NOTHING
                                "#,
                            )
                            .bind(uuid)
                            .bind(name)
                            .bind(description)
                            .bind(source)
                            .bind(target)
                            .bind(read_only)
                            .bind(user_mountable)
                            .execute(database.write())
                            .await?;

                            mapping.insert(id, uuid);
                        }

                        Ok(mapping)
                    },
                    256,
                )
                .await
                {
                    Ok(mappings) => Arc::new(collect_mappings(mappings)),
                    Err(err) => {
                        tracing::error!("failed to process mounts table: {:?}", err);
                        return Ok(1);
                    }
                };

                if let Err(err) = process_table(
                    &source_database,
                    "mountables",
                    Some("LOWER(mountable_type) = 'egg'"),
                    async |rows| {
                        for row in rows {
                            let egg_id: i32 = row.try_get("mountable_id")?;
                            let mount_id: i32 = row.try_get("mount_id")?;

                            let egg_uuid = match egg_mappings.get(&egg_id) {
                                Some(uuid) => uuid,
                                None => continue,
                            };

                            let mount_uuid = match mount_mappings.get(&mount_id) {
                                Some(uuid) => uuid,
                                None => continue,
                            };

                            sqlx::query(
                                r#"
                                INSERT INTO nest_egg_mounts (egg_uuid, mount_uuid, created)
                                VALUES ($1, $2, NOW())
                                ON CONFLICT DO NOTHING
                                "#,
                            )
                            .bind(egg_uuid)
                            .bind(mount_uuid)
                            .execute(database.write())
                            .await?;
                        }

                        Ok(())
                    },
                    100,
                )
                .await
                {
                    tracing::error!("failed to process egg mounts table: {:?}", err);
                    return Ok(1);
                }

                if let Err(err) = process_table(
                    &source_database,
                    "mountables",
                    Some("LOWER(mountable_type) = 'node'"),
                    async |rows| {
                        for row in rows {
                            let node_id: i32 = row.try_get("mountable_id")?;
                            let mount_id: i32 = row.try_get("mount_id")?;

                            let node_uuid = match node_mappings.get(&node_id) {
                                Some(uuid) => uuid,
                                None => continue,
                            };

                            let mount_uuid = match mount_mappings.get(&mount_id) {
                                Some(uuid) => uuid,
                                None => continue,
                            };

                            sqlx::query(
                                r#"
                                INSERT INTO node_mounts (node_uuid, mount_uuid, created)
                                VALUES ($1, $2, NOW())
                                ON CONFLICT DO NOTHING
                                "#,
                            )
                            .bind(node_uuid)
                            .bind(mount_uuid)
                            .execute(database.write())
                            .await?;
                        }

                        Ok(())
                    },
                    100,
                )
                .await
                {
                    tracing::error!("failed to process node mounts table: {:?}", err);
                    return Ok(1);
                }

                if let Err(err) = process_table(
                    &source_database,
                    "mountables",
                    Some("LOWER(mountable_type) = 'server'"),
                    async |rows| {
                        for row in rows {
                            let server_id: i32 = row.try_get("mountable_id")?;
                            let mount_id: i32 = row.try_get("mount_id")?;

                            let server_uuid = match server_mappings.get(&server_id) {
                                Some((uuid, _)) => uuid,
                                None => continue,
                            };

                            let mount_uuid = match mount_mappings.get(&mount_id) {
                                Some(uuid) => uuid,
                                None => continue,
                            };

                            sqlx::query(
                                r#"
                                INSERT INTO server_mounts (server_uuid, mount_uuid, created)
                                VALUES ($1, $2, NOW())
                                ON CONFLICT DO NOTHING
                                "#,
                            )
                            .bind(server_uuid)
                            .bind(mount_uuid)
                            .execute(database.write())
                            .await?;
                        }

                        Ok(())
                    },
                    100,
                )
                .await
                {
                    tracing::error!("failed to process server mounts table: {:?}", err);
                    return Ok(1);
                }

                drop(mount_mappings);

                let schedule_mappings = match process_table(
                    &source_database,
                    "schedules",
                    None,
                    async |rows| {
                        let mut mapping: HashMap<i32, uuid::Uuid> = HashMap::with_capacity(rows.len());

                        for row in rows {
                            let id: i32 = row.try_get("id")?;
                            let server_id: i32 = row.try_get("server_id")?;
                            let name: &str = row.try_get("name")?;
                            let enabled = source_bool(&row, "is_active")?;
                            let only_when_online = source_bool(&row, "only_when_online")?;
                            let cron_day_of_week: &str = row.try_get("cron_day_of_week")?;
                            let cron_month: &str = row.try_get("cron_month")?;
                            let cron_day_of_month: &str = row.try_get("cron_day_of_month")?;
                            let cron_hour: &str = row.try_get("cron_hour")?;
                            let cron_minute: &str = row.try_get("cron_minute")?;
                            let last_run = source_optional_datetime(&row, "last_run_at")?;
                            let created = source_datetime(&row, "created_at")?;

                            let server_uuid = match server_mappings.get(&server_id) {
                                Some((uuid, _)) => uuid,
                                None => continue,
                            };

                            let schedule = match cron::Schedule::from_str(&format!(
                                "0 {} {} {} {} {}",
                                cron_minute, cron_hour, cron_day_of_month, cron_month, cron_day_of_week
                            )) {
                                Ok(schedule) => schedule,
                                Err(_) => continue,
                            };

                            let row = sqlx::query(
                                r#"
                                INSERT INTO server_schedules (server_uuid, name, enabled, triggers, condition, last_run, created)
                                VALUES ($1, $2, $3, $4, $5, $6, $7)
                                ON CONFLICT (server_uuid, name) DO UPDATE SET name = EXCLUDED.name
                                RETURNING uuid
                                "#,
                            )
                            .bind(server_uuid)
                            .bind(name)
                            .bind(enabled)
                            .bind(serde_json::to_value(vec![
                                wings_api::ScheduleTrigger::Cron { schedule: Box::new(schedule) }
                            ])?)
                            .bind(serde_json::to_value(if only_when_online {
                                wings_api::SchedulePreCondition::Or {
                                    conditions: vec![
                                        wings_api::SchedulePreCondition::ServerState {
                                            state: wings_api::ServerState::Starting
                                        },
                                        wings_api::SchedulePreCondition::ServerState {
                                            state: wings_api::ServerState::Running
                                        }
                                    ]
                                }
                            } else {
                                wings_api::SchedulePreCondition::None
                            })?)
                            .bind(last_run)
                            .bind(created)
                            .fetch_one(database.write())
                            .await?;

                            mapping.insert(id, row.get("uuid"));
                        }

                        Ok(mapping)
                    },
                    256,
                )
                .await
                {
                    Ok(mappings) => Arc::new(collect_mappings(mappings)),
                    Err(err) => {
                        tracing::error!("failed to process schedules table: {:?}", err);
                        return Ok(1);
                    }
                };

                if let Err(err) = process_table(
                    &source_database,
                    "tasks",
                    None,
                    async |rows| {
                        for row in rows {
                            let schedule_id: i32 = row.try_get("schedule_id")?;
                            let sequence_id: i32 = row.try_get("sequence_id")?;
                            let action: &str = row.try_get("action")?;
                            let payload: &str = row.try_get("payload")?;
                            let time_offset: i32 = row.try_get("time_offset")?;
                            let continue_on_failure = source_bool(&row, "continue_on_failure")?;
                            let created = source_datetime(&row, "created_at")?;

                            let schedule_uuid = match schedule_mappings.get(&schedule_id) {
                                Some(uuid) => uuid,
                                None => continue,
                            };

                            let mut actions = Vec::new();
                            actions.reserve_exact(2);

                            if time_offset > 0 {
                                actions.push(wings_api::ScheduleActionInner::Sleep {
                                    duration: time_offset as u64 * 1000,
                                });
                            }

                            match action {
                                "command" => {
                                    actions.push(wings_api::ScheduleActionInner::SendCommand {
                                        command: wings_api::ScheduleDynamicParameter::Raw(payload.into()),
                                        ignore_failure: continue_on_failure,
                                    })
                                }
                                "power" => {
                                    let power_action = match payload {
                                        "start" => wings_api::ServerPowerAction::Start,
                                        "stop" => wings_api::ServerPowerAction::Stop,
                                        "restart" => wings_api::ServerPowerAction::Restart,
                                        "kill" => wings_api::ServerPowerAction::Kill,
                                        _ => continue,
                                    };

                                    actions.push(wings_api::ScheduleActionInner::SendPower {
                                        action: power_action,
                                        ignore_failure: continue_on_failure,
                                    });
                                }
                                "backup" => {
                                    actions.push(wings_api::ScheduleActionInner::CreateBackup {
                                        name: None,
                                        ignored_files: payload
                                            .split('\n')
                                            .map(compact_str::CompactString::from)
                                            .collect::<Vec<_>>(),
                                        foreground: true,
                                        ignore_failure: continue_on_failure,
                                    })
                                }
                                _ => continue,
                            }

                            for (i, action) in actions.into_iter().enumerate() {
                                sqlx::query(
                                    r#"
                                    INSERT INTO server_schedule_steps (schedule_uuid, action, order_, created)
                                    VALUES ($1, $2, $3, $4)
                                    ON CONFLICT DO NOTHING
                                    "#,
                                )
                                .bind(schedule_uuid)
                                .bind(serde_json::to_value(action)?)
                                .bind(sequence_id as i16)
                                .bind(created + chrono::Duration::try_milliseconds(i as i64).unwrap_or_default())
                                .execute(database.write())
                                .await?;
                            }
                        }

                        Ok(())
                    },
                    100,
                )
                .await
                {
                    tracing::error!("failed to process schedule tasks table: {:?}", err);
                    return Ok(1);
                }

                drop(schedule_mappings);

                if let Err(err) = process_table(
                    &source_database,
                    "allocations",
                    None,
                    async |rows| {
                        for row in rows {
                            let id: i32 = row.try_get("id")?;
                            let node_id: i32 = row.try_get("node_id")?;
                            let ip: &str = row.try_get("ip")?;
                            let ip_alias: Option<&str> = row.try_get("ip_alias")?;
                            let port: i32 = row.try_get("port")?;
                            let server_id: Option<i32> = row.try_get("server_id")?;
                            let notes: Option<&str> = if server_id.is_some() {
                                row.try_get("notes")?
                            } else {
                                None
                            };
                            let created = source_optional_datetime(&row, "created_at")?;

                            let node_uuid = match node_mappings.get(&node_id) {
                                Some(uuid) => uuid,
                                None => continue,
                            };

                            let server_uuid = if let Some(server_id) = server_id {
                                server_mappings.get(&server_id)
                            } else {
                                None
                            };

                            let ip = match sqlx::types::ipnetwork::IpNetwork::from_str(ip) {
                                Ok(ip) => ip,
                                Err(_) => continue,
                            };

                            let row = sqlx::query(
                                r#"
                                INSERT INTO node_allocations (node_uuid, ip, ip_alias, port, created)
                                VALUES ($1, $2, $3, $4, NOW())
                                ON CONFLICT (node_uuid, host(ip), port) DO UPDATE SET port = EXCLUDED.port
                                RETURNING uuid
                                "#,
                            )
                            .bind(node_uuid)
                            .bind(ip)
                            .bind(ip_alias)
                            .bind(port)
                            .fetch_one(database.write())
                            .await?;

                            if let Some(&(server_uuid, allocation_id)) = server_uuid {
                                let row = sqlx::query(
                                    r#"
                                    INSERT INTO server_allocations (server_uuid, allocation_uuid, notes, created)
                                    VALUES ($1, $2, $3, $4)
                                    ON CONFLICT (allocation_uuid) DO UPDATE SET allocation_uuid = EXCLUDED.allocation_uuid
                                    RETURNING uuid
                                    "#,
                                )
                                .bind(server_uuid)
                                .bind(row.get::<uuid::Uuid, _>("uuid"))
                                .bind(notes)
                                .bind(created.unwrap_or_else(chrono::Utc::now))
                                .fetch_one(database.write())
                                .await?;

                                if allocation_id.is_some_and(|allocation_id| id == allocation_id) {
                                    sqlx::query(
                                        r#"
                                        UPDATE servers
                                        SET allocation_uuid = $1
                                        WHERE servers.uuid = $2
                                        "#,
                                    )
                                    .bind(row.get::<uuid::Uuid, _>("uuid"))
                                    .bind(server_uuid)
                                    .execute(database.write())
                                    .await?;
                                }
                            }
                        }

                        Ok(())
                    },
                    100,
                )
                .await
                {
                    tracing::error!("failed to process allocations table: {:?}", err);
                    return Ok(1);
                }

                tracing::info!(
                    "finished processing import, took {:.2} seconds",
                    start_time.elapsed().as_secs_f32()
                );

                Ok(0)
            })
        })
    }
}
