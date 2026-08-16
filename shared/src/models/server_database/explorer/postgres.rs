use super::{
    ExplorerConnection, QUERY_STATEMENT_TIMEOUT_MS, QueryColumn, QueryResultSet, QueryValue,
    ResultCollector, SchemaColumn, SchemaTable, Statement, TENANT_POOL_ACQUIRE_TIMEOUT,
    TENANT_POOL_IDLE_TIMEOUT, TENANT_POOL_MAX_CONNECTIONS, display, query_error, render_type,
};
use compact_str::CompactString;
use futures_util::StreamExt;
use sqlx::{
    Column, Connection, Either, Executor, Row, TypeInfo, ValueRef,
    postgres::{PgConnection, PgRow},
};
use std::collections::HashMap;

pub(super) struct PostgresExplorer {
    pub(super) connection: sqlx::pool::PoolConnection<sqlx::Postgres>,
}

impl PostgresExplorer {
    pub(super) fn create_pool(
        host: &str,
        port: u16,
        username: &str,
        password: &str,
        database: &str,
    ) -> sqlx::Pool<sqlx::Postgres> {
        sqlx::pool::PoolOptions::new()
            .min_connections(0)
            .max_connections(TENANT_POOL_MAX_CONNECTIONS)
            .idle_timeout(TENANT_POOL_IDLE_TIMEOUT)
            .acquire_timeout(TENANT_POOL_ACQUIRE_TIMEOUT)
            .after_connect(|connection, _| {
                Box::pin(async move {
                    sqlx::raw_sql(sqlx::AssertSqlSafe(format!(
                        "SET statement_timeout = {QUERY_STATEMENT_TIMEOUT_MS}; SET bytea_output = 'hex'"
                    )))
                    .execute(connection)
                    .await?;

                    Ok(())
                })
            })
            .connect_lazy_with(
                sqlx::postgres::PgConnectOptions::new()
                    .host(host)
                    .port(port)
                    .username(username)
                    .password(password)
                    .database(database),
            )
    }
}

const POSTGRES_UNRESOLVED: &str = "?";
const POSTGRES_BYTEA_OID: u32 = 17;

fn postgres_columns(row: &PgRow) -> Vec<QueryColumn> {
    row.columns()
        .iter()
        .map(|column| {
            let type_info = column.type_info();
            let type_oid = type_info.oid().map(|oid| oid.0);

            QueryColumn {
                name: column.name().into(),
                type_name: type_info.name().into(),
                type_oid,
                binary: type_oid == Some(POSTGRES_BYTEA_OID),
            }
        })
        .collect()
}

fn postgres_row(row: &PgRow) -> Vec<QueryValue> {
    row.columns()
        .iter()
        .map(|column| {
            let value = match row.try_get_raw(column.ordinal()) {
                Ok(value) => value,
                Err(_) => return QueryValue::Null,
            };
            if value.is_null() {
                return QueryValue::Null;
            }

            let bytes = value
                .as_bytes()
                .map(<[u8]>::to_vec)
                .unwrap_or_else(|_| Vec::new());

            if column.type_info().oid().map(|oid| oid.0) == Some(POSTGRES_BYTEA_OID) {
                let text = String::from_utf8_lossy(&bytes);
                return QueryValue::Binary {
                    value: text.strip_prefix("\\x").unwrap_or(&text).to_owned(),
                };
            }

            QueryValue::from_bytes(Some(bytes))
        })
        .collect()
}

fn postgres_unresolved_oids(columns: &[QueryColumn]) -> Vec<u32> {
    let mut oids: Vec<u32> = columns
        .iter()
        .filter(|column| column.type_name == POSTGRES_UNRESOLVED)
        .filter_map(|column| column.type_oid)
        .collect();

    oids.sort_unstable();
    oids.dedup();

    oids
}

