import { z } from 'zod';
import getSystemBackupPolicyBackups from '@/api/admin/system-backup-policies/backups/getSystemBackupPolicyBackups.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminSystemBackupPolicySchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import NodeServerBackupRow from '../../nodes/backups/NodeServerBackupRow.tsx';

export default function AdminSystemBackupPolicyBackups({
  systemBackupPolicy,
}: {
  systemBackupPolicy: z.infer<typeof adminSystemBackupPolicySchema>;
}) {
  const { t } = useTranslations();
  const {
    data: systemBackupPolicyBackups,
    loading,
    error,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.systemBackupPolicies.backups(systemBackupPolicy.uuid),
    fetcher: (page, search) => getSystemBackupPolicyBackups(systemBackupPolicy.uuid, page, search),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.systemBackupPolicies.tabs.backups.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      registry={window.extensionContext.extensionRegistry.pages.admin.systemBackupPolicies.view.backups.subContainer}
      registryProps={{ systemBackupPolicy }}
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
        pagination={systemBackupPolicyBackups}
        onPageSelect={setPage}
      >
        {systemBackupPolicyBackups?.data.map((backup) => (
          <NodeServerBackupRow
            key={backup.uuid}
            backup={backup}
            downloadStartedMessage={t('pages.admin.systemBackupPolicies.tabs.backups.page.toast.downloadStarted', {})}
            registry={
              window.extensionContext.extensionRegistry.pages.admin.systemBackupPolicies.view.backups.contextMenu
            }
            registryProps={{ systemBackupPolicy, backup }}
          />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
