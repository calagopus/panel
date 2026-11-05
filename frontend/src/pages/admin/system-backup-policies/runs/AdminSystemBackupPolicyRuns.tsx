import { z } from 'zod';
import getSystemBackupPolicyRuns from '@/api/admin/system-backup-policies/runs/getSystemBackupPolicyRuns.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminSystemBackupPolicySchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { systemBackupPolicyRunTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import SystemBackupPolicyRunRow from './SystemBackupPolicyRunRow.tsx';

export default function AdminSystemBackupPolicyRuns({
  systemBackupPolicy,
}: {
  systemBackupPolicy: z.infer<typeof adminSystemBackupPolicySchema>;
}) {
  const { t } = useTranslations();
  const {
    data: runs,
    loading,
    error,
    setPage,
    setPerPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.systemBackupPolicies.runs(systemBackupPolicy.uuid),
    fetcher: (page, _search, perPage) => getSystemBackupPolicyRuns(systemBackupPolicy.uuid, page, perPage),
    refetchInterval: (data) => (data?.data.some((run) => !run.completed) ? 5000 : false),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.systemBackupPolicies.tabs.runs.page.title', {})}
      titleOrder={2}
      registry={window.extensionContext.extensionRegistry.pages.admin.systemBackupPolicies.view.runs.subContainer}
      registryProps={{ systemBackupPolicy }}
    >
      <Table
        columns={systemBackupPolicyRunTableColumns()}
        loading={loading}
        error={error}
        pagination={runs}
        onPageSelect={setPage}
        onPerPageSelect={setPerPage}
      >
        {runs?.data.map((run) => (
          <SystemBackupPolicyRunRow key={run.uuid} systemBackupPolicy={systemBackupPolicy} run={run} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
