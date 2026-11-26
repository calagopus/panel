import { z } from 'zod';
import deleteFailedBackupConfigurationBackups from '@/api/admin/backup-configurations/backups/deleteFailedBackupConfigurationBackups.ts';
import getBackupConfigurationBackups from '@/api/admin/backup-configurations/backups/getBackupConfigurationBackups.ts';
import retryFailedBackupConfigurationBackupDeletions from '@/api/admin/backup-configurations/backups/retryFailedBackupConfigurationBackupDeletions.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import Group from '@/elements/layout/Group.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import DeleteFailedBackupsButton from '../../nodes/backups/DeleteFailedBackupsButton.tsx';
import NodeServerBackupRow from '../../nodes/backups/NodeServerBackupRow.tsx';
import RetryFailedDeletionsButton from '../../nodes/backups/RetryFailedDeletionsButton.tsx';

export default function AdminBackupConfigurationBackups({
  backupConfiguration,
}: {
  backupConfiguration: z.infer<typeof adminBackupConfigurationSchema>;
}) {
  const { t } = useTranslations();
  const {
    data: backupConfigurationBackups,
    loading,
    error,
    search,
    setSearch,
    setPage,
    setPerPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.backups.byBackupConfiguration(backupConfiguration.uuid),
    fetcher: (page, search, perPage) =>
      getBackupConfigurationBackups(backupConfiguration.uuid, page, search, undefined, perPage),
    paginationKey: 'backups',
    refetchInterval: (data) =>
      data?.backups.data.some((backup) => backup.deletionStatus === 'deleting') ? 5000 : false,
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.backupConfigurations.tabs.backups.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      contentRight={
        <Group>
          <DeleteFailedBackupsButton
            failed={backupConfigurationBackups?.failed ?? 0}
            onDelete={(force) => deleteFailedBackupConfigurationBackups(backupConfiguration.uuid, { force })}
          />

          <RetryFailedDeletionsButton
            failedDeletions={backupConfigurationBackups?.failedDeletions ?? 0}
            onRetry={(force) => retryFailedBackupConfigurationBackupDeletions(backupConfiguration.uuid, { force })}
          />
        </Group>
      }
      registry={window.extensionContext.extensionRegistry.pages.admin.backupConfigurations.view.backups.subContainer}
      registryProps={{ backupConfiguration }}
    >
      <Table
        columns={[
          t('common.table.columns.name', {}),
          t('pages.server.backups.table.columns.kind', {}),
          t('common.table.columns.source', {}),
          t('common.table.columns.server', {}),
          t('common.table.columns.node', {}),
          t('common.table.columns.checksum', {}),
          t('common.table.columns.size', {}),
          t('common.table.columns.files', {}),
          t('pages.server.backups.table.columns.retention', {}),
          t('common.table.columns.created', {}),
          '',
        ]}
        loading={loading}
        error={error}
        pagination={backupConfigurationBackups?.backups}
        onPageSelect={setPage}
        onPerPageSelect={setPerPage}
      >
        {backupConfigurationBackups?.backups.data.map((backup) => (
          <NodeServerBackupRow
            key={backup.uuid}
            backup={backup}
            showKind
            showSource
            registry={
              window.extensionContext.extensionRegistry.pages.admin.backupConfigurations.view.backups.contextMenu
            }
            registryProps={{ backupConfiguration, backup }}
          />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
