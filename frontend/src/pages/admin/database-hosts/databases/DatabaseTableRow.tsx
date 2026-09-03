import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { ReactNode, useState } from 'react';
import { ContextMenuRegistry } from 'shared/src/registries/slices/contextMenu';
import { z } from 'zod';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { databaseTypeLabelMapping } from '@/lib/enums.ts';
import { bytesToString } from '@/lib/format/size.ts';
import { adminServerDatabaseBaseSchema } from '@/lib/schemas/admin/servers.ts';
import { useDatabaseSize } from '@/plugins/useDatabaseSize.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import DatabaseHostDatabaseDeleteModal from './modals/DatabaseHostDatabaseDeleteModal.tsx';

type Props<P> = {
  database: z.infer<typeof adminServerDatabaseBaseSchema>;
  serverUuid: string;
  hostUuid: string;
  linkColumn: ReactNode;
} & ({ registry: ContextMenuRegistry<P>; registryProps: P } | { registry?: never; registryProps?: never });

export default function DatabaseTableRow<P>({ database, serverUuid, hostUuid, linkColumn, ...contextMenu }: Props<P>) {
  const { t } = useTranslations();
  const [openModal, setOpenModal] = useState<'delete' | null>(null);
  const { size, loading: sizeLoading } = useDatabaseSize(serverUuid, database.uuid);
  const canDelete = useAdminCan('database-hosts.delete');
  const host = `${database.host}:${database.port}`;

  return (
    <>
      <DatabaseHostDatabaseDeleteModal
        hostUuid={hostUuid}
        serverUuid={serverUuid}
        database={database}
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
      />

      <ContextMenu<P>
        items={[
          {
            type: 'action',
            icon: faTrash,
            label: t('common.button.delete', {}),
            onClick: () => setOpenModal('delete'),
            color: 'red',
            canAccess: canDelete,
          },
        ]}
        {...contextMenu}
      >
        {({ items, openMenu }) => (
          <TableRow
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            <TableData>{database.name}</TableData>

            <TableData>{linkColumn}</TableData>

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
