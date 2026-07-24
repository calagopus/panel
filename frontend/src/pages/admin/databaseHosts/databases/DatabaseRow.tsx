import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import getDatabaseSize from '@/api/server/databases/getDatabaseSize.ts';
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import TableLink from '@/elements/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { databaseTypeLabelMapping } from '@/lib/enums.ts';
import { adminDatabaseHostSchema } from '@/lib/schemas/admin/databaseHosts.ts';
import { adminServerDatabaseSchema } from '@/lib/schemas/admin/servers.ts';
import { bytesToString } from '@/lib/size.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import DatabaseHostDatabaseDeleteModal from './modals/DatabaseHostDatabaseDeleteModal.tsx';

export default function DatabaseRow({
  databaseHost,
  database,
}: {
  databaseHost: z.infer<typeof adminDatabaseHostSchema>;
  database: z.infer<typeof adminServerDatabaseSchema>;
}) {
  const { t } = useTranslations();
  const [openModal, setOpenModal] = useState<'delete' | null>(null);
  const [size, setSize] = useState(0);
  const [sizeLoading, setSizeLoading] = useState(true);
  const host = `${database.host}:${database.port}`;

  useEffect(() => {
    getDatabaseSize(database.server.uuid, database.uuid)
      .then(setSize)
      .finally(() => setSizeLoading(false));
  }, []);

  return (
    <>
      <DatabaseHostDatabaseDeleteModal
        hostUuid={databaseHost.uuid}
        serverUuid={database.server.uuid}
        database={database}
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
      />

      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faTrash,
            label: t('common.button.delete', {}),
            onClick: () => setOpenModal('delete'),
            color: 'red',
            canAccess: useAdminCan('database-hosts.delete'),
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.admin.databaseHosts.view.databases.contextMenu}
        registryProps={{ databaseHost, database }}
      >
        {({ items, openMenu }) => (
          <TableRow
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            <TableData>{database.name}</TableData>

            <TableData>
              <TableLink to={`/admin/servers/${database.server.uuid}`}>
                <Code>{database.server.name}</Code>
              </TableLink>
            </TableData>

            <TableData>{databaseTypeLabelMapping[database.type]}</TableData>

            <TableData>
              <CopyOnClick content={host}>
                <Code>{host}</Code>
              </CopyOnClick>
            </TableData>

            <TableData>{database.username}</TableData>

            <TableData>{sizeLoading ? <Spinner size={16} /> : bytesToString(size)}</TableData>

            <TableData>
              <FormattedTimestamp timestamp={database.created} />
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}
