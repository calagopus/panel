import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import deleteLocationDatabaseHost from '@/api/admin/locations/database-hosts/deleteLocationDatabaseHost.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import TableLink from '@/elements/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { databaseTypeLabelMapping } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminLocationDatabaseHostSchema, adminLocationSchema } from '@/lib/schemas/admin/locations.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function LocationDatabaseHostRow({
  location,
  databaseHost,
}: {
  location: z.infer<typeof adminLocationSchema>;
  databaseHost: z.infer<typeof adminLocationDatabaseHostSchema>;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const doDelete = async () => {
    await deleteLocationDatabaseHost(location.uuid, databaseHost.databaseHost.uuid)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.locations.databaseHosts(location.uuid) });
        addToast(t('pages.admin.locations.tabs.databaseHosts.page.toast.deleted', {}), 'success');
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
        title={t('pages.admin.locations.tabs.databaseHosts.page.modal.delete.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.admin.locations.tabs.databaseHosts.page.modal.delete.content', {
          name: databaseHost.databaseHost.name,
          location: location.name,
        }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faTrash,
            label: t('common.button.remove', {}),
            onClick: () => setOpenModal('delete'),
            color: 'red',
          },
        ]}
      >
        {({ items, openMenu }) => (
          <TableRow
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            <TableData>
              <TableLink to={`/admin/database-hosts/${databaseHost.databaseHost.uuid}`}>
                <Code>{databaseHost.databaseHost.uuid}</Code>
              </TableLink>
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
