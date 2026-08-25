import { AxiosError } from 'axios';
import { basename, join } from 'pathe';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import querySqliteFile from '@/api/server/files/querySqliteFile.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { createSqliteExplorerApi } from '@/lib/sqliteExplorer.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { DatabaseExplorerContext } from '@/providers/contexts/databaseExplorerContext.ts';
import { useServerStore } from '@/stores/server.ts';
import DatabaseExplorer from '../databases/explorer/DatabaseExplorer.tsx';

interface FileSqliteQueryProps {
  filePath?: string;
  onMissing?: () => void;
}

export default function FileSqliteQuery({ filePath: filePathProp, onMissing }: FileSqliteQueryProps) {
  const server = useServerStore((state) => state.server);
  const [searchParams] = useSearchParams();
  const canQueryRaw = useServerCan('files.query-raw');
  const canUpdate = useServerCan('files.update');

  const filePath = filePathProp ?? join(searchParams.get('directory') || '/', searchParams.get('file') || '');

  const runQuery = async (data: Parameters<typeof querySqliteFile>[1]) => {
    try {
      return await querySqliteFile(server.uuid, data);
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 404 && onMissing) {
        onMissing();
        return [];
      }

      throw error;
    }
  };

  const [sqliteApi] = useState(() =>
    createSqliteExplorerApi((query, readOnly) => runQuery({ file: filePath, query, rows: 1000, readOnly })),
  );

  return (
    <DatabaseExplorerContext.Provider
      value={{
        api: {
          query: (data) => runQuery({ file: filePath, ...data }),
          ...sqliteApi,
        },
        keys: {
          schema: [...queryKeys.server(server.uuid).files.all(), 'sqlite', filePath, 'schema'],
          rows: [...queryKeys.server(server.uuid).files.all(), 'sqlite', filePath, 'rows'],
          columnTypes: [...queryKeys.server(server.uuid).files.all(), 'sqlite', filePath, 'column-types'],
        },
        can: (action) => (action === 'query-raw' ? canQueryRaw : canQueryRaw && canUpdate),
        engine: 'sqlite',
        typeLabel: 'SQLite',
        name: basename(filePath),
      }}
    >
      <DatabaseExplorer key={filePath} />
    </DatabaseExplorerContext.Provider>
  );
}
