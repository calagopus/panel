use super::{
    ExplorerConnection, QUERY_STATEMENT_TIMEOUT_MS, QueryColumn, QueryResultSet, QueryValue,
    ResultCollector, SchemaColumn, SchemaTable, Statement, TENANT_POOL_ACQUIRE_TIMEOUT,
    TENANT_POOL_IDLE_TIMEOUT, TENANT_POOL_MAX_CONNECTIONS, display, query_error, render_type,
};
use compact_str::CompactString;
use futures_util::StreamExt;
use sqlx::{Column, Connection, Decode, Either, Executor, MySql, Row, TypeInfo, mysql::MySqlRow};

pub(super) struct MysqlExplorer {
    pub(super) connection: sqlx::pool::PoolConnection<MySql>,
    pub(super) database: String,
}

impl MysqlExplorer {
    pub(super) fn create_pool(
        host: &str,
        port: u16,
        username: &str,
        password: &str,
        database: &str,
    ) -> sqlx::Pool<MySql> {
        sqlx::pool::PoolOptions::new()
            .min_connections(0)
            .max_connections(TENANT_POOL_MAX_CONNECTIONS)
            .idle_timeout(TENANT_POOL_IDLE_TIMEOUT)
            .acquire_timeout(TENANT_POOL_ACQUIRE_TIMEOUT)
            .after_connect(|connection, _| {
                Box::pin(async move {
                    let version: (String,) = sqlx::query_as("SELECT VERSION()")
                        .fetch_one(&mut *connection)
                        .await?;
                    let statement_timeout = if version.0.contains("MariaDB") {
                        format!(
                            "SET SESSION max_statement_time = {}",
                            QUERY_STATEMENT_TIMEOUT_MS as f64 / 1000.0
                        )
                    } else {
                        format!("SET SESSION max_execution_time = {QUERY_STATEMENT_TIMEOUT_MS}")
                    };

                    sqlx::raw_sql(sqlx::AssertSqlSafe(statement_timeout))
                        .execute(connection)
                        .await?;

                    Ok(())
                })
            })
            .connect_lazy_with(
                sqlx::mysql::MySqlConnectOptions::new()
                    .host(host)
                    .port(port)
                    .username(username)
                    .password(password)
                    .database(database),
            )
    }
}

fn mysql_type_is_binary(type_name: &str) -> bool {
    matches!(
        type_name,
        "BINARY"
            | "VARBINARY"
            | "TINYBLOB"
            | "BLOB"
            | "MEDIUMBLOB"
            | "LONGBLOB"
            | "BIT"
            | "GEOMETRY"
    )
}

fn mysql_columns(row: &MySqlRow) -> Vec<QueryColumn> {
    row.columns()
        .iter()
        .map(|column| {
            let type_name: CompactString = column.type_info().name().into();
            let binary = mysql_type_is_binary(&type_name);

            QueryColumn {
                name: column.name().into(),
                type_name,
                type_oid: None,
                binary,
            }
        })
        .collect()
}

fn mysql_row(row: &MySqlRow) -> Vec<QueryValue> {
    row.columns()
        .iter()
        .map(|column| {
            let value = match row.try_get_raw(column.ordinal()) {
                Ok(value) => value,
                Err(_) => return QueryValue::Null,
            };

            let Some(bytes) = <&[u8] as Decode<MySql>>::decode(value)
                .ok()
                .map(<[u8]>::to_vec)
            else {
                return QueryValue::Null;
            };

            if mysql_type_is_binary(column.type_info().name()) {
                return QueryValue::Binary {
                    value: hex::encode(bytes),
                };
            }

            QueryValue::from_bytes(Some(bytes))
        })
        .collect()
}

const MYSQL_TABLES: &str = "SELECT TABLE_NAME, TABLE_TYPE,
    CAST(TABLE_ROWS AS SIGNED) AS row_estimate
    FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME";

const MYSQL_COLUMNS: &str = "SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT,
    CAST(IS_NULLABLE = 'YES' AS SIGNED) AS nullable,
    CAST(COLUMN_KEY = 'PRI' AS SIGNED) AS primary_key,
    CAST(EXTRA LIKE '%auto_increment%' AS SIGNED) AS auto_increment,
    CAST(EXTRA LIKE '%VIRTUAL GENERATED%' OR EXTRA LIKE '%STORED GENERATED%' AS SIGNED)
        AS is_generated,
    CAST(DATA_TYPE IN ('binary', 'varbinary', 'bit', 'geometry') OR DATA_TYPE LIKE '%blob' AS SIGNED)
        AS binary_data
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, ORDINAL_POSITION";

const MYSQL_TABLE_COLUMNS: &str = "SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT,
    CAST(IS_NULLABLE = 'YES' AS SIGNED) AS nullable,
    CAST(COLUMN_KEY = 'PRI' AS SIGNED) AS primary_key,
    CAST(EXTRA LIKE '%auto_increment%' AS SIGNED) AS auto_increment,
    CAST(EXTRA LIKE '%VIRTUAL GENERATED%' OR EXTRA LIKE '%STORED GENERATED%' AS SIGNED)
        AS is_generated,
    CAST(DATA_TYPE IN ('binary', 'varbinary', 'bit', 'geometry') OR DATA_TYPE LIKE '%blob' AS SIGNED)
        AS binary_data
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
    ORDER BY ORDINAL_POSITION";

