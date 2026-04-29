use futures_util::StreamExt;
use serde::Deserialize;
use shared::extensions::distr::ExtensionMigration;
use sqlx::{Executor, Row};
use std::{io::Read, path::Path};

pub mod commands;

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "entityType", rename_all = "camelCase")]
pub enum DDLEntry {
    Tables { name: String },
    Enums { name: String },
    Columns { table: String, name: String },
    Indexes { table: String, name: String },
    Fks { table: String, name: String },
    Pks { table: String, name: String },
}

#[derive(Debug, Clone, Deserialize)]
pub struct MigrationSnapshot {
    pub id: uuid::Uuid,
    pub ddl: Vec<DDLEntry>,
}

impl MigrationSnapshot {
    pub fn tables(&self) -> Vec<&String> {
        self.ddl
            .iter()
            .filter_map(|entry| match entry {
                DDLEntry::Tables { name } => Some(name),
                _ => None,
            })
            .collect()
    }

    pub fn enums(&self) -> Vec<&String> {
        self.ddl
            .iter()
            .filter_map(|entry| match entry {
                DDLEntry::Enums { name } => Some(name),
                _ => None,
            })
            .collect()
    }

    pub fn columns(&self, table: Option<&str>) -> Vec<&String> {
        self.ddl
            .iter()
            .filter_map(|entry| match entry {
                DDLEntry::Columns { table: t, name } => {
                    if let Some(table) = table {
                        if t == table { Some(name) } else { None }
                    } else {
                        Some(name)
                    }
                }
                _ => None,
            })
            .collect()
    }

    pub fn indexes(&self, table: Option<&str>) -> Vec<&String> {
        self.ddl
            .iter()
            .filter_map(|entry| match entry {
                DDLEntry::Indexes { table: t, name } => {
                    if let Some(table) = table {
                        if t == table { Some(name) } else { None }
                    } else {
                        Some(name)
                    }
                }
                _ => None,
            })
            .collect()
    }

    pub fn foreign_keys(&self, table: Option<&str>) -> Vec<&String> {
        self.ddl
            .iter()
            .filter_map(|entry| match entry {
                DDLEntry::Fks { table: t, name } => {
                    if let Some(table) = table {
                        if t == table { Some(name) } else { None }
                    } else {
                        Some(name)
                    }
                }
                _ => None,
            })
            .collect()
    }

    pub fn primary_keys(&self, table: Option<&str>) -> Vec<&String> {
        self.ddl
            .iter()
            .filter_map(|entry| match entry {
                DDLEntry::Pks { table: t, name } => {
                    if let Some(table) = table {
                        if t == table { Some(name) } else { None }
                    } else {
                        Some(name)
                    }
                }
                _ => None,
            })
            .collect()
    }
}

pub struct AppliedMigration {
    pub id: uuid::Uuid,
    pub name: String,
    pub created: chrono::DateTime<chrono::Utc>,
    pub applied: chrono::DateTime<chrono::Utc>,
}

pub struct Migration {
    pub name: String,
    pub date: chrono::DateTime<chrono::Utc>,
    pub sql: String,
    pub snapshot: MigrationSnapshot,
}

impl Migration {
    pub fn from_directory_raw(
        path: &Path,
        snapshot: impl std::io::Read,
        sql: impl std::io::Read,
    ) -> Result<Self, std::io::Error> {
        // 20260125115245_xxx_xxx
        //   - migration.sql
        //   - snapshot.json

        let date = path
            .file_name()
            .and_then(|os_str| os_str.to_str())
            .and_then(|s| s.split('_').next())
            .and_then(|date_str| {
                chrono::NaiveDateTime::parse_from_str(date_str, "%Y%m%d%H%M%S")
                    .ok()
                    .map(|ndt| ndt.and_utc())
            })
            .ok_or_else(|| {
                std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    "invalid migration directory name",
                )
            })?;

        let snapshot: MigrationSnapshot =
            serde_json::from_reader(std::io::BufReader::new(snapshot))
                .map_err(|err| std::io::Error::new(std::io::ErrorKind::InvalidData, err))?;

