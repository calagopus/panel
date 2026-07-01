import { Ref, useEffect } from 'react';
import { z } from 'zod';
import getNodeTransferringServers from '@/api/admin/nodes/servers/getNodeTransferringServers.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import SelectionArea from '@/elements/SelectionArea.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ServerRow from './ServerRow.tsx';

export default function AdminNodeTransfers({ node }: { node: z.infer<typeof adminNodeSchema> }) {
  const { t } = useTranslations();
  const {
    data: nodeTransferringServers,
    loading,
    search,
    setSearch,
    setPage,
    refetch,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.nodes.transfers(node.uuid),
    fetcher: (page, search) => getNodeTransferringServers(node.uuid, page, search),
    paginationKey: 'servers',
  });

  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 1000);

    return () => clearInterval(interval);
  }, [node.uuid, search]);

  return (
    <>
      <AdminSubContentContainer
        title={t('pages.admin.nodes.tabs.transfers.page.title', {})}
        titleOrder={2}
        search={search}
        setSearch={setSearch}
      >
        <Table
          columns={[
            t('common.table.columns.id', {}),
            t('pages.admin.nodes.tabs.transfers.page.table.columns.progress', {}),
            t('pages.admin.nodes.tabs.transfers.page.table.columns.archiveRate', {}),
            t('pages.admin.nodes.tabs.transfers.page.table.columns.networkRate', {}),
            t('common.table.columns.name', {}),
            t('common.table.columns.node', {}),
            t('common.table.columns.owner', {}),
            t('common.table.columns.created', {}),
          ]}
          loading={loading}
          pagination={nodeTransferringServers?.servers}
          onPageSelect={setPage}
          allowSelect={false}
        >
          {nodeTransferringServers?.servers.data.map((server) => (
            <SelectionArea.Selectable key={server.uuid} item={server}>
              {(innerRef: Ref<HTMLElement>) => (
                <ServerRow
                  key={server.uuid}
                  server={server}
                  transferProgress={nodeTransferringServers.transfers[server.uuid]}
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
