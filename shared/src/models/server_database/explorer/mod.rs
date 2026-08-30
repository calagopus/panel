use super::ServerDatabase;
use crate::models::database_host::DatabaseType;
use compact_str::CompactString;
use garde::Validate;
use serde::{Deserialize, Serialize};
use std::{
    borrow::Cow,
    collections::HashMap,
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

mod mysql;
mod postgres;

pub const QUERY_MAX_LENGTH: usize = 65535;
pub const QUERY_DEFAULT_ROWS: u32 = 100;
pub const QUERY_MAX_ROWS: u32 = 1000;
pub const QUERY_ACTIVITY_LENGTH: usize = 512;

pub const BROWSE_DEFAULT_ROWS: u32 = 50;
pub const BROWSE_MAX_ROWS: u32 = 500;
pub const BROWSE_MAX_FILTERS: usize = 10;

pub const MUTATE_MAX_ROWS: usize = 100;
pub const CREATE_TABLE_MAX_COLUMNS: usize = 100;
pub const SCHEMA_MAX_TABLES: usize = 1000;

const QUERY_MAX_BYTES: usize = 4 * 1024 * 1024;
const QUERY_MAX_VALUE_BYTES: usize = 256 * 1024;
const QUERY_STATEMENT_TIMEOUT_MS: u64 = 10_000;
const QUERY_CONNECTION_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(15);

static TENANT_CONNECTIONS: LazyLock<Arc<tokio::sync::Semaphore>> =
    LazyLock::new(|| Arc::new(tokio::sync::Semaphore::new(16)));
const TENANT_PERMIT_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(15);

const TENANT_POOL_MAX_CONNECTIONS: u32 = 4;
const TENANT_POOL_IDLE_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(60);
const TENANT_POOL_ACQUIRE_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(10);

#[derive(Clone)]
enum TenantPool {
    Mysql(sqlx::Pool<sqlx::MySql>),
    Postgres(sqlx::Pool<sqlx::Postgres>),
}

impl TenantPool {
    async fn close(self) {
        match self {
            Self::Mysql(pool) => pool.close().await,
            Self::Postgres(pool) => pool.close().await,
        }
    }
}

type TenantPoolValue = (std::time::Instant, Vec<u8>, TenantPool);
static TENANT_POOLS: LazyLock<Arc<tokio::sync::Mutex<HashMap<uuid::Uuid, TenantPoolValue>>>> =
    LazyLock::new(|| {
        let pools = Arc::new(tokio::sync::Mutex::new(HashMap::<
            uuid::Uuid,
            TenantPoolValue,
        >::new()));

        tokio::spawn({
            let pools = Arc::clone(&pools);
            async move {
                loop {
                    tokio::time::sleep(std::time::Duration::from_secs(60)).await;

                    let mut evicted = Vec::new();
                    let mut pools = pools.lock().await;
                    pools.retain(|_, (last_used, _, pool)| {
                        if last_used.elapsed() < TENANT_POOL_IDLE_TIMEOUT {
                            true
                        } else {
                            evicted.push(pool.clone());
                            false
                        }
                    });
                    drop(pools);

                    for pool in evicted {
                        tokio::spawn(pool.close());
                    }
                }
            }
        });

        pools
    });

pub struct TenantConnection {
    inner: Box<dyn ExplorerConnection>,
    _permit: tokio::sync::OwnedSemaphorePermit,
}

#[async_trait::async_trait]
pub trait ExplorerConnection: Send {
    fn close_on_drop(&mut self);
    async fn set_read_only(&mut self, read_only: bool) -> Result<(), anyhow::Error>;

    fn quote_ident(&self, identifier: &str) -> String;
    fn qualified_table(&self, schema: Option<&str>, table: &str) -> String;
    fn placeholder(&self, column: &SchemaColumn, index: usize) -> String;
    fn like_prefix(&self, quoted_column: &str) -> String;
    fn binary_literal(&self, hex: &str) -> String;
    fn empty_insert_suffix(&self) -> &'static str;
    fn auto_increment_keyword(&self) -> &'static str;
    fn is_integer_type(&self, rendered: &str) -> bool;

    async fn schema_tables(&mut self) -> Result<DatabaseSchema, anyhow::Error>;
    async fn table_columns(
        &mut self,
        schema: Option<&str>,
        table: &str,
    ) -> Result<Vec<SchemaColumn>, anyhow::Error>;
    async fn column_types(&mut self) -> Result<Vec<String>, anyhow::Error>;
    async fn resolve_type(&mut self, input: &str) -> Result<String, anyhow::Error>;

    async fn quote_values(&mut self, values: &[String]) -> Result<Vec<String>, anyhow::Error>;
    async fn fetch_unprepared(
        &mut self,
        sql: String,
        max_rows: usize,
    ) -> Result<QueryResultSet, anyhow::Error>;
    async fn run_query(
        &mut self,
        sql: &str,
        max_rows: usize,
    ) -> Result<Vec<QueryResultSet>, anyhow::Error>;
    async fn apply_statements(
        &mut self,
        statements: Vec<Statement>,
        expects_single_row: bool,
    ) -> Result<u64, anyhow::Error>;
    async fn execute_ddl(&mut self, sql: String) -> Result<(), anyhow::Error>;
}

fn display(message: impl Into<Cow<'static, str>>) -> anyhow::Error {
    crate::response::DisplayError::new(message).into()
}

fn unknown_table(table: &str) -> anyhow::Error {
    crate::response::DisplayError::new(format!("table {table} does not exist"))
        .with_status(axum::http::StatusCode::NOT_FOUND)
        .into()
}

fn unknown_column(column: &str) -> anyhow::Error {
    crate::response::DisplayError::new(format!("column {column} does not exist"))
        .with_status(axum::http::StatusCode::NOT_FOUND)
        .into()
}

fn unsupported_engine() -> anyhow::Error {
    crate::response::DisplayError::new("querying MongoDB databases is not supported")
        .with_status(axum::http::StatusCode::EXPECTATION_FAILED)
        .into()
}

fn query_error(err: sqlx::Error) -> anyhow::Error {
    match &err {
        sqlx::Error::Database(database_error) => {
            crate::response::DisplayError::new(database_error.message().to_string()).into()
        }
        _ => err.into(),
    }
}

impl ServerDatabase {
    /// Opens a connection to this database as the server's own database user, scoped to the
    /// database itself.
    pub async fn connect_as_tenant(
        &mut self,
        database: &crate::database::Database,
        read_only: bool,
    ) -> Result<TenantConnection, anyhow::Error> {
        let permit = tokio::time::timeout(
            TENANT_PERMIT_TIMEOUT,
            TENANT_CONNECTIONS.clone().acquire_owned(),
        )
        .await
        .map_err(|_| {
            crate::response::DisplayError::new("too many concurrent database connections")
                .with_status(axum::http::StatusCode::SERVICE_UNAVAILABLE)
        })??;

        let pool = {
            let mut pools = TENANT_POOLS.lock().await;
            match pools.get_mut(&self.uuid) {
                Some((last_used, password, pool)) if *password == self.password => {
                    *last_used = std::time::Instant::now();
                    Some(pool.clone())
                }
                _ => None,
            }
        };

        let pool = match pool {
            Some(pool) => pool,
            None => {
                let details = self
                    .database_host
                    .credentials
                    .parse_connection_details(database)
                    .await?;
                let password = database.decrypt(self.password.clone()).await?;

                let pool = match self.database_host.r#type {
                    DatabaseType::Mysql => TenantPool::Mysql(mysql::MysqlExplorer::create_pool(
                        &details.host,
                        details.port,
                        &self.username,
                        &password,
                        &self.name,
                    )),
                    DatabaseType::Postgres => {
                        TenantPool::Postgres(postgres::PostgresExplorer::create_pool(
                            &details.host,
                            details.port,
                            &self.username,
                            &password,
                            &self.name,
                        ))
                    }
                    DatabaseType::Mongodb => return Err(unsupported_engine()),
                };

                TENANT_POOLS.lock().await.insert(
                    self.uuid,
                    (
                        std::time::Instant::now(),
                        self.password.clone(),
                        pool.clone(),
                    ),
                );

                pool
            }
        };

        let mut inner: Box<dyn ExplorerConnection> = match pool {
            TenantPool::Mysql(pool) => Box::new(mysql::MysqlExplorer {
                connection: pool.acquire().await?,
                database: self.name.to_string(),
            }),
            TenantPool::Postgres(pool) => Box::new(postgres::PostgresExplorer {
                connection: pool.acquire().await?,
            }),
        };

        inner.set_read_only(read_only).await?;

        Ok(TenantConnection {
            inner,
            _permit: permit,
        })
    }

    pub async fn run_query(
        &mut self,
        database: &crate::database::Database,
        sql: &str,
        max_rows: u32,
        read_only: bool,
    ) -> Result<Vec<QueryResultSet>, anyhow::Error> {
        let mut connection = self.connect_as_tenant(database, read_only).await?;
        connection.inner.close_on_drop();

        let results = tokio::time::timeout(QUERY_CONNECTION_TIMEOUT, async move {
            connection
                .inner
                .run_query(sql, max_rows.min(QUERY_MAX_ROWS) as usize)
                .await
        })
        .await
        .map_err(|_| {
            crate::response::DisplayError::new("query timed out")
                .with_status(axum::http::StatusCode::REQUEST_TIMEOUT)
        })??;

        Ok(results)
    }
}

