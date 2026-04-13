import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import { NavLink } from 'react-router';
import { z } from 'zod';
import deleteLocationDatabaseHost from '@/api/admin/locations/database-hosts/deleteLocationDatabaseHost.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { databaseTypeLabelMapping } from '@/lib/enums.ts';
import { adminLocationDatabaseHostSchema, adminLocationSchema } from '@/lib/schemas/admin/locations.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';

export default function LocationDatabaseHostRow({
  location,
  databaseHost,
}: {
  location: z.infer<typeof adminLocationSchema>;
  databaseHost: z.infer<typeof adminLocationDatabaseHostSchema>;
}) {
  const { addToast } = useToast();
  const { removeLocationDatabaseHost } = useAdminStore();

  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const doDelete = async () => {
    await deleteLocationDatabaseHost(location.uuid, databaseHost.databaseHost.uuid)
      .then(() => {
        removeLocationDatabaseHost(databaseHost);
        addToast('Location Database Host deleted.', 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <>
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title='Confirm Location Database Host Deletion'
        confirm='Delete'
        onConfirmed={doDelete}
      >
        Are you sure you want to delete the database host
        <Code>{databaseHost.databaseHost.name}</Code>
        from <Code>{location.name}</Code>?
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            icon: faTrash,
            label: 'Remove',
            onClick: () => setOpenModal('delete'),
            color: 'red',
          },
        ]}
      >
        {({ items, openMenu }) => (
          <TableRow
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.pageX, e.pageY);
            }}
          >
            <TableData>
              <NavLink
                to={`/admin/database-hosts/${databaseHost.databaseHost.uuid}`}
                className='text-blue-400 hover:text-blue-200 hover:underline'
              >
                <Code>{databaseHost.databaseHost.uuid}</Code>
              </NavLink>
            </TableData>
            <TableData>{databaseHost.databaseHost.name}</TableData>
            <TableData>{databaseTypeLabelMapping[databaseHost.databaseHost.type]}</TableData>

            <TableData>
              <FormattedTimestamp timestamp={databaseHost.created} />
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}
