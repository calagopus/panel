import { z } from 'zod';
import getLocationNodes from '@/api/admin/locations/nodes/getLocationNodes.ts';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminLocationSchema } from '@/lib/schemas/admin/locations.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { nodeTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import NodeRow from '../../nodes/NodeRow.tsx';

export default function AdminLocationNodes({ location }: { location: z.infer<typeof adminLocationSchema> }) {
  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.locations.nodes(location.uuid),
    fetcher: (page, search) => getLocationNodes(location.uuid, page, search),
  });

  const locationNodes = data ?? getEmptyPaginationSet<z.infer<typeof adminNodeSchema>>();

  return (
    <AdminSubContentContainer title='Location Nodes' titleOrder={2} search={search} setSearch={setSearch}>
      <Table columns={nodeTableColumns} loading={loading} pagination={locationNodes} onPageSelect={setPage}>
        {locationNodes.data.map((node) => (
          <NodeRow key={node.uuid} node={node} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
