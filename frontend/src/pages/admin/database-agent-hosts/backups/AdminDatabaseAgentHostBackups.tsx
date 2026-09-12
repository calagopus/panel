import { z } from 'zod';
import deleteFailedDatabaseAgentHostBackups from '@/api/admin/database-agent-hosts/backups/deleteFailedDatabaseAgentHostBackups.ts';
import getDatabaseAgentHostBackups from '@/api/admin/database-agent-hosts/backups/getDatabaseAgentHostBackups.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDatabaseAgentHostSchema } from '@/lib/schemas/admin/databaseAgentHosts.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import DeleteFailedBackupsButton from '../../nodes/backups/DeleteFailedBackupsButton.tsx';
import NodeServerBackupRow from '../../nodes/backups/NodeServerBackupRow.tsx';

export default function AdminDatabaseAgentHostBackups({
  databaseAgentHost,
}: {
  databaseAgentHost: z.infer<typeof adminDatabaseAgentHostSchema>;
}) {
  const { t } = useTranslations();
  const {
    data: databaseAgentHostBackups,
    loading,
    error,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.backups.byDatabaseAgentHost(databaseAgentHost.uuid),
    fetcher: (page, search) => getDatabaseAgentHostBackups(databaseAgentHost.uuid, page, search),
    paginationKey: 'backups',
    refetchInterval: (data) =>
      data?.backups.data.some((backup) => backup.deletionStatus === 'deleting') ? 5000 : false,
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.databaseAgentHosts.tabs.backups.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      contentRight={
        <DeleteFailedBackupsButton
          action='database-agent-hosts.backups'
          failed={databaseAgentHostBackups?.failed ?? 0}
          onDelete={(force) => deleteFailedDatabaseAgentHostBackups(databaseAgentHost.uuid, { force })}
        />
      }
      registry={window.extensionContext.extensionRegistry.pages.admin.databaseAgentHosts.view.backups.subContainer}
      registryProps={{ databaseAgentHost }}
    >
      <Table
        columns={[
          t('common.table.columns.name', {}),
          t('common.table.columns.source', {}),
          t('common.table.columns.server', {}),
          t('common.table.columns.node', {}),
          t('common.table.columns.checksum', {}),
          t('common.table.columns.size', {}),
          t('common.table.columns.created', {}),
          '',
        ]}
        loading={loading}
        error={error}
        pagination={databaseAgentHostBackups?.backups}
        onPageSelect={setPage}
      >
        {databaseAgentHostBackups?.backups.data.map((backup) => (
          <NodeServerBackupRow
            key={backup.uuid}
            backup={backup}
            showSource
            showFiles={false}
            downloadStartedMessage={t('pages.admin.databaseAgentHosts.tabs.backups.page.toast.downloadStarted', {})}
            registry={window.extensionContext.extensionRegistry.pages.admin.databaseAgentHosts.view.backups.contextMenu}
            registryProps={{ databaseAgentHost, backup }}
          />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
