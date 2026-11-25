import { faLinkSlash } from '@fortawesome/free-solid-svg-icons';
import { useQueryClient } from '@tanstack/react-query';
import { forwardRef, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import detachTeamServer from '@/api/me/teams/servers/detachTeamServer.ts';
import { TableData, TableRow, TableSelectionCell } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import { isTeamOwner } from '@/lib/domain/teams.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverSchema } from '@/lib/schemas/server/server.ts';
import { userTeamSchema } from '@/lib/schemas/user/teams.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface TeamServerRowProps {
  team: z.infer<typeof userTeamSchema>;
  server: z.infer<typeof serverSchema>;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean, range?: boolean) => void;
}

const TeamServerRow = forwardRef<HTMLTableRowElement, TeamServerRowProps>(function TeamServerRow(
  { team, server, isSelected = false, onSelectionChange },
  ref,
) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'detach' | null>(null);

  const doDetach = async () => {
    await detachTeamServer(team.uuid, server.uuid)
      .then(() => {
        setOpenModal(null);
        addToast(t('pages.account.teams.tabs.servers.modal.detachServer.toast.detached', {}), 'success');
        queryClient.invalidateQueries({ queryKey: queryKeys.user.teams.all() });
        queryClient.invalidateQueries({ queryKey: queryKeys.user.servers.all() });
        queryClient.invalidateQueries({ queryKey: queryKeys.server(server.uuid).subusers.all() });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <>
      <ConfirmationModal
        opened={openModal === 'detach'}
        onClose={() => setOpenModal(null)}
        title={t('pages.account.teams.tabs.servers.modal.detachServer.title', {})}
        confirm={t('common.button.detach', {})}
        onConfirmed={doDetach}
      >
        {t('pages.account.teams.tabs.servers.modal.detachServer.content', { server: server.name }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faLinkSlash,
            label: t('common.button.detach', {}),
            onClick: () => setOpenModal('detach'),
            color: 'red',
            canAccess: isTeamOwner(team),
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.dashboard.teams.view.servers.contextMenu}
        registryProps={{ team, server }}
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
              <TableSelectionCell id={server.uuid} checked={isSelected} onChange={onSelectionChange} />
            )}

            <TableData>
              <TableLink to={`/server/${server.uuidShort}`}>{server.name}</TableLink>
            </TableData>

            <TableData>{server.egg.name}</TableData>

            <TableData>{server.locationName}</TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
});

export default TeamServerRow;
