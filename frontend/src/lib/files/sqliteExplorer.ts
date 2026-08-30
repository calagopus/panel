import { z } from 'zod';
import {
  serverDatabaseBrowseFilterSchema,
  serverDatabaseQueryResultSchema,
  serverDatabaseQueryValueSchema,
  serverDatabaseRowValueSchema,
  serverDatabaseSchemaColumnSchema,
  serverDatabaseSchemaTableSchema,
} from '@/lib/schemas/server/databases.ts';
import { DatabaseExplorerContextType } from '@/providers/contexts/databaseExplorerContext.ts';

type SqliteRunner = (query: string, readOnly: boolean) => Promise<z.infer<typeof serverDatabaseQueryResultSchema>[]>;

export const SQLITE_COLUMN_TYPES = ['integer', 'real', 'text', 'blob', 'numeric'];

const quoteIdent = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;
const quoteText = (value: string) => `'${value.replaceAll("'", "''")}'`;

const literal = (value: string | null, binary: boolean) =>
  value === null ? 'NULL' : binary ? `x'${value.replaceAll(/[^0-9a-fA-F]/g, '')}'` : quoteText(value);

const cell = (value: z.infer<typeof serverDatabaseQueryValueSchema> | undefined): string | null =>
  !value || value.type === 'null' ? null : value.value;

const likePattern = (operator: 'contains' | 'starts_with' | 'ends_with', value: string) => {
  let escaped = '';
  for (const c of value) {
    if (c === '%' || c === '_' || c === '!') {
      escaped += '!';
    }
    escaped += c;
  }

  switch (operator) {
    case 'starts_with':
      return `${escaped}%`;
    case 'ends_with':
      return `%${escaped}`;
    default:
      return `%${escaped}%`;
  }
};

const filterClause = (
  columns: z.infer<typeof serverDatabaseSchemaColumnSchema>[],
  filter: z.infer<typeof serverDatabaseBrowseFilterSchema>,
) => {
  const quoted = quoteIdent(filter.column);
  const binary = columns.some((column) => column.name === filter.column && column.binary);

  switch (filter.operator) {
    case 'is_null':
      return `${quoted} IS NULL`;
    case 'not_null':
      return `${quoted} IS NOT NULL`;
    case 'contains':
    case 'starts_with':
    case 'ends_with':
      return `${quoted} LIKE ${quoteText(likePattern(filter.operator, filter.value ?? ''))} ESCAPE '!'`;
    default: {
      const comparison = { eq: '=', ne: '<>', lt: '<', lte: '<=', gt: '>', gte: '>=' }[filter.operator];

      return `${quoted} ${comparison} ${literal(filter.value, binary)}`;
    }
  }
};

const columnDefinition = (column: { name: string; type: string; nullable: boolean }) =>
  `${quoteIdent(column.name)} ${column.type}${column.nullable ? '' : ' NOT NULL'}`;

