import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import deleteLocationDatabaseAgentHost from '@/api/admin/locations/database-agent-hosts/deleteLocationDatabaseAgentHost.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import TableLink from '@/elements/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminLocationDatabaseAgentHostSchema, adminLocationSchema } from '@/lib/schemas/admin/locations.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function LocationDatabaseAgentHostRow({
  location,
  databaseAgentHost,
}: {
  location: z.infer<typeof adminLocationSchema>;
  databaseAgentHost: z.infer<typeof adminLocationDatabaseAgentHostSchema>;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const doDelete = async () => {
    await deleteLocationDatabaseAgentHost(location.uuid, databaseAgentHost.databaseAgentHost.uuid)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.locations.databaseAgentHosts(location.uuid) });
        addToast(t('pages.admin.locations.tabs.databaseAgentHosts.page.toast.deleted', {}), 'success');
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
        title={t('pages.admin.locations.tabs.databaseAgentHosts.page.modal.delete.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.admin.locations.tabs.databaseAgentHosts.page.modal.delete.content', {
          name: databaseAgentHost.databaseAgentHost.name,
          location: location.name,
        }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
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
              <TableLink to={`/admin/database-agent-hosts/${databaseAgentHost.databaseAgentHost.uuid}`}>
                <Code>{databaseAgentHost.databaseAgentHost.uuid}</Code>
              </TableLink>
            </TableData>
            <TableData>{databaseAgentHost.databaseAgentHost.name}</TableData>

            <TableData>
              <FormattedTimestamp timestamp={databaseAgentHost.created} />
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}
