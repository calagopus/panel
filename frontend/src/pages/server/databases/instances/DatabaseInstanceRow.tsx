import {
  faArrowsRotate,
  faLock,
  faLockOpen,
  faPlay,
  faSkull,
  faStop,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import postDatabaseInstancePower, {
  DatabaseInstancePowerAction,
} from '@/api/server/databases/instances/postDatabaseInstancePower.ts';
import Badge from '@/elements/Badge.tsx';
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import Group from '@/elements/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import { databaseAgentTypeLabelMapping } from '@/lib/enums.ts';
import { serverDatabaseInstanceSchema } from '@/lib/schemas/server/databaseInstances.ts';
import { bytesToString, mbToBytes } from '@/lib/size.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import DatabaseInstanceDeleteModal from './modals/DatabaseInstanceDeleteModal.tsx';

export default function DatabaseInstanceRow({ instance }: { instance: z.infer<typeof serverDatabaseInstanceSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const server = useServerStore((state) => state.server);
  const [openModal, setOpenModal] = useState<'delete' | 'kill' | null>(null);
  const host = instance.host ? `${instance.host}${instance.port ? `:${instance.port}` : ''}` : null;

  const onPowerAction = (action: DatabaseInstancePowerAction) => {
    setOpenModal(null);

    postDatabaseInstancePower(server.uuid, instance.uuid, action)
      .then(() => addToast(t(`pages.server.databases.instance.power.toast.${action}`, {}), 'success'))
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'));
  };

  return (
    <>
      <ConfirmationModal
        opened={openModal === 'kill'}
        onClose={() => setOpenModal(null)}
        title={t('pages.server.databases.instance.power.modal.forceKill.title', {})}
        confirm={t('common.button.continue', {})}
        onConfirmed={() => onPowerAction('kill')}
      >
        {t('pages.server.databases.instance.power.modal.forceKill.content', {}).md()}
      </ConfirmationModal>
      <DatabaseInstanceDeleteModal
        instance={instance}
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
      />

      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faPlay,
            label: t('common.enum.serverPowerAction.start', {}),
            onClick: () => onPowerAction('start'),
            color: 'gray',
            canAccess: useServerCan('database-instances.power'),
          },
          {
            type: 'action',
            icon: faArrowsRotate,
            label: t('common.enum.serverPowerAction.restart', {}),
            onClick: () => onPowerAction('restart'),
            color: 'gray',
            canAccess: useServerCan('database-instances.power'),
          },
          {
            type: 'action',
            icon: faStop,
            label: t('common.enum.serverPowerAction.stop', {}),
            onClick: () => onPowerAction('stop'),
            color: 'gray',
            canAccess: useServerCan('database-instances.power'),
          },
          {
            type: 'action',
            icon: faSkull,
            label: t('common.enum.serverPowerAction.kill', {}),
            onClick: () => setOpenModal('kill'),
            color: 'red',
            canAccess: useServerCan('database-instances.power'),
          },
          {
            type: 'divider',
            canAccess: useServerCan('database-instances.delete'),
          },
          {
            type: 'action',
            icon: faTrash,
            label: t('common.button.delete', {}),
            disabled: instance.isLocked,
            onClick: () => setOpenModal('delete'),
            color: 'red',
            canAccess: useServerCan('database-instances.delete'),
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.server.databases.databaseInstanceContextMenu}
        registryProps={{ instance }}
      >
        {({ items, openMenu }) => (
          <TableRow
            className='cursor-pointer'
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
            onClick={() => navigate(`/server/${server.uuidShort}/databases/instances/${instance.uuid}`)}
          >
            <TableData>{instance.name}</TableData>

            <TableData>{databaseAgentTypeLabelMapping[instance.type]}</TableData>

            <TableData>
              {host ? (
                <CopyOnClick content={host}>
                  <Code>{host}</Code>
                </CopyOnClick>
              ) : null}
            </TableData>

            <TableData>{bytesToString(mbToBytes(instance.memory))}</TableData>

            <TableData>{bytesToString(mbToBytes(instance.disk))}</TableData>

            <TableData>
              <Group gap='xs' wrap='nowrap'>
                {instance.isLocked ? (
                  <FontAwesomeIcon className='text-green-500' icon={faLock} />
                ) : (
                  <FontAwesomeIcon className='text-red-500' icon={faLockOpen} />
                )}
                {instance.updateAvailable && (
                  <Badge color='yellow'>{t('pages.server.databases.instance.updateAvailable', {})}</Badge>
                )}
              </Group>
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}