fn mysql_column(row: &MySqlRow) -> Result<SchemaColumn, sqlx::Error> {
    Ok(SchemaColumn {
        name: row.try_get("COLUMN_NAME")?,
        type_name: row.try_get("COLUMN_TYPE")?,
        cast_type: None,
        nullable: row.try_get::<i64, _>("nullable")? != 0,
        default: row
            .try_get::<Option<String>, _>("COLUMN_DEFAULT")?
            .filter(|value| value != "NULL"),
        primary_key: row.try_get::<i64, _>("primary_key")? != 0,
        auto_increment: row.try_get::<i64, _>("auto_increment")? != 0,
        generated: row.try_get::<i64, _>("is_generated")? != 0,
        binary: row.try_get::<Option<i64>, _>("binary_data")?.unwrap_or(0) != 0,
    })
}

pub(super) const MYSQL_TYPES: &[&str] = &[
    "tinyint",
    "smallint",
    "mediumint",
    "int",
    "integer",
    "bigint",
    "decimal",
    "numeric",
    "float",
    "double",
    "bit",
    "bool",
    "boolean",
    "char",
    "varchar",
    "tinytext",
    "text",
    "mediumtext",
    "longtext",
    "binary",
    "varbinary",
    "tinyblob",
    "blob",
    "mediumblob",
    "longblob",
    "date",
    "datetime",
    "timestamp",
    "time",
    "year",
    "json",
];

const MYSQL_INTEGER_TYPES: &[&str] = &[
    "tinyint",
    "smallint",
    "mediumint",
    "int",
    "integer",
    "bigint",
];

#[async_trait::async_trait]
impl ExplorerConnection for MysqlExplorer {
    fn close_on_drop(&mut self) {
        self.connection.close_on_drop();
    }

    async fn set_read_only(&mut self, read_only: bool) -> Result<(), anyhow::Error> {
        let statement = if read_only {
            "SET SESSION TRANSACTION READ ONLY"
        } else {
            "SET SESSION TRANSACTION READ WRITE"
        };

        sqlx::raw_sql(statement)
            .execute(&mut *self.connection)
            .await?;

        Ok(())
    }

    fn quote_ident(&self, identifier: &str) -> String {
        format!("`{}`", identifier.replace('`', "``"))
    }

    fn qualified_table(&self, _schema: Option<&str>, table: &str) -> String {
        self.quote_ident(table)
    }

    fn placeholder(&self, column: &SchemaColumn, _index: usize) -> String {
        if column.binary { "UNHEX(?)" } else { "?" }.to_string()
    }

    fn like_prefix(&self, quoted_column: &str) -> String {
        format!("{quoted_column} LIKE ")
    }

    fn binary_literal(&self, hex: &str) -> String {
        format!("UNHEX('{hex}')")
    }

    fn empty_insert_suffix(&self) -> &'static str {
        "() VALUES ()"
    }

    fn auto_increment_keyword(&self) -> &'static str {
        "AUTO_INCREMENT"
    }

    fn is_integer_type(&self, rendered: &str) -> bool {
        let base = rendered.split('(').next().unwrap_or(rendered);

        MYSQL_INTEGER_TYPES.contains(&base)
    }

    async fn schema_tables(&mut self) -> Result<Vec<SchemaTable>, anyhow::Error> {
        let tables = sqlx::query(MYSQL_TABLES)
            .bind(&self.database)
            .fetch_all(&mut *self.connection)
            .await?;
        let columns = sqlx::query(MYSQL_COLUMNS)
            .bind(&self.database)
            .fetch_all(&mut *self.connection)
            .await?;

        let mut tables: Vec<SchemaTable> = tables
            .into_iter()
            .map(|row| {
                Ok(SchemaTable {
                    schema: None,
                    name: row.try_get("TABLE_NAME")?,
                    view: row.try_get::<String, _>("TABLE_TYPE")? == "VIEW",
                    row_estimate: row.try_get("row_estimate")?,
                    columns: Vec::new(),
                })
            })
            .collect::<Result<_, sqlx::Error>>()?;

        for row in columns {
            let table_name: CompactString = row.try_get("TABLE_NAME")?;
            let Some(table) = tables.iter_mut().find(|table| table.name == table_name) else {
                continue;
            };

            table.columns.push(mysql_column(&row)?);
        }

        Ok(tables)
    }

    async fn table_columns(
        &mut self,
        _schema: Option<&str>,
        table: &str,
    ) -> Result<Vec<SchemaColumn>, anyhow::Error> {
        let rows = sqlx::query(MYSQL_TABLE_COLUMNS)
            .bind(&self.database)
            .bind(table)
            .fetch_all(&mut *self.connection)
            .await?;
        let columns = rows
            .iter()
            .map(mysql_column)
            .collect::<Result<Vec<_>, sqlx::Error>>()?;

        Ok(columns)
    }

    async fn column_types(&mut self) -> Result<Vec<String>, anyhow::Error> {
        Ok(MYSQL_TYPES.iter().map(ToString::to_string).collect())
    }

    async fn resolve_type(&mut self, input: &str) -> Result<String, anyhow::Error> {
        render_type(MYSQL_TYPES, input)
    }

    async fn quote_values(&mut self, values: &[String]) -> Result<Vec<String>, anyhow::Error> {
        let sql = format!("SELECT {}", vec!["QUOTE(?)"; values.len()].join(", "));
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

        Ok(QueryResultSet {
            columns: rows.first().map(mysql_columns).unwrap_or_default(),
            rows: rows.iter().map(mysql_row).collect(),
            rows_affected: 0,
            truncated: false,
        })
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
                Either::Right(row) => collector.push(|| mysql_columns(&row), mysql_row(&row)),
            }
        }

        drop(stream);

        Ok(collector.into_results())
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
