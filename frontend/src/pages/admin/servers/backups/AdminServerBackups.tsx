import { useState } from 'react';
import getServerBackups from '@/api/admin/servers/backups/getServerBackups.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import Switch from '@/elements/input/Switch.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { AdminServer } from '@/lib/schemas/admin/servers.ts';
import { serverBackupTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminServerBackupRow from './AdminServerBackupRow.tsx';

export default function AdminServerBackups({ server }: { server: AdminServer }) {
  const { t } = useTranslations();
  const [showPartiallyDetachedServerBackups, setShowPartiallyDetachedServerBackups] = useState(false);

  const {
    data: serverBackups,
    loading,
    error,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.backups.byServer(server.uuid),
    fetcher: (page, search) => getServerBackups(server.uuid, page, search, showPartiallyDetachedServerBackups),
    deps: [showPartiallyDetachedServerBackups],
    refetchInterval: (data) => (data?.data.some((backup) => backup.deletionStatus === 'deleting') ? 5000 : false),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.servers.tabs.backups.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      contentRight={
        <Switch
          label={t('pages.admin.servers.tabs.backups.page.input.partiallyDetachedOnly', {})}
          checked={showPartiallyDetachedServerBackups}
          onChange={(e) => setShowPartiallyDetachedServerBackups(e.currentTarget.checked)}
        />
      }
      registry={window.extensionContext.extensionRegistry.pages.admin.servers.view.backups.subContainer}
      registryProps={{ server }}
    >
      <Table
        columns={serverBackupTableColumns()}
        loading={loading}
        error={error}
        pagination={serverBackups}
        onPageSelect={setPage}
      >
        {serverBackups?.data.map((backup) => (
          <AdminServerBackupRow key={backup.uuid} server={server} backup={backup} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
