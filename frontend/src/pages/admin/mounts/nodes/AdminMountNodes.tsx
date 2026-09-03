import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import getMountNodes from '@/api/admin/mounts/nodes/getMountNodes.ts';
import deleteNodeMount from '@/api/admin/nodes/mounts/deleteNodeMount.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ContextMenu from '@/elements/overlays/ContextMenu.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminMountSchema } from '@/lib/schemas/admin/mounts.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { nodeTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import NodeRow from '../../nodes/NodeRow.tsx';
import MountAddNodeModal from './modals/MountAddNodeModal.tsx';

function MountNodeRow({
  node,
  mount,
}: {
  node: z.infer<typeof adminNodeSchema>;
  mount: z.infer<typeof adminMountSchema>;
}) {
  const { addToast } = useToast();
  const { t } = useTranslations();
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'remove' | null>(null);

  const doRemove = async () => {
    await deleteNodeMount(node.uuid, mount.uuid)
      .then(() => {
        setOpenModal(null);
        addToast(t('pages.admin.mounts.tabs.nodes.page.toast.removed', {}), 'success');
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.mountAssignments.all() });
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
            type: 'action',
            icon: faTrash,
            label: t('common.button.remove', {}),
            onClick: () => setOpenModal('remove'),
            color: 'red',
            canAccess: useAdminCan('nodes.mounts'),
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.admin.mounts.view.nodes.contextMenu}
        registryProps={{ mount, node }}
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
    error,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.mountAssignments.nodesByMount(mount.uuid),
    fetcher: (page, search) => getMountNodes(mount.uuid, page, search),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.mounts.tabs.nodes.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      registry={window.extensionContext.extensionRegistry.pages.admin.mounts.view.nodes.subContainer}
      registryProps={{ mount }}
      contentRight={
        <AdminCan action='nodes.mounts'>
          <Button onClick={() => setOpenModal('add')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
            {t('common.button.add', {})}
          </Button>
        </AdminCan>
      }
    >
      <AdminCan action='nodes.mounts'>
        <MountAddNodeModal mount={mount} opened={openModal === 'add'} onClose={() => setOpenModal(null)} />
      </AdminCan>

      <Table
        columns={[...nodeTableColumns(), '']}
        loading={loading}
        pagination={mountNodes}
        onPageSelect={setPage}
        error={error}
      >
        {mountNodes?.data.map((nodeMount) => (
          <MountNodeRow key={nodeMount.node.uuid} node={nodeMount.node} mount={mount} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