struct ResultCollector {
    max_rows: usize,
    results: Vec<QueryResultSet>,
    columns: Vec<QueryColumn>,
    rows: Vec<Vec<QueryValue>>,
    bytes: usize,
    truncated: bool,
}

impl ResultCollector {
    fn new(max_rows: usize) -> Self {
        Self {
            max_rows,
            results: Vec::new(),
            columns: Vec::new(),
            rows: Vec::new(),
            bytes: 0,
            truncated: false,
        }
    }

    fn push(
        &mut self,
        columns: impl FnOnce() -> Vec<QueryColumn>,
        row: impl FnOnce() -> Vec<QueryValue>,
    ) {
        if self.columns.is_empty() {
            self.columns = columns();
        }

        if self.rows.len() >= self.max_rows || self.bytes >= QUERY_MAX_BYTES {
            self.truncated = true;
            return;
        }

        let row = row();
        let bytes = row.iter().map(QueryValue::byte_len).sum::<usize>();

        if self.bytes + bytes > QUERY_MAX_BYTES {
            self.bytes = QUERY_MAX_BYTES;
            self.truncated = true;
            return;
        }

        self.bytes += bytes;
        self.rows.push(row);
    }

    fn finish_set(&mut self, rows_affected: u64) {
        self.results.push(QueryResultSet {
            columns: std::mem::take(&mut self.columns),
            rows: std::mem::take(&mut self.rows),
            rows_affected,
            truncated: std::mem::take(&mut self.truncated),
        });
    }