export function createSqliteExplorerApi(run: SqliteRunner): Omit<DatabaseExplorerContextType['api'], 'query'> {
  const tableColumns = new Map<string, z.infer<typeof serverDatabaseSchemaColumnSchema>[]>();

  const values = (entries: z.infer<typeof serverDatabaseRowValueSchema>[], table: string): [string, string][] => {
    const columns = tableColumns.get(table) ?? [];

    return entries.map((entry) => [
      quoteIdent(entry.column),
      literal(
        entry.value,
        columns.some((column) => column.name === entry.column && column.binary),
      ),
    ]);
  };

  const affected = (results: z.infer<typeof serverDatabaseQueryResultSchema>[]) =>
    results.reduce((total, result) => total + result.rowsAffected, 0);

  return {
    getSchema: async () => {
      const [master] = await run(
        "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite!_%' ESCAPE '!' ORDER BY name",
        true,
      );
      const entries = (master?.rows ?? []).flatMap((row) => {
        const name = cell(row[0]);

        return name === null ? [] : [{ name, view: cell(row[1]) === 'view' }];
      });
      const truncated = master?.truncated ?? false;
      if (entries.length === 0) {
        tableColumns.clear();

        return { tables: [], truncated };
      }

      const pragmas = await run(
        entries.map((entry) => `SELECT * FROM pragma_table_xinfo(${quoteText(entry.name)})`).join(';\n'),
        true,
      );

      tableColumns.clear();

      const tables = entries.map((entry, index): z.infer<typeof serverDatabaseSchemaTableSchema> => {
        const result = pragmas[index];
        const fields = Object.fromEntries((result?.columns ?? []).map((column, at) => [column.name, at]));

        const parsed = (result?.rows ?? []).flatMap((row) => {
          const name = cell(row[fields.name]);
          const hidden = Number(cell(row[fields.hidden]) ?? 0);

          if (name === null || hidden === 1) {
            return [];
          }

          const typeName = cell(row[fields.type]) ?? '';
          const primaryKey = Number(cell(row[fields.pk]) ?? 0) > 0;

          return [
            {
              name,
              typeName,
              nullable: cell(row[fields.notnull]) === '0' && !primaryKey,
              default: cell(row[fields.dflt_value]),
              primaryKey,
              autoIncrement: false,
              generated: hidden === 2 || hidden === 3,
              binary: typeName.toUpperCase().includes('BLOB'),
            },
          ];
        });

        const primary = parsed.filter((column) => column.primaryKey);
        const columns = parsed.map((column) => ({
          ...column,
          autoIncrement:
            column.primaryKey && primary.length === 1 && column.typeName.trim().toUpperCase() === 'INTEGER',
        }));

        tableColumns.set(entry.name, columns);

        return { schema: null, name: entry.name, view: entry.view, rowEstimate: null, columns };
      });

      return { tables, truncated };
    },

    browseRows: async (data) => {
      const columns = tableColumns.get(data.table) ?? [];

      let sql = `SELECT * FROM ${quoteIdent(data.table)}`;
      if (data.filters.length > 0) {
        sql += ` WHERE ${data.filters.map((filter) => filterClause(columns, filter)).join(' AND ')}`;
      }
      if (data.orderBy) {
        sql += ` ORDER BY ${quoteIdent(data.orderBy)} ${data.descending ? 'DESC' : 'ASC'}`;
      }
      sql += ` LIMIT ${Math.trunc(data.limit)} OFFSET ${Math.trunc(data.offset)}`;

      const [result] = await run(sql, true);

      return result ?? { columns: [], rows: [], rowsAffected: 0, truncated: false };
    },

    insertRows: async (data) => {
      const statements = data.rows.map((row) => {
        const entries = values(row.values, data.table);
        if (entries.length === 0) {
          return `INSERT INTO ${quoteIdent(data.table)} DEFAULT VALUES`;
        }

        return `INSERT INTO ${quoteIdent(data.table)} (${entries.map(([column]) => column).join(', ')}) VALUES (${entries.map(([, value]) => value).join(', ')})`;
      });

      return affected(await run(['BEGIN', ...statements, 'COMMIT'].join(';\n'), false));
    },

    updateRows: async (data) => {
      const statements = data.rows.map((row) => {
        const assignments = values(row.values, data.table).map(([column, value]) => `${column} = ${value}`);
        const keys = values(row.keys, data.table).map(([column, value]) =>
          value === 'NULL' ? `${column} IS NULL` : `${column} = ${value}`,
        );

        return `UPDATE ${quoteIdent(data.table)} SET ${assignments.join(', ')} WHERE ${keys.join(' AND ')}`;
      });

      return affected(await run(['BEGIN', ...statements, 'COMMIT'].join(';\n'), false));
    },

    deleteRows: async (data) => {
      const statements = data.rows.map((row) => {
        const keys = values(row.keys, data.table).map(([column, value]) =>
          value === 'NULL' ? `${column} IS NULL` : `${column} = ${value}`,
        );

        return `DELETE FROM ${quoteIdent(data.table)} WHERE ${keys.join(' AND ')}`;
      });

      return affected(await run(['BEGIN', ...statements, 'COMMIT'].join(';\n'), false));
    },

    getColumnTypes: () => Promise.resolve(SQLITE_COLUMN_TYPES),

    createTable: async (data) => {
      const primary = data.columns.filter((column) => column.primaryKey);
      const definitions = data.columns.map((column) => {
        if (column.autoIncrement && column.primaryKey && primary.length === 1) {
          return `${quoteIdent(column.name)} INTEGER PRIMARY KEY AUTOINCREMENT`;
        }

        return columnDefinition(column);
      });

      if (primary.length > 1 || (primary.length === 1 && !primary[0].autoIncrement)) {
        definitions.push(`PRIMARY KEY (${primary.map((column) => quoteIdent(column.name)).join(', ')})`);
      }

      await run(`CREATE TABLE ${quoteIdent(data.table)} (${definitions.join(', ')})`, false);
    },

    renameTable: async (data) => {
      await run(`ALTER TABLE ${quoteIdent(data.table)} RENAME TO ${quoteIdent(data.name)}`, false);
    },

    deleteTable: async (data) => {
      await run(`DROP TABLE ${quoteIdent(data.table)}`, false);
    },

    createColumn: async (data) => {
      await run(`ALTER TABLE ${quoteIdent(data.table)} ADD COLUMN ${columnDefinition(data.column)}`, false);
    },

    renameColumn: async (data) => {
      await run(
        `ALTER TABLE ${quoteIdent(data.table)} RENAME COLUMN ${quoteIdent(data.column)} TO ${quoteIdent(data.name)}`,
        false,
      );
    },

    deleteColumn: async (data) => {
      await run(`ALTER TABLE ${quoteIdent(data.table)} DROP COLUMN ${quoteIdent(data.column)}`, false);
    },
  };
}