        Ok(Migration {
            name: path
                .file_name()
                .and_then(|os_str| os_str.to_str())
                .unwrap_or_default()
                .to_string(),
            date,
            sql: {
                let mut buf = String::new();
                std::io::BufReader::new(sql).read_to_string(&mut buf)?;
                buf.shrink_to_fit();
                buf
            },
            snapshot,
        })
    }

    pub async fn from_directory(path: &Path) -> Result<Self, std::io::Error> {
        // 20260125115245_xxx_xxx
        //   - migration.sql
        //   - snapshot.json

        let date = path
            .file_name()
            .and_then(|os_str| os_str.to_str())
            .and_then(|s| s.split('_').next())
            .and_then(|date_str| {
                chrono::NaiveDateTime::parse_from_str(date_str, "%Y%m%d%H%M%S")
                    .ok()
                    .map(|ndt| ndt.and_utc())
            })
            .ok_or_else(|| {
                std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    "invalid migration directory name",
                )
            })?;

        if tokio::fs::metadata(path.join("migration.sql"))
            .await
            .is_err()
        {
            return Err(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "migration.sql not found",
            ));
        }

        let snapshot_file = tokio::fs::File::open(path.join("snapshot.json"))
            .await?
            .into_std()
            .await;
        let snapshot: MigrationSnapshot = tokio::task::spawn_blocking(move || {
            serde_json::from_reader(std::io::BufReader::new(snapshot_file))
                .map_err(|err| std::io::Error::new(std::io::ErrorKind::InvalidData, err))
        })
        .await??;

        let mut sql = tokio::fs::read_to_string(path.join("migration.sql")).await?;
        sql.shrink_to_fit();

        Ok(Migration {
            name: path
                .file_name()
                .and_then(|os_str| os_str.to_str())
                .unwrap_or_default()
                .to_string(),
            date,
            sql,
            snapshot,
        })
    }
}

pub static MIGRATIONS: include_dir::Dir<'_> =
    include_dir::include_dir!("$CARGO_MANIFEST_DIR/../database/migrations");
pub static EXTENSION_MIGRATIONS: include_dir::Dir<'_> =
    include_dir::include_dir!("$CARGO_MANIFEST_DIR/../database/extension-migrations");

pub fn collect_embedded_migrations() -> Result<Vec<Migration>, std::io::Error> {
    let mut migrations = Vec::new();

    for entry in MIGRATIONS.dirs() {
        let migration = Migration::from_directory_raw(
            entry.path(),
            match MIGRATIONS.get_file(entry.path().join("snapshot.json")) {
                Some(file) => file.contents(),
                None => {
                    return Err(std::io::Error::new(
                        std::io::ErrorKind::NotFound,
                        format!(
                            "snapshot.json not found in embedded migration: {}",
                            entry.path().display()
                        ),
                    ));
                }
            },
            match MIGRATIONS.get_file(entry.path().join("migration.sql")) {
                Some(file) => file.contents(),
                None => {
                    return Err(std::io::Error::new(
                        std::io::ErrorKind::NotFound,
                        format!(
                            "migration.sql not found in embedded migration: {}",
                            entry.path().display()
                        ),
                    ));
                }
            },
        )?;
        migrations.push(migration);
    }

    migrations.sort_by_key(|m| m.date);

    Ok(migrations)
}

pub fn collect_embedded_extension_migrations(
    extension_identifier: &str,
) -> Result<Vec<ExtensionMigration>, std::io::Error> {
    let mut migrations = Vec::new();

    let dir = match EXTENSION_MIGRATIONS.get_dir(extension_identifier) {
        Some(dir) => dir,
        None => return Ok(migrations),
    };

    for entry in dir.dirs() {
        let up_sql = match EXTENSION_MIGRATIONS.get_file(entry.path().join("up.sql")) {
            Some(file) => file.contents(),
            None => {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    format!(
                        "up.sql not found in embedded extension migration: {}",
                        entry.path().display()
                    ),
                ));
            }
        };
        let down_sql = match EXTENSION_MIGRATIONS.get_file(entry.path().join("down.sql")) {
            Some(file) => file.contents(),
            None => {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    format!(
                        "down.sql not found in embedded extension migration: {}",
                        entry.path().display()
                    ),
                ));
            }
        };

        let migration = ExtensionMigration::from_directory_raw(
            entry.path(),
            extension_identifier,
            up_sql,
            down_sql,
        )?;
        migrations.push(migration);
    }

    migrations.sort_by_key(|m| m.date);

    Ok(migrations)
}

pub async fn collect_migrations(path: impl AsRef<Path>) -> Result<Vec<Migration>, std::io::Error> {
    let mut migrations = Vec::new();

    let mut dir_entries = tokio::fs::read_dir(path).await?;
    while let Some(entry) = dir_entries.next_entry().await? {
        let file_type = entry.file_type().await?;
        if file_type.is_dir() {
            let migration = Migration::from_directory(&entry.path()).await?;

            migrations.push(migration);
        }
    }

    migrations.sort_by_key(|m| m.date);

    Ok(migrations)
}

pub async fn collect_extension_migrations(
    path: impl AsRef<Path>,
    extension_identifier: &str,
) -> Result<Vec<ExtensionMigration>, std::io::Error> {
    let mut migrations = Vec::new();

    let mut dir_entries = tokio::fs::read_dir(path).await?;
    while let Some(entry) = dir_entries.next_entry().await? {
        let file_type = entry.file_type().await?;
        if file_type.is_dir() {
            let up_file = tokio::fs::File::open(entry.path().join("up.sql"))
                .await?
                .into_std()
                .await;
            let down_file = tokio::fs::File::open(entry.path().join("down.sql"))
                .await?
                .into_std()
                .await;

            let migration = tokio::task::spawn_blocking({
                let path = entry.path();
                let extension_identifier = extension_identifier.to_string();

                move || {
                    ExtensionMigration::from_directory_raw(
                        &path,
                        &extension_identifier,
                        up_file,
                        down_file,
                    )
                }
            })
            .await??;

            migrations.push(migration);
        }
    }

    migrations.sort_by_key(|m| m.date);

    Ok(migrations)
}

