import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import getMountNodes from '@/api/admin/mounts/nodes/getMountNodes.ts';
import deleteNodeMount from '@/api/admin/nodes/mounts/deleteNodeMount.ts';
import { getEmptyPaginationSet, httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuProvider } from '@/elements/ContextMenu.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminMountSchema } from '@/lib/schemas/admin/mounts.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { nodeTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import NodeRow from '../../nodes/NodeRow.tsx';
import MountAddNodeModal from './modals/MountAddNodeModal.tsx';

function MountNodeRow({
  node,
  mount,
  refetch,
}: {
  node: z.infer<typeof adminNodeSchema>;
  mount: z.infer<typeof adminMountSchema>;
  refetch: () => void;
}) {
  const { addToast } = useToast();

  const [openModal, setOpenModal] = useState<'remove' | null>(null);

  const doRemove = async () => {
    await deleteNodeMount(node.uuid, mount.uuid)
      .then(() => {
        addToast('Mount Node deleted.', 'success');
        refetch();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <>
      <ConfirmationModal
        opened={openModal === 'remove'}
        onClose={() => setOpenModal(null)}
        title='Confirm Mount Node Removal'
        confirm='Remove'
        onConfirmed={doRemove}
      >
        Are you sure you want to remove the mount
        <Code>{mount.name}</Code>
        from <Code>{node.name}</Code>?
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            icon: faTrash,
            label: 'Remove',
            onClick: () => setOpenModal('remove'),
            color: 'red',
          },
        ]}
      >
        {(props) => <NodeRow node={node} contextMenuProps={props} />}
      </ContextMenu>
    </>
  );
}

export default function AdminMountNodes({ mount }: { mount: z.infer<typeof adminMountSchema> }) {
  const [openModal, setOpenModal] = useState<'add' | null>(null);

  const { data, loading, search, setSearch, setPage, refetch } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.mounts.nodes(mount.uuid),
    fetcher: (page, search) => getMountNodes(mount.uuid, page, search),
  });

  const mountNodes = data ?? getEmptyPaginationSet<AndCreated<{ node: z.infer<typeof adminNodeSchema> }>>();

  return (
    <AdminSubContentContainer
      title='Mount Nodes'
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      contentRight={
        <Button onClick={() => setOpenModal('add')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
          Add
        </Button>
      }
    >
      <MountAddNodeModal
        mount={mount}
        refetch={refetch}
        opened={openModal === 'add'}
        onClose={() => setOpenModal(null)}
      />

      <ContextMenuProvider>
        <Table columns={[...nodeTableColumns, '']} loading={loading} pagination={mountNodes} onPageSelect={setPage}>
          {mountNodes.data.map((nodeMount) => (
            <MountNodeRow key={nodeMount.node.uuid} node={nodeMount.node} mount={mount} refetch={refetch} />
          ))}
        </Table>
      </ContextMenuProvider>
    </AdminSubContentContainer>
  );
}
