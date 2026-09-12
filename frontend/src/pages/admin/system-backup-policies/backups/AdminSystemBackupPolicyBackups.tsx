import { z } from 'zod';
import deleteFailedSystemBackupPolicyBackups from '@/api/admin/system-backup-policies/backups/deleteFailedSystemBackupPolicyBackups.ts';
import getSystemBackupPolicyBackups from '@/api/admin/system-backup-policies/backups/getSystemBackupPolicyBackups.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminSystemBackupPolicySchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import DeleteFailedBackupsButton from '../../nodes/backups/DeleteFailedBackupsButton.tsx';
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
    queryKey: queryKeys.admin.backups.bySystemBackupPolicy(systemBackupPolicy.uuid),
    fetcher: (page, search) => getSystemBackupPolicyBackups(systemBackupPolicy.uuid, page, search),
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
        <DeleteFailedBackupsButton
          failed={systemBackupPolicyBackups?.failed ?? 0}
          onDelete={(force) => deleteFailedSystemBackupPolicyBackups(systemBackupPolicy.uuid, { force })}
        />
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
          t('common.table.columns.created', {}),
          '',
        ]}
        loading={loading}
        error={error}
        pagination={systemBackupPolicyBackups?.backups}
        onPageSelect={setPage}
      >
        {systemBackupPolicyBackups?.backups.data.map((backup) => (
          <NodeServerBackupRow
            key={backup.uuid}
            backup={backup}
            showSource={isDatabaseKind}
            showFiles={!isDatabaseKind}
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