#[tracing::instrument(skip(pool))]
pub async fn ensure_migrations_table(pool: &sqlx::PgPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS migrations (
            id UUID PRIMARY KEY,
            name TEXT NOT NULL,
            created TIMESTAMP NOT NULL,
            applied TIMESTAMP NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await?;

    tracing::debug!("ensured migrations table exists");

    Ok(())
}

#[tracing::instrument(skip(pool))]
pub async fn fetch_applied_migrations(
    pool: &sqlx::PgPool,
) -> Result<Vec<AppliedMigration>, sqlx::Error> {
    let rows = sqlx::query("SELECT * FROM migrations")
        .fetch_all(pool)
        .await?;

    tracing::debug!("fetched {} applied migrations", rows.len());

    Ok(rows
        .into_iter()
        .map(|row| AppliedMigration {
            id: row.get("id"),
            name: row.get("name"),
            created: row.get::<chrono::NaiveDateTime, _>("created").and_utc(),
            applied: row.get::<chrono::NaiveDateTime, _>("applied").and_utc(),
        })
        .collect())
}

pub async fn mark_migration_as_applied(
    pool: impl Executor<'_, Database = sqlx::Postgres>,
    migration: &Migration,
) -> Result<(), sqlx::Error> {
    match sqlx::query("INSERT INTO migrations (id, name, created, applied) VALUES ($1, $2, $3, $4)")
        .bind(migration.snapshot.id)
        .bind(&migration.name)
        .bind(migration.date)
        .bind(chrono::Utc::now())
        .execute(pool)
        .await
    {
        Ok(_) => Ok(()),
        Err(sqlx::Error::Database(db)) if db.is_unique_violation() => Ok(()),
        Err(err) => Err(err),
    }
}

pub async fn mark_extension_migration_as_applied(
    pool: impl Executor<'_, Database = sqlx::Postgres>,
    migration: &ExtensionMigration,
) -> Result<(), sqlx::Error> {
    match sqlx::query("INSERT INTO migrations (id, name, created, applied) VALUES ($1, $2, $3, $4)")
        .bind(migration.id)
        .bind(&migration.name)
        .bind(migration.date)
        .bind(chrono::Utc::now())
        .execute(pool)
        .await
    {
        Ok(_) => Ok(()),
        Err(sqlx::Error::Database(db)) if db.is_unique_violation() => Ok(()),
        Err(err) => Err(err),
    }
}

pub async fn mark_extension_migration_as_rolled_back(
    pool: impl Executor<'_, Database = sqlx::Postgres>,
    migration: &ExtensionMigration,
) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM migrations WHERE id = $1")
        .bind(migration.id)
        .execute(pool)
        .await?;

    Ok(())
}

/// Runs a single migration within a transaction.
/// This function ensures that the migration is applied atomically,
/// meaning that either all changes are applied, or none are.
///
/// If everything goes well, the transaction is committed and the migration is marked as applied.
pub async fn run_migration(pool: &sqlx::PgPool, migration: &Migration) -> Result<(), sqlx::Error> {
    let mut transaction = pool.begin().await?;

    let mut query_stream = (&mut transaction).execute_many(&*migration.sql);
    while let Some(result) = query_stream.next().await {
        result?;
    }
    drop(query_stream);

    mark_migration_as_applied(&mut *transaction, migration).await?;

    transaction.commit().await?;

    Ok(())
}

/// Runs a single extension migration within a transaction.
/// This function ensures that the migration is applied atomically,
/// meaning that either all changes are applied, or none are.
///
/// If everything goes well, the transaction is committed.
pub async fn run_extension_migration(
    pool: &sqlx::PgPool,
    migration: &ExtensionMigration,
) -> Result<(), sqlx::Error> {
    let mut transaction = pool.begin().await?;

    let mut query_stream = (&mut transaction).execute_many(&*migration.sql);
    while let Some(result) = query_stream.next().await {
        result?;
    }
    drop(query_stream);

    mark_extension_migration_as_applied(&mut *transaction, migration).await?;

    transaction.commit().await?;

    Ok(())
}

/// Rolls back a single extension migration within a transaction by running its down SQL.
/// This function ensures that the rollback is applied atomically,
/// meaning that either all changes are applied, or none are.
///
/// If everything goes well, the transaction is committed.
pub async fn rollback_extension_migration(
    pool: &sqlx::PgPool,
    migration: &ExtensionMigration,
) -> Result<(), sqlx::Error> {
    let mut transaction = pool.begin().await?;

    let mut query_stream = (&mut transaction).execute_many(&*migration.sql_down);
    while let Some(result) = query_stream.next().await {
        result?;
    }
    drop(query_stream);

    mark_extension_migration_as_rolled_back(&mut *transaction, migration).await?;

    transaction.commit().await?;

    Ok(())
}
