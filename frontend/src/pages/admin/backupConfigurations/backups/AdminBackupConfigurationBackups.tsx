import { z } from 'zod';
import getBackupConfigurationBackups from '@/api/admin/backup-configurations/backups/getBackupConfigurationBackups.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import NodeServerBackupRow from '../../nodes/backups/NodeServerBackupRow.tsx';

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
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.backupConfigurations.backups(backupConfiguration.uuid),
    fetcher: (page, search) => getBackupConfigurationBackups(backupConfiguration.uuid, page, search),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.backupConfigurations.tabs.backups.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      registry={window.extensionContext.extensionRegistry.pages.admin.backupConfigurations.view.backups.subContainer}
      registryProps={{ backupConfiguration }}
    >
      <Table
        columns={[
          t('common.table.columns.name', {}),
          t('common.table.columns.server', {}),
          t('common.table.columns.node', {}),
          t('common.table.columns.checksum', {}),
          t('common.table.columns.size', {}),
          t('common.table.columns.files', {}),
          t('common.table.columns.created', {}),
          '',
        ]}
        loading={loading}
        error={error}
        pagination={backupConfigurationBackups}
        onPageSelect={setPage}
      >
        {backupConfigurationBackups?.data.map((backup) => (
          <NodeServerBackupRow
            key={backup.uuid}
            backup={backup}
            downloadStartedMessage={t('pages.admin.backupConfigurations.tabs.backups.page.toast.downloadStarted', {})}
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
