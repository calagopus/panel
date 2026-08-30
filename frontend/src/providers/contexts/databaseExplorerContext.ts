import { QueryKey } from '@tanstack/react-query';
import { createContext, useContext } from 'react';
import { z } from 'zod';
import {
  serverDatabaseBrowseSchema,
  serverDatabaseColumnCreateSchema,
  serverDatabaseColumnDeleteSchema,
  serverDatabaseColumnRenameSchema,
  serverDatabaseQueryResultSchema,
  serverDatabaseQuerySchema,
  serverDatabaseRowsDeleteSchema,
  serverDatabaseRowsInsertSchema,
  serverDatabaseRowsUpdateSchema,
  serverDatabaseSchemaSchema,
  serverDatabaseTableCreateSchema,
  serverDatabaseTableDeleteSchema,
  serverDatabaseTableRenameSchema,
} from '@/lib/schemas/server/databases.ts';

export type DatabaseExplorerAction = 'query-raw' | 'edit-rows' | 'edit-structure' | 'delete-structure';

export interface DatabaseExplorerContextType {
  api: {
    getSchema: () => Promise<z.infer<typeof serverDatabaseSchemaSchema>>;
    query: (
      data: z.infer<typeof serverDatabaseQuerySchema>,
    ) => Promise<z.infer<typeof serverDatabaseQueryResultSchema>[]>;
    browseRows: (
      data: z.infer<typeof serverDatabaseBrowseSchema>,
    ) => Promise<z.infer<typeof serverDatabaseQueryResultSchema>>;
    insertRows: (data: z.infer<typeof serverDatabaseRowsInsertSchema>) => Promise<number>;
    updateRows: (data: z.infer<typeof serverDatabaseRowsUpdateSchema>) => Promise<number>;
    deleteRows: (data: z.infer<typeof serverDatabaseRowsDeleteSchema>) => Promise<number>;
    getColumnTypes: () => Promise<string[]>;
    createTable: (data: z.infer<typeof serverDatabaseTableCreateSchema>) => Promise<void>;
    renameTable: (data: z.infer<typeof serverDatabaseTableRenameSchema>) => Promise<void>;
    deleteTable: (data: z.infer<typeof serverDatabaseTableDeleteSchema>) => Promise<void>;
    createColumn: (data: z.infer<typeof serverDatabaseColumnCreateSchema>) => Promise<void>;
    renameColumn: (data: z.infer<typeof serverDatabaseColumnRenameSchema>) => Promise<void>;
    deleteColumn: (data: z.infer<typeof serverDatabaseColumnDeleteSchema>) => Promise<void>;
  };
  keys: {
    schema: QueryKey;
    rows: QueryKey;
    columnTypes: QueryKey;
  };
  can: (action: DatabaseExplorerAction) => boolean;
  engine: 'mysql' | 'postgres' | 'sqlite';
  typeLabel: string;
  name: string;
}

export const DatabaseExplorerContext = createContext<DatabaseExplorerContextType | undefined>(undefined);

export const useDatabaseExplorer = (): DatabaseExplorerContextType => {
  const context = useContext(DatabaseExplorerContext);
  if (!context) {
    throw new Error('useDatabaseExplorer must be used within a DatabaseExplorerContext provider');
  }

  return context;
};