async fn resolve_postgres_type_names(
    connection: &mut PgConnection,
    results: &mut [QueryResultSet],
) {
    let oids: Vec<u32> = {
        let mut oids: Vec<u32> = results
            .iter()
            .flat_map(|result| postgres_unresolved_oids(&result.columns))
            .collect();

        oids.sort_unstable();
        oids.dedup();
        oids
    };

    if oids.is_empty() {
        return;
    }

    let rows = match sqlx::query_as::<_, (i64, CompactString)>(
        "SELECT oid::int8, oid::regtype::text FROM pg_type WHERE oid = ANY($1)",
    )
    .bind(oids.iter().map(|oid| *oid as i64).collect::<Vec<_>>())
    .fetch_all(&mut *connection)
    .await
    {
        Ok(rows) => rows,
        Err(err) => {
            tracing::debug!("failed to resolve postgres type names: {err:#}");
            return;
        }
    };

    let names: HashMap<u32, CompactString> = rows
        .into_iter()
        .map(|(oid, name)| (oid as u32, name))
        .collect();

    for column in results
        .iter_mut()
        .flat_map(|result| result.columns.iter_mut())
    {
        if let Some(name) = column.type_oid.and_then(|oid| names.get(&oid)) {
            column.type_name.clone_from(name);
        }
    }
}

const POSTGRES_TABLE_COLUMNS: &str = "SELECT a.attname AS name,
    pg_catalog.format_type(a.atttypid, a.atttypmod) AS type_name,
    pg_catalog.format_type(a.atttypid, NULL) AS cast_type,
    NOT a.attnotnull AS nullable,
    (a.attgenerated <> '' OR a.attidentity = 'a') AS generated,
    pg_catalog.pg_get_expr(ad.adbin, ad.adrelid) AS default_expr,
    (a.attidentity <> ''
        OR COALESCE(pg_catalog.pg_get_expr(ad.adbin, ad.adrelid) LIKE 'nextval(%', false))
        AS auto_increment,
    COALESCE(i.indisprimary AND a.attnum = ANY (i.indkey::int2[]), false) AS primary_key
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    LEFT JOIN pg_catalog.pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
    LEFT JOIN pg_catalog.pg_index i ON i.indrelid = c.oid AND i.indisprimary
    WHERE n.nspname = $1 AND c.relname = $2
      AND pg_catalog.has_table_privilege(c.oid, 'SELECT')
    ORDER BY a.attnum";

const POSTGRES_TABLES: &str = "SELECT n.nspname AS schema, c.relname AS name,
    c.relkind::text AS relkind,
    CASE WHEN c.reltuples < 0 THEN NULL ELSE c.reltuples::int8 END AS row_estimate
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = ANY ('{r,p,v,m,f}')
      AND n.nspname <> 'information_schema' AND n.nspname !~ '^pg_'
      AND pg_catalog.has_schema_privilege(n.oid, 'USAGE')
      AND pg_catalog.has_table_privilege(c.oid, 'SELECT')
    ORDER BY n.nspname, c.relname";

const POSTGRES_COLUMNS: &str = "SELECT n.nspname AS schema, c.relname AS table_name,
    a.attname AS name, pg_catalog.format_type(a.atttypid, a.atttypmod) AS type_name,
    pg_catalog.format_type(a.atttypid, NULL) AS cast_type,
    NOT a.attnotnull AS nullable,
    (a.attgenerated <> '' OR a.attidentity = 'a') AS generated,
    pg_catalog.pg_get_expr(ad.adbin, ad.adrelid) AS default_expr,
    (a.attidentity <> ''
        OR COALESCE(pg_catalog.pg_get_expr(ad.adbin, ad.adrelid) LIKE 'nextval(%', false))
        AS auto_increment,
    COALESCE(i.indisprimary AND a.attnum = ANY (i.indkey::int2[]), false) AS primary_key
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    LEFT JOIN pg_catalog.pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
    LEFT JOIN pg_catalog.pg_index i ON i.indrelid = c.oid AND i.indisprimary
    WHERE c.relkind = ANY ('{r,p,v,m,f}')
      AND n.nspname <> 'information_schema' AND n.nspname !~ '^pg_'
      AND pg_catalog.has_schema_privilege(n.oid, 'USAGE')
      AND pg_catalog.has_table_privilege(c.oid, 'SELECT')
    ORDER BY n.nspname, c.relname, a.attnum";

fn postgres_column(row: &PgRow) -> Result<SchemaColumn, sqlx::Error> {
    let cast_type: Option<CompactString> = row.try_get("cast_type")?;
    let binary = cast_type.as_deref() == Some("bytea");

    Ok(SchemaColumn {
        name: row.try_get("name")?,
        type_name: row.try_get("type_name")?,
        cast_type,
        nullable: row.try_get("nullable")?,
        default: row.try_get("default_expr")?,
        primary_key: row.try_get("primary_key")?,
        auto_increment: row.try_get("auto_increment")?,
        generated: row.try_get("generated")?,
        binary,
    })
}

