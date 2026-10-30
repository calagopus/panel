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
import { forwardRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import postDatabaseInstancePower, {
  DatabaseInstancePowerAction,
} from '@/api/server/databases/instances/postDatabaseInstancePower.ts';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import { TableData, TableRow, TableSelectionCell } from '@/elements/data-display/Table.tsx';
import Group from '@/elements/layout/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import Code from '@/elements/typography/Code.tsx';
import RedactedText from '@/elements/typography/RedactedText.tsx';
import { databaseAgentTypeLabelMapping } from '@/lib/enums.ts';
import { bytesToString, mbToBytes } from '@/lib/format/size.ts';
import { serverDatabaseInstanceSchema } from '@/lib/schemas/server/databaseInstances.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import DatabaseInstanceDeleteModal from './modals/DatabaseInstanceDeleteModal.tsx';

interface DatabaseInstanceRowProps {
  instance: z.infer<typeof serverDatabaseInstanceSchema>;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean, range?: boolean) => void;
  onClick?: (event: React.MouseEvent) => void;
}

const DatabaseInstanceRow = forwardRef<HTMLTableRowElement, DatabaseInstanceRowProps>(function DatabaseInstanceRow(
  { instance, isSelected = false, onSelectionChange, onClick },
  ref,
) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const server = useServerStore((state) => state.server);
  const [openModal, setOpenModal] = useState<'delete' | 'kill' | null>(null);
  const host = instance.host ? `${instance.host}${instance.port ? `:${instance.port}` : ''}` : null;

  const onPowerAction = (action: DatabaseInstancePowerAction) =>
    postDatabaseInstancePower(server.uuid, instance.uuid, action)
      .then(() => {
        setOpenModal(null);
        addToast(t(`pages.server.databases.instance.power.toast.${action}`, {}), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });

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
            ref={ref}
            className='cursor-pointer'
            bg={isSelected ? 'var(--mantine-color-blue-light)' : undefined}
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
            onClick={(e) => {
              onClick?.(e);
              if (!e.defaultPrevented) navigate(`/server/${server.uuidShort}/databases/instances/${instance.uuid}`);
            }}
          >
            {onSelectionChange !== undefined && (
              <TableSelectionCell id={instance.uuid} checked={isSelected} onChange={onSelectionChange} />
            )}

            <TableData>{instance.name}</TableData>

            <TableData>{databaseAgentTypeLabelMapping[instance.type]}</TableData>

            <TableData>
              {host ? (
                <CopyOnClick content={host}>
                  <Code>
                    <RedactedText value={host} />
                  </Code>
                </CopyOnClick>
              ) : null}
            </TableData>

            <TableData>{bytesToString(mbToBytes(instance.memory))}</TableData>

            <TableData>{bytesToString(mbToBytes(instance.disk))}</TableData>

            <TableData>
              <Group gap='xs' wrap='nowrap'>
                {instance.isLocked ? (
                  <FontAwesomeIcon className='text-(--mantine-color-green-text)' icon={faLock} />
                ) : (
                  <FontAwesomeIcon className='text-(--mantine-color-red-text)' icon={faLockOpen} />
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
});

export default DatabaseInstanceRow;
