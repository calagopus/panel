import { z } from 'zod';
import getBackupConfigurationNodes from '@/api/admin/backup-configurations/nodes/getBackupConfigurationNodes.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { nodeTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import NodeRow from '../../nodes/NodeRow.tsx';

export default function AdminBackupConfigurationNodes({
  backupConfiguration,
}: {
  backupConfiguration: z.infer<typeof adminBackupConfigurationSchema>;
}) {
  const { t } = useTranslations();
  const {
    data: backupConfigurationNodes,
    loading,
    error,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.backupConfigurations.nodes(backupConfiguration.uuid),
    fetcher: (page, search) => getBackupConfigurationNodes(backupConfiguration.uuid, page, search),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.backupConfigurations.tabs.nodes.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
    >
      <Table
        columns={nodeTableColumns()}
        loading={loading}
        pagination={backupConfigurationNodes}
        onPageSelect={setPage}
        error={error}
      >
        {backupConfigurationNodes?.data.map((node) => (
          <NodeRow key={node.uuid} node={node} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
