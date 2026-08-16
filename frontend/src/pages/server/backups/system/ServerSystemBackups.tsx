import getSystemBackups from '@/api/server/backups/getSystemBackups.ts';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import BackupRow from '../BackupRow.tsx';
import BackupsSubNavigation from '../BackupsSubNavigation.tsx';

export default function ServerSystemBackups() {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);

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

      <Table
        columns={[
          t('common.table.columns.name', {}),
          t('pages.server.backups.table.columns.checksum', {}),
          t('common.table.columns.size', {}),
          t('pages.server.backups.table.columns.files', {}),
          t('common.table.columns.created', {}),
          '',
        ]}
        loading={loading}
        pagination={backups}
        onPageSelect={setPage}
        error={error}
      >
        {backups?.data.map((backup) => (
          <BackupRow backup={backup} key={backup.uuid} readOnly />
        ))}
      </Table>
    </ServerContentContainer>
  );
}