    fn into_results(mut self) -> Vec<QueryResultSet> {
        if !self.columns.is_empty() || !self.rows.is_empty() {
            self.finish_set(0);
        }

        self.results
    }
}

#[derive(ToSchema, Serialize, Clone)]
pub struct QueryColumn {
    pub name: CompactString,
    pub type_name: CompactString,
    #[serde(skip)]
    pub type_oid: Option<u32>,
    pub binary: bool,
}

#[derive(ToSchema, Serialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum QueryValue {
    Null,
    Text { value: String, truncated: bool },
    Binary { value: String, truncated: bool },
}

impl QueryValue {
    fn from_bytes(bytes: Option<&[u8]>) -> Self {
        let Some(bytes) = bytes else {
            return Self::Null;
        };

        match std::str::from_utf8(bytes) {
            Ok(value) => Self::text(value),
            Err(_) => Self::binary(bytes),
        }
    }

    fn text(value: &str) -> Self {
        Self::Text {
            value: crate::utils::slice_up_to(value, QUERY_MAX_VALUE_BYTES).to_owned(),
            truncated: value.len() > QUERY_MAX_VALUE_BYTES,
        }
    }

    fn binary(bytes: &[u8]) -> Self {
        let max = QUERY_MAX_VALUE_BYTES / 2;

        Self::Binary {
            value: hex::encode(&bytes[..bytes.len().min(max)]),
            truncated: bytes.len() > max,
        }
    }

    fn hex(hex: &[u8]) -> Self {
        let max = QUERY_MAX_VALUE_BYTES & !1;
        let cut = hex.len().min(max);

        Self::Binary {
            value: String::from_utf8_lossy(&hex[..cut]).into_owned(),
            truncated: hex.len() > cut,
        }
    }

    fn byte_len(&self) -> usize {
        match self {
            Self::Null => 0,
            Self::Text { value, .. } | Self::Binary { value, .. } => value.len(),
        }
    }
}

#[derive(ToSchema, Serialize, Clone)]
pub struct QueryResultSet {
    pub columns: Vec<QueryColumn>,
    pub rows: Vec<Vec<QueryValue>>,
    pub rows_affected: u64,
    pub truncated: bool,
}

#[derive(ToSchema, Serialize, Clone)]
pub struct SchemaColumn {
    pub name: CompactString,
    pub type_name: CompactString,
    #[serde(skip)]
    pub cast_type: Option<CompactString>,
    pub nullable: bool,
    pub default: Option<String>,
    pub primary_key: bool,
    pub auto_increment: bool,
    pub generated: bool,
    pub binary: bool,
}

#[derive(ToSchema, Serialize, Clone)]
pub struct SchemaTable {
    pub schema: Option<CompactString>,
    pub name: CompactString,
    pub view: bool,
    pub row_estimate: Option<i64>,
    pub columns: Vec<SchemaColumn>,
}

#[derive(ToSchema, Serialize, Clone)]
pub struct DatabaseSchema {
    pub tables: Vec<SchemaTable>,
    pub truncated: bool,
}

impl ServerDatabase {
    pub async fn get_schema(
        &mut self,
        database: &crate::database::Database,
    ) -> Result<DatabaseSchema, anyhow::Error> {
        let mut connection = self.connect_as_tenant(database, true).await?;

        let result = tokio::time::timeout(QUERY_CONNECTION_TIMEOUT, async {
            connection.inner.schema_tables().await
        })
        .await;

        match result {
            Ok(result) => result,
            Err(_) => {
                connection.inner.close_on_drop();

                Err(crate::response::DisplayError::new("query timed out")
                    .with_status(axum::http::StatusCode::REQUEST_TIMEOUT)
                    .into())
            }
        }
    }
}

#[derive(ToSchema, Deserialize, PartialEq, Eq, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum FilterOperator {
    Eq,
    Ne,
    Lt,
    Lte,
    Gt,
    Gte,
    Contains,
    StartsWith,
    EndsWith,
    IsNull,
    NotNull,
}

impl FilterOperator {
    fn comparison(self) -> Option<&'static str> {
        match self {
            Self::Eq => Some("="),
            Self::Ne => Some("<>"),
            Self::Lt => Some("<"),
            Self::Lte => Some("<="),
            Self::Gt => Some(">"),
            Self::Gte => Some(">="),
            _ => None,
        }
    }
}

#[derive(ToSchema, Validate, Deserialize)]
pub struct BrowseFilter {
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub column: CompactString,

    #[garde(skip)]
    pub operator: FilterOperator,

    #[garde(inner(length(chars, max = 4096)))]
    #[schema(max_length = 4096)]
    pub value: Option<String>,
}

fn default_browse_limit() -> u32 {
    BROWSE_DEFAULT_ROWS
}

#[derive(ToSchema, Validate, Deserialize)]
pub struct BrowseOptions {
    #[garde(inner(length(chars, min = 1, max = 255)))]
    #[schema(min_length = 1, max_length = 255)]
    pub schema: Option<CompactString>,

    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub table: CompactString,

    #[garde(inner(length(chars, min = 1, max = 255)))]
    #[schema(min_length = 1, max_length = 255)]
    pub order_by: Option<CompactString>,

    #[garde(skip)]
    #[serde(default)]
    pub descending: bool,

    #[garde(range(min = 1, max = BROWSE_MAX_ROWS))]
    #[schema(minimum = 1, maximum = 500)]
    #[serde(default = "default_browse_limit")]
    pub limit: u32,

