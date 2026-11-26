import { z } from 'zod';
import deleteFailedSystemBackupPolicyBackups from '@/api/admin/system-backup-policies/backups/deleteFailedSystemBackupPolicyBackups.ts';
import getSystemBackupPolicyBackups from '@/api/admin/system-backup-policies/backups/getSystemBackupPolicyBackups.ts';
import retryFailedSystemBackupPolicyBackupDeletions from '@/api/admin/system-backup-policies/backups/retryFailedSystemBackupPolicyBackupDeletions.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import Group from '@/elements/layout/Group.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminSystemBackupPolicySchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import DeleteFailedBackupsButton from '../../nodes/backups/DeleteFailedBackupsButton.tsx';
import NodeServerBackupRow from '../../nodes/backups/NodeServerBackupRow.tsx';
import RetryFailedDeletionsButton from '../../nodes/backups/RetryFailedDeletionsButton.tsx';

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
    setPerPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.backups.bySystemBackupPolicy(systemBackupPolicy.uuid),
    fetcher: (page, search, perPage) => getSystemBackupPolicyBackups(systemBackupPolicy.uuid, page, search, perPage),
    paginationKey: 'backups',
    refetchInterval: (data) =>
      data?.backups.data.some((backup) => backup.deletionStatus === 'deleting') ? 5000 : false,
  });

  const isDatabaseKind = systemBackupPolicy.kind === 'database_instance';

  return (
    <AdminSubContentContainer
      title={t('pages.admin.systemBackupPolicies.tabs.backups.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      contentRight={
        <Group>
          <DeleteFailedBackupsButton
            failed={systemBackupPolicyBackups?.failed ?? 0}
            onDelete={(force) => deleteFailedSystemBackupPolicyBackups(systemBackupPolicy.uuid, { force })}
          />

          <RetryFailedDeletionsButton
            failedDeletions={systemBackupPolicyBackups?.failedDeletions ?? 0}
            onRetry={(force) => retryFailedSystemBackupPolicyBackupDeletions(systemBackupPolicy.uuid, { force })}
          />
        </Group>
      }
      registry={window.extensionContext.extensionRegistry.pages.admin.systemBackupPolicies.view.backups.subContainer}
      registryProps={{ systemBackupPolicy }}
    >
      <Table
        columns={[
          t('common.table.columns.name', {}),
          ...(isDatabaseKind ? [t('common.table.columns.source', {})] : []),
          t('common.table.columns.server', {}),
          t('common.table.columns.node', {}),
          t('common.table.columns.checksum', {}),
          t('common.table.columns.size', {}),
          ...(isDatabaseKind ? [] : [t('common.table.columns.files', {})]),
          t('pages.server.backups.table.columns.retention', {}),
          t('common.table.columns.created', {}),
          '',
        ]}
        loading={loading}
        error={error}
        pagination={systemBackupPolicyBackups?.backups}
        onPageSelect={setPage}
        onPerPageSelect={setPerPage}
      >
        {systemBackupPolicyBackups?.backups.data.map((backup) => (
          <NodeServerBackupRow
            key={backup.uuid}
            backup={backup}
            showSource={isDatabaseKind}
            showFiles={!isDatabaseKind}
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
