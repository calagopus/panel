import { useMemo } from 'react';
import getSystemBackups from '@/api/server/backups/getSystemBackups.ts';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import BackupRow from '../BackupRow.tsx';
import BackupsSubNavigation from '../BackupsSubNavigation.tsx';
import { getBackupColumns } from '../columns.ts';

export default function ServerSystemBackups() {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);

  const columns = useMemo(() => getBackupColumns({ kind: false, source: false, files: true, locked: false }), []);

  const {
    data: backups,
    loading,
    error,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.server(server.uuid).backups.system(),
    fetcher: (page, search) => getSystemBackups(server.uuid, page, search),
  });

  return (
    <ServerContentContainer
      title={t('pages.server.systemBackups.title', {})}
      subtitle={t('pages.server.systemBackups.subtitle', {})}
      search={search}
      setSearch={setSearch}
      registry={window.extensionContext.extensionRegistry.pages.server.backups.system.container}
    >
      <BackupsSubNavigation />

      <Table columns={columns.headers} loading={loading} pagination={backups} onPageSelect={setPage} error={error}>
        {backups?.data.map((backup) => (
          <BackupRow backup={backup} columns={columns} key={backup.uuid} readOnly />
        ))}
      </Table>
    </ServerContentContainer>
  );
}
