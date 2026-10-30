import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import deleteNodeDevice from '@/api/admin/nodes/devices/deleteNodeDevice.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import Group from '@/elements/layout/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { removePaginatedItems } from '@/lib/queryCache.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { AdminNode, AdminNodeDevice } from '@/lib/schemas/admin/nodes.ts';
import NodeAllowedSourceBadge from '@/pages/admin/nodes/NodeAllowedSourceBadge.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function NodeDeviceRow({ node, device }: { node: AdminNode; device: AdminNodeDevice }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'remove' | null>(null);

  const doRemove = async () => {
    await deleteNodeDevice(node.uuid, device.device.uuid)
      .then(() => {
        setOpenModal(null);
        removePaginatedItems(
          queryClient,
          queryKeys.admin.deviceAssignments.devicesByNode(node.uuid),
          (item: AdminNodeDevice) => item.device.uuid === device.device.uuid,
        );
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.deviceAssignments.all() });
        addToast(t('pages.admin.nodes.tabs.devices.page.toast.removed', {}), 'success');
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
        title={t('pages.admin.nodes.tabs.devices.page.modal.remove.title', {})}
        confirm={t('common.button.remove', {})}
        onConfirmed={doRemove}
      >
        {t('pages.admin.nodes.tabs.devices.page.modal.remove.content', {
          device: device.device.name,
          name: node.name,
        }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faTrash,
            label: t('common.button.remove', {}),
            onClick: () => setOpenModal('remove'),
            color: 'red',
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.admin.nodes.view.devices.contextMenu}
        registryProps={{ node, device }}
      >
        {({ items, openMenu }) => (
          <TableRow
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            <TableData>
              <TableLink to={`/admin/devices/${device.device.uuid}`}>
                <Code>{device.device.uuid}</Code>
              </TableLink>
            </TableData>
            <TableData>
              <Group gap='xs' wrap='nowrap'>
                {device.device.name}
                <NodeAllowedSourceBadge nodeUuid={node.uuid} kind='device' uuid={device.device.uuid} />
              </Group>
            </TableData>
            <TableData>
              <Code>{device.device.source}</Code>
            </TableData>
            <TableData>
              <Code>{device.device.target}</Code>
            </TableData>
            <TableData>
              <FormattedTimestamp timestamp={device.created} />
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}
