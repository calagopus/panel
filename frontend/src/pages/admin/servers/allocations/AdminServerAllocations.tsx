import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import getServerAllocations from '@/api/admin/servers/allocations/getServerAllocations.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import { ContextMenuProvider } from '@/elements/ContextMenu.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { serverAllocationTableColumns } from '@/lib/tableColumns.ts';
import ServerAllocationAddModal from '@/pages/admin/servers/allocations/modals/ServerAllocationAddModal.tsx';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useAdminStore } from '@/stores/admin.tsx';
import ServerAllocationRow from './ServerAllocationRow.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';

export default function AdminServerAllocations({ server }: { server: AdminServer }) {
  const { serverAllocations, setServerAllocations } = useAdminStore();

  const [openModal, setOpenModal] = useState<'add' | null>(null);

  const { loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    fetcher: (page, search) => getServerAllocations(server.uuid, page, search),
    setStoreData: setServerAllocations,
  });

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