    #[garde(skip)]
    #[serde(default)]
    pub offset: u64,

    #[garde(length(max = BROWSE_MAX_FILTERS), dive)]
    #[schema(max_items = 10)]
    #[serde(default)]
    pub filters: Vec<BrowseFilter>,
}

struct FilterClause {
    prefix: String,
    value: Option<String>,
    suffix: &'static str,
}

impl FilterClause {
    fn complete(sql: String) -> Self {
        Self {
            prefix: sql,
            value: None,
            suffix: "",
        }
    }
}

fn like_pattern(operator: FilterOperator, value: &str) -> String {
    let mut escaped = String::with_capacity(value.len() + 2);
    for c in value.chars() {
        if matches!(c, '%' | '_' | '!') {
            escaped.push('!');
        }
        escaped.push(c);
    }

    match operator {
        FilterOperator::Contains => format!("%{escaped}%"),
        FilterOperator::StartsWith => format!("{escaped}%"),
        FilterOperator::EndsWith => format!("%{escaped}"),
        _ => unreachable!(),
    }
}

fn filter_clause(
    connection: &dyn ExplorerConnection,
    columns: &[SchemaColumn],
    filter: &BrowseFilter,
) -> Result<FilterClause, anyhow::Error> {
    let column = columns
        .iter()
        .find(|column| column.name == filter.column)
        .ok_or_else(|| unknown_column(&filter.column))?;
    let quoted = connection.quote_ident(&column.name);

    if matches!(
        filter.operator,
        FilterOperator::IsNull | FilterOperator::NotNull
    ) {
        if filter.value.is_some() {
            return Err(display(format!(
                "a null check on {} does not take a value",
                column.name
            )));
        }

        let check = if matches!(filter.operator, FilterOperator::IsNull) {
            "IS NULL"
        } else {
            "IS NOT NULL"
        };

        return Ok(FilterClause::complete(format!("{quoted} {check}")));
    }

    let value = filter
        .value
        .as_deref()
        .ok_or_else(|| display(format!("a value is required to filter on {}", column.name)))?;

    if column.binary {
        if !matches!(filter.operator, FilterOperator::Eq | FilterOperator::Ne) {
            return Err(display(format!(
                "binary column {} only supports equality and null checks",
                column.name
            )));
        }

        check_hex(column, &filter.value)?;
        let operator = if matches!(filter.operator, FilterOperator::Eq) {
            "="
        } else {
            "<>"
        };

        return Ok(FilterClause::complete(format!(
            "{quoted} {operator} {}",
            connection.binary_literal(value)
        )));
    }

    if let Some(comparison) = filter.operator.comparison() {
        return Ok(FilterClause {
            prefix: format!("{quoted} {comparison} "),
            value: Some(value.to_string()),
            suffix: "",
        });
    }

    Ok(FilterClause {
        prefix: connection.like_prefix(&quoted),
        value: Some(like_pattern(filter.operator, value)),
        suffix: " ESCAPE '!'",
    })
}

fn assemble_where(
    clauses: &[FilterClause],
    literals: Vec<String>,
) -> Result<Option<String>, anyhow::Error> {
    if clauses.is_empty() {
        return Ok(None);
    }

    let mut literals = literals.into_iter();
    let mut parts = Vec::with_capacity(clauses.len());

    for clause in clauses {
        if clause.value.is_none() {
            parts.push(clause.prefix.clone());
            continue;
        }

        let Some(literal) = literals.next() else {
            return Err(display("filter values and literals fell out of step"));
        };

        parts.push(format!("{}{literal}{}", clause.prefix, clause.suffix));
    }

    Ok(Some(format!(" WHERE {}", parts.join(" AND "))))
}

impl ServerDatabase {
    pub async fn browse_rows(
        &mut self,
        database: &crate::database::Database,
        options: &BrowseOptions,
    ) -> Result<QueryResultSet, anyhow::Error> {
        let direction = if options.descending { "DESC" } else { "ASC" };

        let mut connection = self.connect_as_tenant(database, true).await?;

        let result = tokio::time::timeout(QUERY_CONNECTION_TIMEOUT, async {
            let columns = connection
                .inner
                .table_columns(options.schema.as_deref(), &options.table)
                .await?;
            if columns.is_empty() {
                return Err(unknown_table(&options.table));
            }

            let clauses = options
                .filters
                .iter()
                .map(|filter| filter_clause(&*connection.inner, &columns, filter))
                .collect::<Result<Vec<_>, _>>()?;
            let pending: Vec<String> = clauses
                .iter()
                .filter_map(|clause| clause.value.clone())
                .collect();
            let literals = if pending.is_empty() {
                Vec::new()
            } else {
                connection.inner.quote_values(&pending).await?
            };

            let mut sql = format!(
                "SELECT * FROM {}",
                connection
                    .inner
                    .qualified_table(options.schema.as_deref(), &options.table)
            );
            if let Some(where_clause) = assemble_where(&clauses, literals)? {
                sql.push_str(&where_clause);
            }
            if let Some(order_by) = &options.order_by {
                if !columns.iter().any(|column| column.name == *order_by) {
                    return Err(unknown_column(order_by));
                }

                sql.push_str(&format!(
                    " ORDER BY {} {direction}",
                    connection.inner.quote_ident(order_by)
                ));
            }
            sql.push_str(&format!(
                " LIMIT {} OFFSET {}",
                options.limit, options.offset
            ));

            connection
                .inner
                .fetch_unprepared(sql, options.limit as usize)
                .await
        })
        .await;

        match result {
            Ok(result) => result,
            Err(_) => {
                connection.inner.close_on_drop();

                Err(crate::response::DisplayError::new("query timed out")
                    .with_status(axum::http::StatusCode::REQUEST_TIMEOUT)
                    .into())
            }
        }
    }
}

