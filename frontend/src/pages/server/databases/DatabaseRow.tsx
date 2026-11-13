import {
  faEye,
  faLock,
  faLockOpen,
  faPencil,
  faRefresh,
  faTableList,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { forwardRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import getDatabaseHostSizes from '@/api/server/databases/getDatabaseHostSizes.ts';
import updateDatabase from '@/api/server/databases/updateDatabase.ts';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import { TableData, TableRow, TableSelectionCell } from '@/elements/data-display/Table.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import Code from '@/elements/typography/Code.tsx';
import RedactedText from '@/elements/typography/RedactedText.tsx';
import { databaseTypeLabelMapping } from '@/lib/enums.ts';
import { bytesToString } from '@/lib/format/size.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverDatabaseSchema } from '@/lib/schemas/server/databases.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import DatabaseDeleteModal from './modals/DatabaseDeleteModal.tsx';
import DatabaseDetailsModal from './modals/DatabaseDetailsModal.tsx';
import DatabaseEditModal from './modals/DatabaseEditModal.tsx';
import DatabaseRecreateModal from './modals/DatabaseRecreateModal.tsx';

interface DatabaseRowProps {
  database: z.infer<typeof serverDatabaseSchema>;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean, range?: boolean) => void;
}

const DatabaseRow = forwardRef<HTMLTableRowElement, DatabaseRowProps>(function DatabaseRow(
  { database, isSelected = false, onSelectionChange },
  ref,
) {
  const { t } = useTranslations();
  const navigate = useNavigate();
  const [openModal, setOpenModal] = useState<'edit' | 'details' | 'recreate' | 'delete' | null>(null);
  const server = useServerStore((state) => state.server);
  const host = `${database.host}:${database.port}`;
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const lockedTooltip = database.isLocked ? t('pages.server.databases.tooltip.locked', {}) : undefined;

  const doSetLocked = (locked: boolean) =>
    updateDatabase(server.uuid, database.uuid, { locked })
      .then(() => {
        addToast(
          locked ? t('pages.server.databases.toast.locked', {}) : t('pages.server.databases.toast.unlocked', {}),
          'success',
        );
        queryClient.invalidateQueries({ queryKey: queryKeys.server(server.uuid).databases.all() });
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'));

  const {
    data: sizes,
    loading: sizesLoading,
    refetch: refetchSizes,
  } = useResource({
    queryKey: queryKeys.server(server.uuid).databases.hostSizes(database.databaseHostUuid),
    queryFn: () => getDatabaseHostSizes(server.uuid, database.databaseHostUuid),
    silent: true,
  });

  return (
    <>
      <DatabaseEditModal database={database} opened={openModal === 'edit'} onClose={() => setOpenModal(null)} />
      <DatabaseDetailsModal database={database} opened={openModal === 'details'} onClose={() => setOpenModal(null)} />
      <DatabaseRecreateModal
        database={database}
        opened={openModal === 'recreate'}
        onClose={() => setOpenModal(null)}
        onRecreated={refetchSizes}
      />
      <DatabaseDeleteModal database={database} opened={openModal === 'delete'} onClose={() => setOpenModal(null)} />

      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faPencil,
            label: t('common.button.edit', {}),
            onClick: () => setOpenModal('edit'),
            color: 'gray',
            canAccess: useServerCan('databases.update'),
          },
          {
            type: 'action',
            icon: database.isLocked ? faLockOpen : faLock,
            label: database.isLocked
              ? t('pages.server.databases.button.unlock', {})
              : t('pages.server.databases.button.lock', {}),
            onClick: () => doSetLocked(!database.isLocked),
            color: 'gray',
            canAccess: useServerCan('databases.update'),
          },
          {
            type: 'action',
            icon: faEye,
            label: t('common.button.details', {}),
            onClick: () => setOpenModal('details'),
            color: 'gray',
            canAccess: useServerCan('databases.read'),
          },
          {
            type: 'action',
            icon: faTableList,
            label: t('pages.server.databases.explorer.button.open', {}),
            hidden: database.type === 'mongodb',
            onClick: () => navigate(`/server/${server.uuidShort}/databases/${database.uuid}/explore`),
            color: 'gray',
            canAccess: useServerCan(['databases.read', 'databases.query'], false),
          },
          {
            type: 'action',
            icon: faRefresh,
            label: t('common.button.recreate', {}),
            disabled: database.isLocked,
            tooltip: lockedTooltip,
            onClick: () => setOpenModal('recreate'),
            color: 'red',
            canAccess: useServerCan('databases.recreate'),
          },
          {
            type: 'action',
            icon: faTrash,
            label: t('common.button.delete', {}),
            disabled: database.isLocked,
            tooltip: lockedTooltip,
            onClick: () => setOpenModal('delete'),
            color: 'red',
            canAccess: useServerCan('databases.delete'),
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.server.databases.databaseContextMenu}
        registryProps={{ database }}
      >
        {({ items, openMenu }) => (
          <TableRow
            ref={ref}
            bg={isSelected ? 'var(--mantine-color-blue-light)' : undefined}
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            {onSelectionChange !== undefined && (
              <TableSelectionCell id={database.uuid} checked={isSelected} onChange={onSelectionChange} />
            )}

            <TableData>{database.name}</TableData>

            <TableData>{databaseTypeLabelMapping[database.type]}</TableData>

            <TableData>
              <CopyOnClick content={host}>
                <Code>
                  <RedactedText value={host} />
                </Code>
              </CopyOnClick>
            </TableData>

            <TableData>{database.username}</TableData>

            <TableData>
              {sizesLoading && sizes === undefined ? (
                <Spinner size={16} />
              ) : (
                sizes?.[database.uuid] !== undefined && bytesToString(sizes[database.uuid])
              )}
            </TableData>

            <TableData>
              {database.isLocked ? (
                <FontAwesomeIcon className='text-(--mantine-color-green-text)' icon={faLock} />
              ) : (
                <FontAwesomeIcon className='text-(--mantine-color-red-text)' icon={faLockOpen} />
              )}
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
});

export default DatabaseRow;
