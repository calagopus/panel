import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import attachTeamServer from '@/api/me/teams/servers/attachTeamServer.ts';
import getAvailableTeamServers from '@/api/me/teams/servers/getAvailableTeamServers.ts';
import Button from '@/elements/buttons/Button.tsx';
import ServerMultiSelect from '@/elements/input/ServerMultiSelect.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverSchema } from '@/lib/schemas/server/server.ts';
import { userTeamSchema } from '@/lib/schemas/user/teams.ts';
import { useBulkAction } from '@/plugins/selection/useBulkAction.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Props = ModalProps & {
  team: z.infer<typeof userTeamSchema>;
};

export default function TeamServerAttachModal({ team, ...props }: Props) {
  const { t } = useTranslations();
  const queryClient = useQueryClient();
  const { run, loading } = useBulkAction();

  const [servers, setServers] = useState<z.infer<typeof serverSchema>[]>([]);

  const handleClose = () => {
    setServers([]);
    props.onClose();
  };

  const doAttach = async () => {
    const { successful } = await run({
      action: 'attach',
      items: servers,
      itemKey: 'server',
      verb: t('common.bulkActions.verb.attached', {}),
      request: (server) => attachTeamServer(team.uuid, server.uuid),
    });

    if (successful > 0) {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.teams.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.servers.all() });
      for (const server of servers) {
        queryClient.invalidateQueries({ queryKey: queryKeys.server(server.uuid).subusers.all() });
      }

      handleClose();
    }
  };

  return (
    <Modal title={t('pages.account.teams.tabs.servers.modal.attachServers.title', {})} {...props} onClose={handleClose}>
      <Stack>
        <ServerMultiSelect
          withAsterisk
          label={t('common.form.servers', {})}
          description={
            servers.some((server) => server.teamUuid)
              ? t('pages.account.teams.tabs.servers.modal.attachServers.form.serversMoveDescription', {})
              : t('pages.account.teams.tabs.servers.modal.attachServers.form.serversDescription', {})
          }
          queryKey={queryKeys.user.teams.availableServers(team.uuid)}
          paginatedFetcher={(page, search) => getAvailableTeamServers(team.uuid, page, search)}
          value={servers}
          onChange={setServers}
        />

        <ModalFooter>
          <Button onClick={doAttach} loading={loading === 'attach'} disabled={servers.length === 0}>
            {t('pages.account.teams.tabs.servers.button.attach', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