#[derive(ToSchema, Validate, Deserialize, Clone)]
pub struct RowValue {
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub column: CompactString,

    #[garde(skip)]
    pub value: Option<String>,
}

#[derive(ToSchema, Validate, Deserialize)]
pub struct RowUpdate {
    #[garde(dive)]
    pub keys: Vec<RowValue>,
    #[garde(dive)]
    pub values: Vec<RowValue>,
}

#[derive(ToSchema, Validate, Deserialize)]
pub struct RowInsert {
    #[garde(dive)]
    pub values: Vec<RowValue>,
}

#[derive(ToSchema, Validate, Deserialize)]
pub struct RowDelete {
    #[garde(dive)]
    pub keys: Vec<RowValue>,
}

fn check_hex(column: &SchemaColumn, value: &Option<String>) -> Result<(), anyhow::Error> {
    let Some(value) = value else {
        return Ok(());
    };

    if column.binary && (value.len() % 2 != 0 || !value.chars().all(|c| c.is_ascii_hexdigit())) {
        return Err(display(format!(
            "value for {} is not valid hexadecimal",
            column.name
        )));
    }

    Ok(())
}

fn resolve<'a>(
    columns: &'a [SchemaColumn],
    entry: &RowValue,
    writable: bool,
) -> Result<&'a SchemaColumn, anyhow::Error> {
    let column = columns
        .iter()
        .find(|column| column.name == entry.column)
        .ok_or_else(|| unknown_column(&entry.column))?;

    if writable && column.generated {
        return Err(display(format!("column {} is generated", column.name)));
    }

    check_hex(column, &entry.value)?;

    Ok(column)
}

fn check_keys(columns: &[SchemaColumn], keys: &[RowValue]) -> Result<(), anyhow::Error> {
    let primary: Vec<&str> = columns
        .iter()
        .filter(|column| column.primary_key)
        .map(|column| column.name.as_str())
        .collect();

    if primary.is_empty() {
        return Err(display(
            "this table has no primary key, so its rows cannot be addressed",
        ));
    }

    if primary.len() != keys.len()
        || !primary
            .iter()
            .all(|name| keys.iter().any(|key| key.column.as_str() == *name))
    {
        return Err(display("the primary key of the row must be given in full"));
    }

    Ok(())
}

fn check_batch(rows: usize) -> Result<(), anyhow::Error> {
    if rows == 0 {
        return Err(display("no rows were given"));
    }

    if rows > MUTATE_MAX_ROWS {
        return Err(display(format!("at most {MUTATE_MAX_ROWS} rows at a time")));
    }

    Ok(())
}

impl ServerDatabase {
    pub async fn mutate_rows(
        &mut self,
        database: &crate::database::Database,
        schema: Option<&str>,
        table: &str,
        operation: RowOperation<'_>,
    ) -> Result<u64, anyhow::Error> {
        check_batch(operation.len())?;

        let mut connection = self.connect_as_tenant(database, false).await?;

        let result = tokio::time::timeout(QUERY_CONNECTION_TIMEOUT, async {
            let columns = connection.inner.table_columns(schema, table).await?;
            if columns.is_empty() {
                return Err(unknown_table(table));
            }

            let statements = operation.statements(&*connection.inner, &columns, schema, table)?;

            connection
                .inner
                .apply_statements(statements, operation.expects_single_row())
                .await
        })
        .await;

        match result {
            Ok(result) => result,
            Err(_) => {
                connection.inner.close_on_drop();

                Err(crate::response::DisplayError::new("statement timed out")
                    .with_status(axum::http::StatusCode::REQUEST_TIMEOUT)
                    .into())
            }
        }
    }
}

