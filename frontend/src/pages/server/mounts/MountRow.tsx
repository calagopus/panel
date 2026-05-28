import { faCheck, faMinus, faPlus, faX } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group } from '@mantine/core';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import attachMount from '@/api/server/mounts/attachMount.ts';
import detachMount from '@/api/server/mounts/detachMount.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Code from '@/elements/Code.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { serverMountSchema } from '@/lib/schemas/server/mounts.ts';
import { useToast } from '@/providers/contexts/toastContext.ts';
import { useTranslations } from '@/providers/contexts/translationContext.ts';
import { useServerStore } from '@/stores/server.ts';

export const MountRow = ({ contextMount }: { contextMount: z.infer<typeof serverMountSchema> }) => {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);

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
        contextMount.created = new Date();
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
        contextMount.created = null;
        setOpenModal(null);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <>
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

      <TableRow>
        <TableData>{contextMount.name}</TableData>

        <TableData>{contextMount.description}</TableData>

        <TableData>
          <Code>{contextMount.target}</Code>
        </TableData>

        <TableData>
          {contextMount.created ? (
            <FontAwesomeIcon icon={faCheck} className='text-green-500' />
          ) : (
            <FontAwesomeIcon icon={faX} className='text-red-500' />
          )}
        </TableData>

        <TableData>
          {contextMount.readOnly ? (
            <FontAwesomeIcon icon={faCheck} className='text-green-500' />
          ) : (
            <FontAwesomeIcon icon={faX} className='text-red-500' />
          )}
        </TableData>

        <TableData>
          <Group gap={4} justify='right' wrap='nowrap'>
            <Tooltip
              label={
                contextMount.created
                  ? t('pages.server.mounts.button.detach', {})
                  : t('pages.server.mounts.button.attach', {})
              }
            >
              {contextMount.created ? (
                <ActionIcon color='red' onClick={() => setOpenModal('detach')}>
                  <FontAwesomeIcon icon={faMinus} />
                </ActionIcon>
              ) : (
                <ActionIcon color='green' onClick={() => setOpenModal('attach')}>
                  <FontAwesomeIcon icon={faPlus} />
                </ActionIcon>
              )}
            </Tooltip>
          </Group>
        </TableData>
      </TableRow>
    </>
  );
};
