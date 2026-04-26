import { z } from 'zod';
import getBackupConfigurationNodes from '@/api/admin/backup-configurations/nodes/getBackupConfigurationNodes.ts';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { nodeTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import NodeRow from '../../nodes/NodeRow.tsx';

export default function AdminBackupConfigurationNodes({
  backupConfiguration,
}: {
  backupConfiguration: z.infer<typeof adminBackupConfigurationSchema>;
}) {
  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.backupConfigurations.nodes(backupConfiguration.uuid),
    fetcher: (page, search) => getBackupConfigurationNodes(backupConfiguration.uuid, page, search),
  });

  const backupConfigurationNodes = data ?? getEmptyPaginationSet<z.infer<typeof adminNodeSchema>>();

  return (
    <AdminSubContentContainer title={`Backup Config Nodes`} titleOrder={2} search={search} setSearch={setSearch}>
      <Table columns={nodeTableColumns} loading={loading} pagination={backupConfigurationNodes} onPageSelect={setPage}>
        {backupConfigurationNodes.data.map((node) => (
          <NodeRow key={node.uuid} node={node} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
