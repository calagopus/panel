import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import getMountNodes from '@/api/admin/mounts/nodes/getMountNodes.ts';
import deleteNodeMount from '@/api/admin/nodes/mounts/deleteNodeMount.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
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
import { useTranslations } from '@/providers/TranslationProvider.tsx';
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
  const { t } = useTranslations();

  const [openModal, setOpenModal] = useState<'remove' | null>(null);

  const doRemove = async () => {
    await deleteNodeMount(node.uuid, mount.uuid)
      .then(() => {
        addToast(t('pages.admin.mounts.tabs.nodes.page.toast.removed', {}), 'success');
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
        title={t('pages.admin.mounts.tabs.nodes.page.modal.remove.title', {})}
        confirm={t('common.button.remove', {})}
        onConfirmed={doRemove}
      >
        {t('pages.admin.mounts.tabs.nodes.page.modal.remove.content', { mount: mount.name, name: node.name }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            icon: faTrash,
            label: t('common.button.remove', {}),
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
  const { t } = useTranslations();
  const [openModal, setOpenModal] = useState<'add' | null>(null);

  const {
    data: mountNodes,
    loading,
    search,
    setSearch,
    setPage,
    refetch,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.mounts.nodes(mount.uuid),
    fetcher: (page, search) => getMountNodes(mount.uuid, page, search),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.mounts.tabs.nodes.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      contentRight={
        <Button onClick={() => setOpenModal('add')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
          {t('common.button.add', {})}
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
        <Table columns={[...nodeTableColumns(), '']} loading={loading} pagination={mountNodes} onPageSelect={setPage}>
          {mountNodes?.data.map((nodeMount) => (
            <MountNodeRow key={nodeMount.node.uuid} node={nodeMount.node} mount={mount} refetch={refetch} />
          ))}
        </Table>
      </ContextMenuProvider>
    </AdminSubContentContainer>
  );
}
