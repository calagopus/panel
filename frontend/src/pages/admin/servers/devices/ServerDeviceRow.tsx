import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import deleteServerDevice from '@/api/admin/servers/devices/deleteServerDevice.ts';
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
import { AdminServer, AdminServerDevice } from '@/lib/schemas/admin/servers.ts';
import NodeAllowedSourceBadge from '@/pages/admin/nodes/NodeAllowedSourceBadge.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function ServerDeviceRow({ server, device }: { server: AdminServer; device: AdminServerDevice }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const doDelete = async () => {
    await deleteServerDevice(server.uuid, device.device.uuid)
      .then(() => {
        setOpenModal(null);
        removePaginatedItems(
          queryClient,
          queryKeys.admin.deviceAssignments.devicesByServer(server.uuid),
          (item: AdminServerDevice) => item.device.uuid === device.device.uuid,
        );
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.deviceAssignments.all() });
        addToast(t('pages.admin.servers.tabs.devices.page.toast.deleted', {}), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <>
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.servers.tabs.devices.page.modal.remove.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.admin.servers.tabs.devices.page.modal.remove.content', {
          device: device.device.name,
          name: server.name,
        }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faTrash,
            label: t('common.button.remove', {}),
            onClick: () => setOpenModal('delete'),
            color: 'red',
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.admin.servers.view.devices.contextMenu}
        registryProps={{ server, device }}
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
                <NodeAllowedSourceBadge nodeUuid={server.node.uuid} kind='device' uuid={device.device.uuid} />
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
