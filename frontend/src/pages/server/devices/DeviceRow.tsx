import { faCheck, faMinus, faPlus, faX } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { forwardRef, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import attachDevice from '@/api/server/devices/attachDevice.ts';
import detachDevice from '@/api/server/devices/detachDevice.ts';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import { TableData, TableRow, TableSelectionCell } from '@/elements/data-display/Table.tsx';
import Group from '@/elements/layout/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import Code from '@/elements/typography/Code.tsx';
import { serverDeviceSchema } from '@/lib/schemas/server/devices.ts';
import { setDeviceAttached } from '@/pages/server/devices/deviceCache.ts';
import { useToast } from '@/providers/contexts/toastContext.ts';
import { useTranslations } from '@/providers/contexts/translationContext.ts';
import { useServerStore } from '@/stores/server.ts';

interface DeviceRowProps {
  contextDevice: z.infer<typeof serverDeviceSchema>;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean, range?: boolean) => void;
}

export const DeviceRow = forwardRef<HTMLTableRowElement, DeviceRowProps>(function DeviceRow(
  { contextDevice, isSelected = false, onSelectionChange },
  ref,
) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'attach' | 'detach' | null>(null);

  const doAttach = async () => {
    await attachDevice(server.uuid, contextDevice.uuid)
      .then(() => {
        addToast(
          t('pages.server.devices.modal.attachDevice.toast.attached', {
            name: contextDevice.name,
          }),
          'success',
        );
        setDeviceAttached(queryClient, server.uuid, contextDevice.uuid, true);
        setOpenModal(null);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const doDetach = async () => {
    await detachDevice(server.uuid, contextDevice.uuid)
      .then(() => {
        addToast(
          t('pages.server.devices.modal.detachDevice.toast.detached', {
            name: contextDevice.name,
          }),
          'success',
        );
        setDeviceAttached(queryClient, server.uuid, contextDevice.uuid, false);
        setOpenModal(null);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <>
      <ServerCan action='devices.attach'>
        <ConfirmationModal
          opened={openModal === 'attach'}
          onClose={() => setOpenModal(null)}
          title={t('pages.server.devices.modal.attachDevice.title', {})}
          confirm={t('pages.server.devices.button.attach', {})}
          confirmColor='green'
          onConfirmed={doAttach}
        >
          {t('pages.server.devices.modal.attachDevice.content', {
            name: contextDevice.name,
            target: contextDevice.target,
          }).md()}
        </ConfirmationModal>
      </ServerCan>

      <ServerCan action='devices.detach'>
        <ConfirmationModal
          opened={openModal === 'detach'}
          onClose={() => setOpenModal(null)}
          title={t('pages.server.devices.modal.detachDevice.title', {})}
          confirm={t('pages.server.devices.button.detach', {})}
          onConfirmed={doDetach}
        >
          {t('pages.server.devices.modal.detachDevice.content', {
            name: contextDevice.name,
            target: contextDevice.target,
          }).md()}
        </ConfirmationModal>
      </ServerCan>

      <TableRow ref={ref} bg={isSelected ? 'var(--mantine-color-blue-light)' : undefined}>
        {onSelectionChange !== undefined && (
          <TableSelectionCell id={contextDevice.uuid} checked={isSelected} onChange={onSelectionChange} />
        )}

        <TableData>{contextDevice.name}</TableData>

        <TableData>{contextDevice.description}</TableData>

        <TableData>
          <Code>{contextDevice.target}</Code>
        </TableData>

        <TableData>
          {contextDevice.created ? (
            <FontAwesomeIcon icon={faCheck} className='text-(--mantine-color-green-text)' />
          ) : (
            <FontAwesomeIcon icon={faX} className='text-(--mantine-color-red-text)' />
          )}
        </TableData>

        <TableData>
          <Code>{contextDevice.permissions}</Code>
        </TableData>

        <TableData>
          <Group gap={4} justify='right' wrap='nowrap'>
            {contextDevice.created ? (
              <ServerCan action='devices.detach'>
                <Tooltip label={t('pages.server.devices.button.detach', {})}>
                  <ActionIcon color='red' onClick={() => setOpenModal('detach')}>
                    <FontAwesomeIcon icon={faMinus} />
                  </ActionIcon>
                </Tooltip>
              </ServerCan>
            ) : (
              <ServerCan action='devices.attach'>
                <Tooltip label={t('pages.server.devices.button.attach', {})}>
                  <ActionIcon color='green' onClick={() => setOpenModal('attach')}>
                    <FontAwesomeIcon icon={faPlus} />
                  </ActionIcon>
                </Tooltip>
              </ServerCan>
            )}
          </Group>
        </TableData>
      </TableRow>
    </>
  );
});
