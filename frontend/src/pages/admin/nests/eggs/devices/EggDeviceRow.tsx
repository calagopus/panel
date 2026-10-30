import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import deleteEggDevice from '@/api/admin/nests/eggs/devices/deleteEggDevice.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { removePaginatedItems } from '@/lib/queryCache.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { adminNodeDeviceSchema } from '@/lib/schemas/admin/nodes.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function EggDeviceRow({
  nest,
  egg,
  device,
}: {
  nest: z.infer<typeof adminNestSchema>;
  egg: z.infer<typeof adminEggSchema>;
  device: z.infer<typeof adminNodeDeviceSchema>;
}) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslations();

  const [openModal, setOpenModal] = useState<'remove' | null>(null);

  const doRemove = async () => {
    await deleteEggDevice(nest.uuid, egg.uuid, device.device.uuid)
      .then(() => {
        setOpenModal(null);
        removePaginatedItems(
          queryClient,
          queryKeys.admin.deviceAssignments.devicesByEgg(egg.uuid),
          (item: z.infer<typeof adminNodeDeviceSchema>) => item.device.uuid === device.device.uuid,
        );
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.deviceAssignments.devicesByEgg(egg.uuid) });
        addToast(t('pages.admin.nests.tabs.eggs.page.tabs.devices.page.toast.deleted', {}), 'success');
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
        title={t('pages.admin.nests.tabs.eggs.page.tabs.devices.page.modal.delete.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doRemove}
      >
        {t('pages.admin.nests.tabs.eggs.page.tabs.devices.page.modal.delete.content', {
          device: device.device.name,
          egg: egg.name,
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
            <TableData>{device.device.name}</TableData>
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
