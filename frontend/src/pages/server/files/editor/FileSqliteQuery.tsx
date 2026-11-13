import { AxiosError } from 'axios';
import { basename, join } from 'pathe';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { httpErrorToHuman } from '@/api/axios.ts';
import querySqliteFile from '@/api/server/files/querySqliteFile.ts';
import sendPowerAction from '@/api/server/sendPowerAction.ts';
import Button from '@/elements/buttons/Button.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Group from '@/elements/layout/Group.tsx';
import Text from '@/elements/typography/Text.tsx';
import { createSqliteExplorerApi } from '@/lib/files/sqliteExplorer.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { DatabaseExplorerContext } from '@/providers/contexts/databaseExplorerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import DatabaseExplorer from '../../databases/explorer/DatabaseExplorer.tsx';

interface FileSqliteQueryProps {
  filePath?: string;
  onMissing?: () => void;
}

export default function FileSqliteQuery({ filePath: filePathProp, onMissing }: FileSqliteQueryProps) {
  const server = useServerStore((state) => state.server);
  const [searchParams] = useSearchParams();
  const canQueryRaw = useServerCan('files.query-raw');
  const canUpdate = useServerCan('files.update');
  const canStop = useServerCan('control.stop');
  const { t } = useTranslations();
  const { addToast } = useToast();
  const serverState = useServerStore((state) => state.state);
  const [stopping, setStopping] = useState(false);

  const doStop = () => {
    setStopping(true);
    sendPowerAction(server.uuid, 'stop')
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setStopping(false));
  };

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
      {canQueryRaw && canUpdate && serverState !== 'offline' && (
        <Alert color='yellow' mb='sm'>
          <Group justify='space-between' wrap='nowrap'>
            <Text size='sm'>{t('pages.server.files.sqlite.serverRunning', {})}</Text>
            {canStop && (
              <Button
                size='xs'
                color='red'
                loading={stopping || serverState === 'stopping'}
                disabled={serverState === 'stopping'}
                onClick={doStop}
              >
                {t('common.enum.serverPowerAction.stop', {})}
              </Button>
            )}
          </Group>
        </Alert>
      )}
      <DatabaseExplorer key={filePath} />
    </DatabaseExplorerContext.Provider>
  );
}