pub enum RowOperation<'a> {
    Insert(&'a [RowInsert]),
    Update(&'a [RowUpdate]),
    Delete(&'a [RowDelete]),
}

type Statement = (String, Vec<Option<String>>);

impl RowOperation<'_> {
    fn len(&self) -> usize {
        match self {
            Self::Insert(rows) => rows.len(),
            Self::Update(rows) => rows.len(),
            Self::Delete(rows) => rows.len(),
        }
    }

    fn expects_single_row(&self) -> bool {
        !matches!(self, Self::Delete(_))
    }

    fn statements(
        &self,
        connection: &dyn ExplorerConnection,
        columns: &[SchemaColumn],
        schema: Option<&str>,
        table: &str,
    ) -> Result<Vec<Statement>, anyhow::Error> {
        let quoted = connection.qualified_table(schema, table);

        match self {
            Self::Insert(rows) => rows
                .iter()
                .map(|row| {
                    let mut names = Vec::new();
                    let mut placeholders = Vec::new();
                    let mut binds = Vec::new();

                    for entry in &row.values {
                        let column = resolve(columns, entry, true)?;
                        names.push(connection.quote_ident(&column.name));
                        placeholders.push(connection.placeholder(column, binds.len() + 1));
                        binds.push(entry.value.clone());
                    }

                    if names.is_empty() {
                        return Ok((
                            format!("INSERT INTO {quoted} {}", connection.empty_insert_suffix()),
                            binds,
                        ));
                    }

                    Ok((
                        format!(
                            "INSERT INTO {quoted} ({}) VALUES ({})",
                            names.join(", "),
                            placeholders.join(", ")
                        ),
                        binds,
                    ))
                })
                .collect(),
            Self::Update(rows) => rows
                .iter()
                .map(|row| {
                    check_keys(columns, &row.keys)?;

                    let mut assignments = Vec::new();
                    let mut binds = Vec::new();

                    for entry in &row.values {
                        let column = resolve(columns, entry, true)?;
                        assignments.push(format!(
                            "{} = {}",
                            connection.quote_ident(&column.name),
                            connection.placeholder(column, binds.len() + 1)
                        ));
                        binds.push(entry.value.clone());
                    }

                    if assignments.is_empty() {
                        return Err(display("no columns were given to update"));
                    }

                    let (where_clause, key_binds) =
                        build_where(connection, columns, &row.keys, binds.len())?;
                    binds.extend(key_binds);

                    Ok((
                        format!(
                            "UPDATE {quoted} SET {} WHERE {where_clause}",
                            assignments.join(", ")
                        ),
                        binds,
                    ))
                })
                .collect(),
            Self::Delete(rows) => rows
                .iter()
                .map(|row| {
                    check_keys(columns, &row.keys)?;

                    let (where_clause, binds) = build_where(connection, columns, &row.keys, 0)?;

                    Ok((format!("DELETE FROM {quoted} WHERE {where_clause}"), binds))
                })
                .collect(),
        }
    }
}

fn build_where(
    connection: &dyn ExplorerConnection,
    columns: &[SchemaColumn],
    keys: &[RowValue],
    offset: usize,
) -> Result<(String, Vec<Option<String>>), anyhow::Error> {
    let mut clauses = Vec::new();
    let mut binds = Vec::new();

    for entry in keys {
        let column = resolve(columns, entry, false)?;
        clauses.push(format!(
            "{} = {}",
            connection.quote_ident(&column.name),
            connection.placeholder(column, offset + binds.len() + 1)
        ));
        binds.push(entry.value.clone());
    }

    Ok((clauses.join(" AND "), binds))
}

#[derive(ToSchema, Validate, Deserialize, Clone)]
pub struct ColumnDefinition {
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: CompactString,

    #[garde(length(chars, min = 1, max = 64))]
    #[schema(min_length = 1, max_length = 64)]
    pub r#type: CompactString,

    #[garde(skip)]
    #[serde(default)]
    pub nullable: bool,

    #[garde(skip)]
    #[serde(default)]
    pub primary_key: bool,

    #[garde(skip)]
    #[serde(default)]
    pub auto_increment: bool,
}

fn render_type(types: &[&str], input: &str) -> Result<String, anyhow::Error> {
    let input = input.trim().to_ascii_lowercase();
    let invalid = || display(format!("{input} is not a supported column type"));

    let (raw_base, args) = match input.split_once('(') {
        Some((base, rest)) => {
            let args = rest.strip_suffix(')').ok_or_else(invalid)?;
            (base, Some(args))
        }
        None => (input.as_str(), None),
    };

    let base = raw_base.split_whitespace().collect::<Vec<_>>().join(" ");
    let base = *types
        .iter()
        .find(|entry| **entry == base)
        .ok_or_else(invalid)?;

    let Some(args) = args else {
        return Ok(base.to_string());
    };

    let args: Vec<&str> = args.split(',').map(str::trim).collect();
    if args.len() > 2
        || args
            .iter()
            .any(|arg| arg.is_empty() || arg.len() > 10 || !arg.chars().all(|c| c.is_ascii_digit()))
    {
        return Err(invalid());
    }

    Ok(format!("{base}({})", args.join(",")))
}

fn render_column(
    connection: &dyn ExplorerConnection,
    column: &ColumnDefinition,
    rendered: &str,
) -> Result<String, anyhow::Error> {
    if column.auto_increment {
        if !column.primary_key {
            return Err(display(format!(
                "column {} must be part of the primary key to auto increment",
                column.name
            )));
        }

        if !connection.is_integer_type(rendered) {
            return Err(display(format!(
                "column {} must be an integer type to auto increment",
                column.name
            )));
        }
    }

    let name = connection.quote_ident(&column.name);

    let mut definition = format!("{name} {rendered}");
    if !column.nullable {
        definition.push_str(" NOT NULL");
    }
    if column.auto_increment {
        definition.push(' ');
        definition.push_str(connection.auto_increment_keyword());
    }

    Ok(definition)
}

fn create_table_sql(
    connection: &dyn ExplorerConnection,
    qualified: &str,
    columns: &[ColumnDefinition],
    rendered_types: &[String],
) -> Result<String, anyhow::Error> {
    for (index, column) in columns.iter().enumerate() {
        if columns[..index]
            .iter()
            .any(|other| other.name.eq_ignore_ascii_case(&column.name))
        {
            return Err(display(format!("column {} is given twice", column.name)));
        }
    }

    if columns
        .iter()
        .filter(|column| column.auto_increment)
        .count()
        > 1
    {
        return Err(display("only one column can auto increment"));
    }

    let mut definitions = columns
        .iter()
        .zip(rendered_types)
        .map(|(column, rendered)| render_column(connection, column, rendered))
        .collect::<Result<Vec<_>, _>>()?;

    let primary: Vec<String> = columns
        .iter()
        .filter(|column| column.primary_key)
        .map(|column| connection.quote_ident(&column.name))
        .collect();
    if !primary.is_empty() {
        definitions.push(format!("PRIMARY KEY ({})", primary.join(", ")));
    }

    Ok(format!(
        "CREATE TABLE {qualified} ({})",
        definitions.join(", ")
    ))
}

impl ServerDatabase {
    pub async fn column_types(
        &mut self,
        database: &crate::database::Database,
    ) -> Result<Vec<String>, anyhow::Error> {
        if matches!(self.database_host.r#type, DatabaseType::Mysql) {
            return Ok(mysql::MYSQL_TYPES.iter().map(ToString::to_string).collect());
        }

        let mut connection = self.connect_as_tenant(database, true).await?;

        connection.inner.column_types().await
    }

    pub async fn create_table(
        &mut self,
        database: &crate::database::Database,
        schema: Option<&str>,
        table: &str,
        columns: &[ColumnDefinition],
    ) -> Result<(), anyhow::Error> {
        let mut connection = self.connect_as_tenant(database, false).await?;
        connection.inner.close_on_drop();

        run_ddl(async move {
            let mut rendered = Vec::with_capacity(columns.len());
            for column in columns {
                rendered.push(connection.inner.resolve_type(&column.r#type).await?);
            }

            let qualified = connection.inner.qualified_table(schema, table);
            let sql = create_table_sql(&*connection.inner, &qualified, columns, &rendered)?;

            connection.inner.execute_ddl(sql).await
        })
        .await
    }

    async fn run_table_ddl(
        &mut self,
        database: &crate::database::Database,
        schema: Option<&str>,
        table: &str,
        build: impl FnOnce(
            &dyn ExplorerConnection,
            &str,
            &[SchemaColumn],
        ) -> Result<String, anyhow::Error>,
    ) -> Result<(), anyhow::Error> {
        let mut connection = self.connect_as_tenant(database, false).await?;
        connection.inner.close_on_drop();

        run_ddl(async move {
            let columns = connection.inner.table_columns(schema, table).await?;
            if columns.is_empty() {
                return Err(unknown_table(table));
            }

            let qualified = connection.inner.qualified_table(schema, table);
            let sql = build(&*connection.inner, &qualified, &columns)?;

            connection.inner.execute_ddl(sql).await
        })
        .await
    }

    pub async fn rename_table(
        &mut self,
        database: &crate::database::Database,
        schema: Option<&str>,
        table: &str,
        new_name: &str,
    ) -> Result<(), anyhow::Error> {
        self.run_table_ddl(
            database,
            schema,
            table,
            |connection, qualified, _columns| {
                Ok(format!(
                    "ALTER TABLE {qualified} RENAME TO {}",
                    connection.quote_ident(new_name)
                ))
            },
        )
        .await
    }

    pub async fn drop_table(
        &mut self,
        database: &crate::database::Database,
        schema: Option<&str>,
        table: &str,
    ) -> Result<(), anyhow::Error> {
        self.run_table_ddl(
            database,
            schema,
            table,
            |_connection, qualified, _columns| Ok(format!("DROP TABLE {qualified}")),
        )
        .await
    }

    pub async fn rename_column(
        &mut self,
        database: &crate::database::Database,
        schema: Option<&str>,
        table: &str,
        column: &str,
        new_name: &str,
    ) -> Result<(), anyhow::Error> {
        self.run_table_ddl(database, schema, table, |connection, qualified, columns| {
            if !columns.iter().any(|entry| entry.name == column) {
                return Err(unknown_column(column));
            }

            Ok(format!(
                "ALTER TABLE {qualified} RENAME COLUMN {} TO {}",
                connection.quote_ident(column),
                connection.quote_ident(new_name)
            ))
        })
        .await
    }

    pub async fn drop_column(
        &mut self,
        database: &crate::database::Database,
        schema: Option<&str>,
        table: &str,
        column: &str,
    ) -> Result<(), anyhow::Error> {
        self.run_table_ddl(database, schema, table, |connection, qualified, columns| {
            if !columns.iter().any(|entry| entry.name == column) {
                return Err(unknown_column(column));
            }

            Ok(format!(
                "ALTER TABLE {qualified} DROP COLUMN {}",
                connection.quote_ident(column)
            ))
        })
        .await
    }

    pub async fn add_column(
        &mut self,
        database: &crate::database::Database,
        schema: Option<&str>,
        table: &str,
        column: &ColumnDefinition,
    ) -> Result<(), anyhow::Error> {
        if column.primary_key || column.auto_increment {
            return Err(display(
                "an added column cannot be part of the primary key or auto increment",
            ));
        }

        let mut connection = self.connect_as_tenant(database, false).await?;
        connection.inner.close_on_drop();

        run_ddl(async move {
            let columns = connection.inner.table_columns(schema, table).await?;
            if columns.is_empty() {
                return Err(unknown_table(table));
            }
            if columns.iter().any(|entry| entry.name == column.name) {
                return Err(display(format!("column {} already exists", column.name)));
            }

            let rendered = connection.inner.resolve_type(&column.r#type).await?;
            let sql = format!(
                "ALTER TABLE {} ADD COLUMN {}",
                connection.inner.qualified_table(schema, table),
                render_column(&*connection.inner, column, &rendered)?
            );

            connection.inner.execute_ddl(sql).await
        })
        .await
    }
}

/// DDL is not bounded by the session statement timeout on every engine (mysql's
/// `max_execution_time` only applies to reads), so the outer timeout is what guarantees the
/// tenant-connection permit is released
async fn run_ddl(
    operation: impl Future<Output = Result<(), anyhow::Error>>,
) -> Result<(), anyhow::Error> {
    tokio::time::timeout(QUERY_CONNECTION_TIMEOUT, operation)
        .await
        .map_err(|_| {
            crate::response::DisplayError::new("statement timed out")
                .with_status(axum::http::StatusCode::REQUEST_TIMEOUT)
        })?
}

impl From<db_agent_api::QueryValue> for QueryValue {
    fn from(value: db_agent_api::QueryValue) -> Self {
        match value {
            db_agent_api::QueryValue::Null => Self::Null,
            db_agent_api::QueryValue::Text { value, truncated } => Self::Text { value, truncated },
            db_agent_api::QueryValue::Binary { value, truncated } => {
                Self::Binary { value, truncated }
            }
        }
    }
}

impl From<db_agent_api::QueryColumn> for QueryColumn {
    fn from(column: db_agent_api::QueryColumn) -> Self {
        Self {
            name: column.name,
            type_name: column.type_name,
            type_oid: None,
            binary: column.binary,
        }
    }
}

impl From<db_agent_api::QueryResultSet> for QueryResultSet {
    fn from(result: db_agent_api::QueryResultSet) -> Self {
        Self {
            columns: result.columns.into_iter().map(Into::into).collect(),
            rows: result
                .rows
                .into_iter()
                .map(|row| row.into_iter().map(Into::into).collect())
                .collect(),
            rows_affected: result.rows_affected,
            truncated: result.truncated,
        }
    }
}

impl From<wings_api::QueryValue> for QueryValue {
    fn from(value: wings_api::QueryValue) -> Self {
        match value {
            wings_api::QueryValue::Null => Self::Null,
            wings_api::QueryValue::Text { value, truncated } => Self::Text { value, truncated },
            wings_api::QueryValue::Binary { value, truncated } => Self::Binary { value, truncated },
        }
    }
}

impl From<wings_api::QueryColumn> for QueryColumn {
    fn from(column: wings_api::QueryColumn) -> Self {
        Self {
            name: column.name,
            type_name: column.type_name,
            type_oid: None,
            binary: column.binary,
        }
    }
}

impl From<wings_api::QueryResultSet> for QueryResultSet {
    fn from(result: wings_api::QueryResultSet) -> Self {
        Self {
            columns: result.columns.into_iter().map(Into::into).collect(),
            rows: result
                .rows
                .into_iter()
                .map(|row| row.into_iter().map(Into::into).collect())
                .collect(),
            rows_affected: result.rows_affected,
            truncated: result.truncated,
        }
    }
}

impl From<db_agent_api::SchemaColumn> for SchemaColumn {
    fn from(column: db_agent_api::SchemaColumn) -> Self {
        Self {
            name: column.name,
            type_name: column.type_name,
            cast_type: None,
            nullable: column.nullable,
            default: column.default.map(Into::into),
            primary_key: column.primary_key,
            auto_increment: column.auto_increment,
            generated: column.generated,
            binary: column.binary,
        }
    }
}

impl From<db_agent_api::SchemaTable> for SchemaTable {
    fn from(table: db_agent_api::SchemaTable) -> Self {
        Self {
            schema: table.schema,
            name: table.name,
            view: table.view,
            row_estimate: table.row_estimate,
            columns: table.columns.into_iter().map(Into::into).collect(),
        }
    }
}

impl From<FilterOperator> for db_agent_api::FilterOperator {
    fn from(operator: FilterOperator) -> Self {
        match operator {
            FilterOperator::Eq => Self::Eq,
            FilterOperator::Ne => Self::Ne,
            FilterOperator::Lt => Self::Lt,
            FilterOperator::Lte => Self::Lte,
            FilterOperator::Gt => Self::Gt,
            FilterOperator::Gte => Self::Gte,
            FilterOperator::Contains => Self::Contains,
            FilterOperator::StartsWith => Self::StartsWith,
            FilterOperator::EndsWith => Self::EndsWith,
            FilterOperator::IsNull => Self::IsNull,
            FilterOperator::NotNull => Self::NotNull,
        }
    }
}

impl From<BrowseFilter> for db_agent_api::BrowseFilter {
    fn from(filter: BrowseFilter) -> Self {
        Self {
            column: filter.column,
            operator: filter.operator.into(),
            value: filter.value.map(Into::into),
        }
    }
}

impl From<RowValue> for db_agent_api::RowValue {
    fn from(value: RowValue) -> Self {
        Self {
            column: value.column,
            value: value.value.map(Into::into),
        }
    }
}

impl From<RowInsert> for db_agent_api::RowInsert {
    fn from(row: RowInsert) -> Self {
        Self {
            values: row.values.into_iter().map(Into::into).collect(),
        }
    }
}

impl From<RowUpdate> for db_agent_api::RowUpdate {
    fn from(row: RowUpdate) -> Self {
        Self {
            keys: row.keys.into_iter().map(Into::into).collect(),
            values: row.values.into_iter().map(Into::into).collect(),
        }
    }
}

impl From<RowDelete> for db_agent_api::RowDelete {
    fn from(row: RowDelete) -> Self {
        Self {
            keys: row.keys.into_iter().map(Into::into).collect(),
        }
    }
}

impl From<ColumnDefinition> for db_agent_api::ColumnDefinition {
    fn from(column: ColumnDefinition) -> Self {
        Self {
            name: column.name,
            r#type: column.r#type,
            nullable: column.nullable,
            primary_key: column.primary_key,
            auto_increment: column.auto_increment,
        }
    }
}
