import { faCheck, faMinus, faPlus, faX } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { forwardRef, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import attachMount from '@/api/server/mounts/attachMount.ts';
import detachMount from '@/api/server/mounts/detachMount.ts';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import { TableData, TableRow, TableSelectionCell } from '@/elements/data-display/Table.tsx';
import Group from '@/elements/layout/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import Code from '@/elements/typography/Code.tsx';
import { serverMountSchema } from '@/lib/schemas/server/mounts.ts';
import { setMountAttached } from '@/pages/server/mounts/mountCache.ts';
import { useToast } from '@/providers/contexts/toastContext.ts';
import { useTranslations } from '@/providers/contexts/translationContext.ts';
import { useServerStore } from '@/stores/server.ts';

interface MountRowProps {
  contextMount: z.infer<typeof serverMountSchema>;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean, range?: boolean) => void;
}

export const MountRow = forwardRef<HTMLTableRowElement, MountRowProps>(function MountRow(
  { contextMount, isSelected = false, onSelectionChange },
  ref,
) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'attach' | 'detach' | null>(null);

  const doAttach = async () => {
    await attachMount(server.uuid, contextMount.uuid)
      .then(() => {
        addToast(
          t('pages.server.mounts.modal.attachMount.toast.attached', {
            name: contextMount.name,
          }),
          'success',
        );
        setMountAttached(queryClient, server.uuid, contextMount.uuid, true);
        setOpenModal(null);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const doDetach = async () => {
    await detachMount(server.uuid, contextMount.uuid)
      .then(() => {
        addToast(
          t('pages.server.mounts.modal.detachMount.toast.detached', {
            name: contextMount.name,
          }),
          'success',
        );
        setMountAttached(queryClient, server.uuid, contextMount.uuid, false);
        setOpenModal(null);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <>
      <ServerCan action='mounts.attach'>
        <ConfirmationModal
          opened={openModal === 'attach'}
          onClose={() => setOpenModal(null)}
          title={t('pages.server.mounts.modal.attachMount.title', {})}
          confirm={t('pages.server.mounts.button.attach', {})}
          confirmColor='green'
          onConfirmed={doAttach}
        >
          {t('pages.server.mounts.modal.attachMount.content', {
            name: contextMount.name,
            target: contextMount.target,
          }).md()}
        </ConfirmationModal>
      </ServerCan>

      <ServerCan action='mounts.detach'>
        <ConfirmationModal
          opened={openModal === 'detach'}
          onClose={() => setOpenModal(null)}
          title={t('pages.server.mounts.modal.detachMount.title', {})}
          confirm={t('pages.server.mounts.button.detach', {})}
          onConfirmed={doDetach}
        >
          {t('pages.server.mounts.modal.detachMount.content', {
            name: contextMount.name,
            target: contextMount.target,
          }).md()}
        </ConfirmationModal>
      </ServerCan>

      <TableRow ref={ref} bg={isSelected ? 'var(--mantine-color-blue-light)' : undefined}>
        {onSelectionChange !== undefined && (
          <TableSelectionCell id={contextMount.uuid} checked={isSelected} onChange={onSelectionChange} />
        )}

        <TableData>{contextMount.name}</TableData>

        <TableData>{contextMount.description}</TableData>

        <TableData>
          <Code>{contextMount.target}</Code>
        </TableData>

        <TableData>
          {contextMount.created ? (
            <FontAwesomeIcon icon={faCheck} className='text-(--mantine-color-green-text)' />
          ) : (
            <FontAwesomeIcon icon={faX} className='text-(--mantine-color-red-text)' />
          )}
        </TableData>

        <TableData>
          {contextMount.readOnly ? (
            <FontAwesomeIcon icon={faCheck} className='text-(--mantine-color-green-text)' />
          ) : (
            <FontAwesomeIcon icon={faX} className='text-(--mantine-color-red-text)' />
          )}
        </TableData>

        <TableData>
          <Group gap={4} justify='right' wrap='nowrap'>
            {contextMount.created ? (
              <ServerCan action='mounts.detach'>
                <Tooltip label={t('pages.server.mounts.button.detach', {})}>
                  <ActionIcon color='red' onClick={() => setOpenModal('detach')}>
                    <FontAwesomeIcon icon={faMinus} />
                  </ActionIcon>
                </Tooltip>
              </ServerCan>
            ) : (
              <ServerCan action='mounts.attach'>
                <Tooltip label={t('pages.server.mounts.button.attach', {})}>
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
