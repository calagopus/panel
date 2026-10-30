import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import getDeviceNodes from '@/api/admin/devices/nodes/getDeviceNodes.ts';
import deleteNodeDevice from '@/api/admin/nodes/devices/deleteNodeDevice.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ContextMenu from '@/elements/overlays/ContextMenu.tsx';
import { removePaginatedItems } from '@/lib/queryCache.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDeviceSchema } from '@/lib/schemas/admin/devices.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { nodeTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import NodeAllowedSourceBadge from '../../nodes/NodeAllowedSourceBadge.tsx';
import NodeRow from '../../nodes/NodeRow.tsx';
import DeviceAddNodeModal from './modals/DeviceAddNodeModal.tsx';

function DeviceNodeRow({
  node,
  device,
}: {
  node: z.infer<typeof adminNodeSchema>;
  device: z.infer<typeof adminDeviceSchema>;
}) {
  const { addToast } = useToast();
  const { t } = useTranslations();
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'remove' | null>(null);

  const doRemove = async () => {
    await deleteNodeDevice(node.uuid, device.uuid)
      .then(() => {
        setOpenModal(null);
        addToast(t('pages.admin.devices.tabs.nodes.page.toast.removed', {}), 'success');
        removePaginatedItems(
          queryClient,
          queryKeys.admin.deviceAssignments.nodesByDevice(device.uuid),
          (item: { node: { uuid: string } }) => item.node.uuid === node.uuid,
        );
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.deviceAssignments.all() });
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
        title={t('pages.admin.devices.tabs.nodes.page.modal.remove.title', {})}
        confirm={t('common.button.remove', {})}
        onConfirmed={doRemove}
      >
        {t('pages.admin.devices.tabs.nodes.page.modal.remove.content', { device: device.name, name: node.name }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faTrash,
            label: t('common.button.remove', {}),
            onClick: () => setOpenModal('remove'),
            color: 'red',
            canAccess: useAdminCan('nodes.devices'),
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.admin.devices.view.nodes.contextMenu}
        registryProps={{ device, node }}
      >
        {(props) => (
          <NodeRow
            node={node}
            contextMenuProps={props}
            nameSection={<NodeAllowedSourceBadge nodeUuid={node.uuid} kind='device' uuid={device.uuid} />}
          />
        )}
      </ContextMenu>
    </>
  );
}

export default function AdminDeviceNodes({ device }: { device: z.infer<typeof adminDeviceSchema> }) {
  const { t } = useTranslations();
  const [openModal, setOpenModal] = useState<'add' | null>(null);

  const {
    data: deviceNodes,
    loading,
    error,
    search,
    setSearch,
    setPage,
    setPerPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.deviceAssignments.nodesByDevice(device.uuid),
    fetcher: (page, search, perPage) => getDeviceNodes(device.uuid, page, search, perPage),
    backgroundRefetch: true,
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.devices.tabs.nodes.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      registry={window.extensionContext.extensionRegistry.pages.admin.devices.view.nodes.subContainer}
      registryProps={{ device }}
      contentRight={
        <AdminCan action='nodes.devices'>
          <Button onClick={() => setOpenModal('add')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
            {t('common.button.add', {})}
          </Button>
        </AdminCan>
      }
    >
      <AdminCan action='nodes.devices'>
        <DeviceAddNodeModal device={device} opened={openModal === 'add'} onClose={() => setOpenModal(null)} />
      </AdminCan>

      <Table
        columns={[...nodeTableColumns(), '']}
        loading={loading}
        pagination={deviceNodes}
        onPageSelect={setPage}
        onPerPageSelect={setPerPage}
        error={error}
      >
        {deviceNodes?.data.map((nodeDevice) => (
          <DeviceNodeRow key={nodeDevice.node.uuid} node={nodeDevice.node} device={device} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
