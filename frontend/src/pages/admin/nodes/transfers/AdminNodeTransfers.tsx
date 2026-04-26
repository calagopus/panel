import { Ref, useEffect } from 'react';
import { z } from 'zod';
import getNodeTransferringServers from '@/api/admin/nodes/servers/getNodeTransferringServers.ts';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import SelectionArea from '@/elements/SelectionArea.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import ServerRow from './ServerRow.tsx';

export default function AdminNodeTransfers({ node }: { node: z.infer<typeof adminNodeSchema> }) {
  const { data, loading, search, setSearch, setPage, refetch } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.nodes.transfers(node.uuid),
    fetcher: (page, search) => getNodeTransferringServers(node.uuid, page, search),
    paginationKey: 'servers',
  });

  const servers = data?.servers ?? getEmptyPaginationSet<z.infer<typeof adminServerSchema>>();
  const transfers = data?.transfers ?? {};

  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 1000);

    return () => clearInterval(interval);
  }, [node.uuid, search]);

  return (
    <>
      <AdminSubContentContainer title='Node Transfers' titleOrder={2} search={search} setSearch={setSearch}>
        <Table
          columns={['ID', 'Progress', 'Archive Rate', 'Network Rate', 'Name', 'Node', 'Owner', 'Created']}
          loading={loading}
          pagination={servers}
          onPageSelect={setPage}
          allowSelect={false}
        >
          {servers.data.map((server) => (
            <SelectionArea.Selectable key={server.uuid} item={server}>
              {(innerRef: Ref<HTMLElement>) => (
                <ServerRow
                  key={server.uuid}
                  server={server}
                  transferProgress={transfers[server.uuid]}
                  ref={innerRef as Ref<HTMLTableRowElement>}
                />
              )}
            </SelectionArea.Selectable>
          ))}
        </Table>
      </AdminSubContentContainer>
    </>
  );
}
