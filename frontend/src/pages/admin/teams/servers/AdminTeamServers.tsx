import { faLinkSlash, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import detachTeamServer from '@/api/admin/teams/servers/detachTeamServer.ts';
import getTeamServers from '@/api/admin/teams/servers/getTeamServers.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ContextMenu from '@/elements/overlays/ContextMenu.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { adminTeamSchema } from '@/lib/schemas/admin/teams.ts';
import { serverTableColumns } from '@/lib/tableColumns.ts';
import ServerRow from '@/pages/admin/servers/ServerRow.tsx';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import TeamServerAttachModal from './modals/TeamServerAttachModal.tsx';

function TeamServerRow({
  team,
  server,
}: {
  team: z.infer<typeof adminTeamSchema>;
  server: z.infer<typeof adminServerSchema>;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'detach' | null>(null);

  const doDetach = async () => {
    await detachTeamServer(team.uuid, server.uuid)
      .then(() => {
        setOpenModal(null);
        addToast(t('pages.account.teams.tabs.servers.modal.detachServer.toast.detached', {}), 'success');
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.teams.all() });
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
            canAccess: useAdminCan('teams.update'),
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.admin.teams.view.servers.contextMenu}
        registryProps={{ team, server }}
      >
        {(props) => <ServerRow server={server} contextMenuProps={props} />}
      </ContextMenu>
    </>
  );
}

export default function AdminTeamServers({ team }: { team: z.infer<typeof adminTeamSchema> }) {
  const { t } = useTranslations();
  const [openModal, setOpenModal] = useState<'attach' | null>(null);

  const {
    data: servers,
    loading,
    error,
    search,
    setSearch,
    setPage,
    setPerPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.teams.servers(team.uuid),
    fetcher: (page, search, perPage) => getTeamServers(team.uuid, page, search, perPage),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.teams.tabs.servers.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      registry={window.extensionContext.extensionRegistry.pages.admin.teams.view.servers.subContainer}
      registryProps={{ team }}
      contentRight={
        <AdminCan action={['teams.update', 'servers.read']}>
          <Button onClick={() => setOpenModal('attach')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
            {t('common.button.add', {})}
          </Button>
        </AdminCan>
      }
    >
      <AdminCan action={['teams.update', 'servers.read']}>
        <TeamServerAttachModal team={team} opened={openModal === 'attach'} onClose={() => setOpenModal(null)} />
      </AdminCan>

      <Table
        columns={[...serverTableColumns(), '']}
        loading={loading}
        pagination={servers}
        onPageSelect={setPage}
        onPerPageSelect={setPerPage}
        error={error}
      >
        {servers?.data.map((server) => (
          <TeamServerRow key={server.uuid} team={team} server={server} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
