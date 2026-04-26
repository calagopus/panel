import { ModalProps } from '@mantine/core';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import updateServerGroup from '@/api/me/servers/groups/updateServerGroup.ts';
import getServers from '@/api/server/getServers.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverSchema } from '@/lib/schemas/server/server.ts';
import { userServerGroupSchema } from '@/lib/schemas/user.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useUserStore } from '@/stores/user.ts';

type Props = ModalProps & {
  serverGroup: z.infer<typeof userServerGroupSchema>;
  onServerAdded?: () => void;
};

export default function GroupAddServerModal({ serverGroup, opened, onClose, onServerAdded }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { updateServerGroup: updateStateServerGroup } = useUserStore();

  const [selectedServer, setSelectedServer] = useState<z.infer<typeof serverSchema> | null>(null);
  const [loading, setLoading] = useState(false);

  const servers = useSearchableResource<z.infer<typeof serverSchema>>({
    queryKey: queryKeys.user.servers.all(),
    fetcher: (search) => getServers(1, search),
  });

  const otherServers = servers.items.filter((s) => !serverGroup.serverOrder.includes(s.uuid));

  const doAdd = () => {
    if (!selectedServer || serverGroup.serverOrder.includes(selectedServer.uuid)) {
      return;
    }

    setLoading(true);

    updateServerGroup(serverGroup.uuid, { serverOrder: [...serverGroup.serverOrder, selectedServer.uuid] })
      .then(() => {
        updateStateServerGroup(serverGroup.uuid, {
          serverOrder: [...serverGroup.serverOrder, selectedServer.uuid],
        });

        onServerAdded?.();
        onClose();
        addToast(t('pages.account.home.tabs.groupedServers.page.modal.addServerToGroup.toast.added', {}), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal
      title={t('pages.account.home.tabs.groupedServers.page.modal.addServerToGroup.title', { group: serverGroup.name })}
      onClose={onClose}
      opened={opened}
    >
      <Select
        withAsterisk
        label={t('common.form.server', {})}
        placeholder={t('common.form.server', {})}
        data={otherServers.map((server) => ({
          label: server.name,
          value: server.uuid,
        }))}
        onChange={(value) => setSelectedServer(otherServers.find((s) => s.uuid === value)!)}
        value={selectedServer?.uuid || ''}
        searchable
        searchValue={servers.search}
        onSearchChange={servers.setSearch}
        loading={servers.loading}
      />

      <ModalFooter>
        <Button
          onClick={doAdd}
          loading={loading}
          disabled={!selectedServer || serverGroup.serverOrder.includes(selectedServer.uuid)}
        >
          {t('common.button.add', {})}
        </Button>
        <Button variant='default' onClick={onClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
