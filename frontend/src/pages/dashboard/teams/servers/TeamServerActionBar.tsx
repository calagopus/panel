import { faLinkSlash, faServer } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import detachTeamServer from '@/api/me/teams/servers/detachTeamServer.ts';
import ActionBar from '@/elements/ActionBar.tsx';
import Button from '@/elements/buttons/Button.tsx';
import ItemPreviewList, { ItemPreviewRow } from '@/elements/data-display/ItemPreviewList.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverSchema } from '@/lib/schemas/server/server.ts';
import { userTeamSchema } from '@/lib/schemas/user/teams.ts';
import { useBulkAction } from '@/plugins/selection/useBulkAction.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function TeamServerActionBar({
  team,
  selectedServers,
  clearSelection,
  onFinished,
}: {
  team: z.infer<typeof userTeamSchema>;
  selectedServers: ObjectSet<z.infer<typeof serverSchema>, 'uuid'>;
  clearSelection: () => void;
  onFinished: () => void;
}) {
  const { t, tItem } = useTranslations();
  const queryClient = useQueryClient();
  const { run, loading } = useBulkAction();

  const [confirming, setConfirming] = useState(false);

  const servers = selectedServers.values();

  const finish = () => {
    clearSelection();
    onFinished();
  };

  const doDetach = async () => {
    setConfirming(false);

    const { successful } = await run({
      action: 'detach',
      items: servers,
      itemKey: 'server',
      verb: t('common.bulkActions.verb.detached', {}),
      request: (server) => detachTeamServer(team.uuid, server.uuid),
      onFinished: finish,
    });

    if (successful > 0) {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.teams.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.servers.all() });
      for (const server of servers) {
        queryClient.invalidateQueries({ queryKey: queryKeys.server(server.uuid).subusers.all() });
      }
    }
  };

  return (
    <>
      <ConfirmationModal
        opened={confirming}
        onClose={() => setConfirming(false)}
        title={t('pages.account.teams.tabs.servers.modal.detachServers.title', {})}
        confirm={t('common.button.detach', {})}
        onConfirmed={doDetach}
      >
        <Stack>
          {t('pages.account.teams.tabs.servers.modal.detachServers.content', {
            servers: tItem('server', servers.length),
          }).md()}

          <ItemPreviewList
            items={servers}
            getKey={(server) => server.uuid}
            renderItem={(server) => (
              <ItemPreviewRow
                icon={<FontAwesomeIcon icon={faServer} />}
                name={server.name}
                description={server.egg.name}
                meta={server.locationName}
              />
            )}
          />
        </Stack>
      </ConfirmationModal>

      <ActionBar opened={selectedServers.size > 0}>
        <ExtensionSlot
          components={
            window.extensionContext.extensionRegistry.pages.dashboard.teams.view.servers.actionBar.prependedComponents
          }
          name='teamServers-actionBar-prepended'
        />

        <Button color='red' onClick={() => setConfirming(true)} loading={loading === 'detach'}>
          <FontAwesomeIcon icon={faLinkSlash} className='mr-2' />
          {t('common.button.detach', {})} ({servers.length})
        </Button>

        <ExtensionSlot
          components={
            window.extensionContext.extensionRegistry.pages.dashboard.teams.view.servers.actionBar.appendedComponents
          }
          name='teamServers-actionBar-appended'
        />
      </ActionBar>
    </>
  );
}
