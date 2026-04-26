import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import getNodeMounts from '@/api/admin/nodes/mounts/getNodeMounts.ts';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { ContextMenuProvider } from '@/elements/ContextMenu.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { nodeMountTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import NodeMountAddModal from './modals/NodeMountAddModal.tsx';
import NodeMountRow from './NodeMountRow.tsx';

export default function AdminNodeMounts({ node }: { node: z.infer<typeof adminNodeSchema> }) {
  const [openModal, setOpenModal] = useState<'add' | null>(null);

  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.nodes.mounts(node.uuid),
    fetcher: (page, search) => getNodeMounts(node.uuid, page, search),
  });

  const nodeMounts = (data ?? getEmptyPaginationSet()) as NonNullable<typeof data>;

  return (
    <AdminSubContentContainer
      title='Node Mounts'
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      contentRight={
        <Button onClick={() => setOpenModal('add')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
          Add
        </Button>
      }
    >
      <NodeMountAddModal node={node} opened={openModal === 'add'} onClose={() => setOpenModal(null)} />

      <ContextMenuProvider>
        <Table columns={nodeMountTableColumns} loading={loading} pagination={nodeMounts} onPageSelect={setPage}>
          {nodeMounts.data.map((mount) => (
            <NodeMountRow key={mount.mount.uuid} node={node} mount={mount} />
          ))}
        </Table>
      </ContextMenuProvider>
    </AdminSubContentContainer>
  );
}