const POSTGRES_TYPES: &[&str] = &[
    "smallint",
    "int2",
    "integer",
    "int",
    "int4",
    "bigint",
    "int8",
    "decimal",
    "numeric",
    "real",
    "float4",
    "double precision",
    "float8",
    "boolean",
    "bool",
    "char",
    "character",
    "varchar",
    "character varying",
    "text",
    "bytea",
    "uuid",
    "json",
    "jsonb",
    "xml",
    "date",
    "time",
    "timetz",
    "timestamp",
    "timestamptz",
    "timestamp with time zone",
    "timestamp without time zone",
    "time with time zone",
    "time without time zone",
    "inet",
    "cidr",
    "macaddr",
    "macaddr8",
];

const POSTGRES_INTEGER_TYPES: &[&str] = &[
    "smallint", "int2", "integer", "int", "int4", "bigint", "int8",
];

const POSTGRES_USER_TYPES: &str = "SELECT t.oid::regtype::text FROM pg_catalog.pg_type t
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typtype IN ('e', 'd')
      AND n.nspname <> 'information_schema' AND n.nspname !~ '^pg_'
    ORDER BY 1";

#[async_trait::async_trait]
impl ExplorerConnection for PostgresExplorer {
    fn close_on_drop(&mut self) {
        self.connection.close_on_drop();
    }

    async fn set_read_only(&mut self, read_only: bool) -> Result<(), anyhow::Error> {
        sqlx::raw_sql(sqlx::AssertSqlSafe(format!(
            "SET SESSION CHARACTERISTICS AS TRANSACTION READ {}",
            if read_only { "ONLY" } else { "WRITE" }
        )))
        .execute(&mut *self.connection)
        .await?;

        Ok(())
    }

    fn quote_ident(&self, identifier: &str) -> String {
        format!("\"{}\"", identifier.replace('"', "\"\""))
    }

    fn qualified_table(&self, schema: Option<&str>, table: &str) -> String {
        format!(
            "{}.{}",
            self.quote_ident(schema.unwrap_or("public")),
            self.quote_ident(table)
        )
    }

    fn placeholder(&self, column: &SchemaColumn, index: usize) -> String {
        if column.binary {
            return format!("decode(${index}, 'hex')");
        }

        match &column.cast_type {
            Some(cast) => format!("${index}::{cast}"),
            None => format!("${index}"),
        }
    }

    fn like_prefix(&self, quoted_column: &str) -> String {
        format!("CAST({quoted_column} AS text) ILIKE ")
    }

    fn binary_literal(&self, hex: &str) -> String {
        format!("decode('{hex}', 'hex')")
    }

