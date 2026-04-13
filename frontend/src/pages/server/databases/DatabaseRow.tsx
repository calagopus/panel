import { faEye, faLock, faLockOpen, faPencil, faRefresh, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import getDatabaseSize from '@/api/server/databases/getDatabaseSize.ts';
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import { databaseTypeLabelMapping } from '@/lib/enums.ts';
import { serverDatabaseSchema } from '@/lib/schemas/server/databases.ts';
import { bytesToString } from '@/lib/size.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import DatabaseDeleteModal from './modals/DatabaseDeleteModal.tsx';
import DatabaseDetailsModal from './modals/DatabaseDetailsModal.tsx';
import DatabaseEditModal from './modals/DatabaseEditModal.tsx';
import DatabaseRecreateModal from './modals/DatabaseRecreateModal.tsx';

export default function DatabaseRow({ database }: { database: z.infer<typeof serverDatabaseSchema> }) {
  const { t } = useTranslations();
  const [openModal, setOpenModal] = useState<'edit' | 'details' | 'recreate' | 'delete' | null>(null);
  const [size, setSize] = useState(0);
  const [sizeLoading, setSizeLoading] = useState(true);
  const server = useServerStore((state) => state.server);
  const host = `${database.host}:${database.port}`;

  useEffect(() => {
    if (!sizeLoading) return;

    getDatabaseSize(server.uuid, database.uuid)
      .then(setSize)
      .finally(() => setSizeLoading(false));
  }, [sizeLoading]);

  return (
    <>
      <DatabaseEditModal database={database} opened={openModal === 'edit'} onClose={() => setOpenModal(null)} />
      <DatabaseDetailsModal database={database} opened={openModal === 'details'} onClose={() => setOpenModal(null)} />
      <DatabaseRecreateModal
        database={database}
        opened={openModal === 'recreate'}
        onClose={() => setOpenModal(null)}
        setSizeLoading={setSizeLoading}
      />
      <DatabaseDeleteModal database={database} opened={openModal === 'delete'} onClose={() => setOpenModal(null)} />

      <ContextMenu
        items={[
          {
            icon: faPencil,
            label: t('common.button.edit', {}),
            onClick: () => setOpenModal('edit'),
            color: 'gray',
            canAccess: useServerCan('databases.update'),
          },
          {
            icon: faEye,
            label: t('pages.server.databases.button.details', {}),
            onClick: () => setOpenModal('details'),
            color: 'gray',
            canAccess: useServerCan('databases.read'),
          },
          {
            icon: faRefresh,
            label: t('common.button.recreate', {}),
            disabled: database.isLocked,
            onClick: () => setOpenModal('recreate'),
            color: 'red',
            canAccess: useServerCan('databases.recreate'),
          },
          {
            icon: faTrash,
            label: t('common.button.delete', {}),
            disabled: database.isLocked,
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
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.pageX, e.pageY);
            }}
          >
            <TableData>{database.name}</TableData>

            <TableData>{databaseTypeLabelMapping[database.type]}</TableData>

            <TableData>
              <CopyOnClick content={host}>
                <Code>{host}</Code>
              </CopyOnClick>
            </TableData>

            <TableData>{database.username}</TableData>

            <TableData>{sizeLoading ? <Spinner size={16} /> : bytesToString(size)}</TableData>

            <TableData>
              {database.isLocked ? (
                <FontAwesomeIcon className='text-green-500' icon={faLock} />
              ) : (
                <FontAwesomeIcon className='text-red-500' icon={faLockOpen} />
              )}
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}
