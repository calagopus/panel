import { Ref, useCallback, useRef, useState } from 'react';
import { z } from 'zod';
import getNodeTransferringServers from '@/api/admin/nodes/transfers/getNodeTransferringServers.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import SelectionArea from '@/elements/dnd/SelectionArea.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeSchema, adminNodeTransfersSchema } from '@/lib/schemas/admin/nodes.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useWebsocket } from '@/plugins/websocket/useWebsocket.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ServerRow, { TransferProgressWithRates } from './ServerRow.tsx';

export default function AdminNodeTransfers({ node }: { node: z.infer<typeof adminNodeSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();

  const {
    data: nodeTransferringServers,
    loading,
    error,
    search,
    setSearch,
    setPage,
    refetch,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.nodes.transfers(node.uuid),
    fetcher: (page, search) => getNodeTransferringServers(node.uuid, page, search),
    paginationKey: 'servers',
  });

  const [progress, setProgress] = useState<Record<string, TransferProgressWithRates>>({});
  const lastFrame = useRef<{ at: number; keys: string } | null>(null);
  const staleAfterLoss = useRef(false);

  const onFrame = useCallback(
    (frame: z.infer<typeof adminNodeTransfersSchema>) => {
      const now = performance.now();
      const previous = lastFrame.current;
      const elapsedSeconds = previous ? (now - previous.at) / 1000 : 0;

      setProgress((current) =>
        Object.fromEntries(
          Object.entries(frame).map(([uuid, next]) => {
            const last = current[uuid];
            if (!last || elapsedSeconds <= 0) {
              return [uuid, { ...next, archiveRate: last?.archiveRate ?? 0, networkRate: last?.networkRate ?? 0 }];
            }

            return [
              uuid,
              {
                ...next,
                archiveRate: (next.archiveBytesProcessed - last.archiveBytesProcessed) / elapsedSeconds,
                networkRate: (next.networkBytesProcessed - last.networkBytesProcessed) / elapsedSeconds,
              },
            ];
          }),
        ),
      );

      const keys = Object.keys(frame).sort().join(',');
      if (staleAfterLoss.current || (previous && previous.keys !== keys)) {
        staleAfterLoss.current = false;
        refetch();
      }

      lastFrame.current = { at: now, keys };
    },
    [refetch],
  );

  useWebsocket({
    path: `/api/admin/nodes/${node.uuid}/transfers/ws`,
    schema: adminNodeTransfersSchema,
    reconnectDelay: 5000,
    onMessage: onFrame,
    onConnectionLost: () => {
      lastFrame.current = null;
      staleAfterLoss.current = true;
      setProgress({});
      addToast(t('pages.admin.nodes.tabs.transfers.page.toast.connectionLost', {}), 'error');
    },
  });

  return (
    <>
      <AdminSubContentContainer
        title={t('pages.admin.nodes.tabs.transfers.page.title', {})}
        titleOrder={2}
        search={search}
        setSearch={setSearch}
        registry={window.extensionContext.extensionRegistry.pages.admin.nodes.view.transfers.subContainer}
        registryProps={{ node }}
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
          error={error}
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
                  transferProgress={progress[server.uuid]}
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