    fn empty_insert_suffix(&self) -> &'static str {
        "DEFAULT VALUES"
    }

    fn auto_increment_keyword(&self) -> &'static str {
        "GENERATED BY DEFAULT AS IDENTITY"
    }

    fn is_integer_type(&self, rendered: &str) -> bool {
        let base = rendered.split('(').next().unwrap_or(rendered);

        POSTGRES_INTEGER_TYPES.contains(&base)
    }

    async fn schema_tables(&mut self) -> Result<Vec<SchemaTable>, anyhow::Error> {
        let tables = sqlx::query(POSTGRES_TABLES)
            .fetch_all(&mut *self.connection)
            .await?;
        let columns = sqlx::query(POSTGRES_COLUMNS)
            .fetch_all(&mut *self.connection)
            .await?;

        let mut tables: Vec<SchemaTable> = tables
            .into_iter()
            .map(|row| {
                Ok(SchemaTable {
                    schema: Some(row.try_get("schema")?),
                    name: row.try_get("name")?,
                    view: matches!(row.try_get::<String, _>("relkind")?.as_str(), "v" | "m"),
                    row_estimate: row.try_get("row_estimate")?,
                    columns: Vec::new(),
                })
            })
            .collect::<Result<_, sqlx::Error>>()?;

        for row in columns {
            let schema: CompactString = row.try_get("schema")?;
            let table_name: CompactString = row.try_get("table_name")?;
            let Some(table) = tables.iter_mut().find(|table| {
                table.name == table_name && table.schema.as_deref() == Some(schema.as_str())
            }) else {
                continue;
            };

            table.columns.push(postgres_column(&row)?);
        }

        Ok(tables)
    }

    async fn table_columns(
        &mut self,
        schema: Option<&str>,
        table: &str,
    ) -> Result<Vec<SchemaColumn>, anyhow::Error> {
        let rows = sqlx::query(POSTGRES_TABLE_COLUMNS)
            .bind(schema.unwrap_or("public"))
            .bind(table)
            .fetch_all(&mut *self.connection)
            .await?;
        let columns = rows
            .iter()
            .map(postgres_column)
            .collect::<Result<Vec<_>, sqlx::Error>>()?;

        Ok(columns)
    }

    async fn column_types(&mut self) -> Result<Vec<String>, anyhow::Error> {
        let user_types: Vec<String> = sqlx::query_scalar(POSTGRES_USER_TYPES)
            .fetch_all(&mut *self.connection)
            .await
            .map_err(query_error)?;

        let mut types: Vec<String> = POSTGRES_TYPES.iter().map(ToString::to_string).collect();
        types.extend(user_types);

        Ok(types)
    }

    async fn resolve_type(&mut self, input: &str) -> Result<String, anyhow::Error> {
        if let Ok(rendered) = render_type(POSTGRES_TYPES, input) {
            return Ok(rendered);
        }

        sqlx::query_scalar("SELECT $1::regtype::text")
            .bind(input.trim())
            .fetch_one(&mut *self.connection)
            .await
            .map_err(|_| display(format!("{} is not a supported column type", input.trim())))
    }

    async fn quote_values(&mut self, values: &[String]) -> Result<Vec<String>, anyhow::Error> {
        let sql = format!(
            "SELECT {}",
            (1..=values.len())
                .map(|index| format!("quote_literal(${index})"))
                .collect::<Vec<_>>()
                .join(", ")
        );
        let mut query = sqlx::query(sqlx::AssertSqlSafe(sql));
        for value in values {
            query = query.bind(value);
        }

        let row = query
            .fetch_one(&mut *self.connection)
            .await
            .map_err(query_error)?;

        (0..values.len())
            .map(|index| Ok(row.try_get::<String, _>(index)?))
            .collect()
    }

    async fn fetch_unprepared(&mut self, sql: String) -> Result<QueryResultSet, anyhow::Error> {
        let rows = sqlx::raw_sql(sqlx::AssertSqlSafe(sql))
            .fetch_all(&mut *self.connection)
            .await
            .map_err(query_error)?;

        let mut result = QueryResultSet {
            columns: rows.first().map(postgres_columns).unwrap_or_default(),
            rows: rows.iter().map(postgres_row).collect(),
            rows_affected: 0,
            truncated: false,
        };

        resolve_postgres_type_names(&mut self.connection, std::slice::from_mut(&mut result)).await;

        Ok(result)
    }

    async fn run_query(
        &mut self,
        sql: &str,
        max_rows: usize,
    ) -> Result<Vec<QueryResultSet>, anyhow::Error> {
        let mut collector = ResultCollector::new(max_rows);
        let mut stream =
            sqlx::raw_sql(sqlx::AssertSqlSafe(sql.to_owned())).fetch_many(&mut *self.connection);

        while let Some(item) = stream.next().await {
            match item.map_err(query_error)? {
                Either::Left(result) => collector.finish_set(result.rows_affected()),
                Either::Right(row) => collector.push(|| postgres_columns(&row), postgres_row(&row)),
            }
        }

        drop(stream);
        let mut results = collector.into_results();
        resolve_postgres_type_names(&mut self.connection, &mut results).await;

        Ok(results)
    }

    async fn apply_statements(
        &mut self,
        statements: Vec<Statement>,
        expects_single_row: bool,
    ) -> Result<u64, anyhow::Error> {
        let mut transaction = self.connection.begin().await?;
        let mut affected = 0;

        for (sql, binds) in statements {
            let mut query = sqlx::query(sqlx::AssertSqlSafe(sql));
            for bind in binds {
                query = query.bind(bind);
            }

            let result = transaction.execute(query).await.map_err(query_error)?;
            if expects_single_row && result.rows_affected() != 1 {
                transaction.rollback().await?;

                return Err(display(
                    "a row did not match exactly once, nothing was changed",
                ));
            }

            affected += result.rows_affected();
        }

        transaction.commit().await?;

        Ok(affected)
    }

    async fn execute_ddl(&mut self, sql: String) -> Result<(), anyhow::Error> {
        self.connection
            .execute(sqlx::raw_sql(sqlx::AssertSqlSafe(sql)))
            .await
            .map_err(query_error)?;

        Ok(())
    }
}
