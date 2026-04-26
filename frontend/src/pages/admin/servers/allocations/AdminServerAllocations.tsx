import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import getServerAllocations from '@/api/admin/servers/allocations/getServerAllocations.ts';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import { ContextMenuProvider } from '@/elements/ContextMenu.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { serverAllocationTableColumns } from '@/lib/tableColumns.ts';
import ServerAllocationAddModal from '@/pages/admin/servers/allocations/modals/ServerAllocationAddModal.tsx';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import ServerAllocationRow from './ServerAllocationRow.tsx';

export default function AdminServerAllocations({ server }: { server: z.infer<typeof adminServerSchema> }) {
  const [openModal, setOpenModal] = useState<'add' | null>(null);

  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.servers.allocations(server.uuid),
    fetcher: (page, search) => getServerAllocations(server.uuid, page, search),
  });

  const serverAllocations = (data ?? getEmptyPaginationSet()) as NonNullable<typeof data>;

  return (
    <AdminSubContentContainer
      title='Server Allocations'
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      contentRight={
        <AdminCan action='nodes.read'>
          <Button onClick={() => setOpenModal('add')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
            Add
          </Button>
        </AdminCan>
      }
      registry={window.extensionContext.extensionRegistry.pages.admin.servers.view.allocations.subContainer}
      registryProps={{ server }}
    >
      <AdminCan action='nodes.read'>
        <ServerAllocationAddModal server={server} opened={openModal === 'add'} onClose={() => setOpenModal(null)} />
      </AdminCan>

      <ContextMenuProvider>
        <Table
          columns={serverAllocationTableColumns}
          loading={loading}
          pagination={serverAllocations}
          onPageSelect={setPage}
        >
          {serverAllocations.data.map((allocation) => (
            <ServerAllocationRow key={allocation.uuid} server={server} allocation={allocation} />
          ))}
        </Table>
      </ContextMenuProvider>
    </AdminSubContentContainer>
  );
}
