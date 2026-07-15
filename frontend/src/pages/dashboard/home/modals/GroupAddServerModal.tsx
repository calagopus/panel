import { ModalProps } from '@mantine/core';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import updateServerGroup from '@/api/me/servers/groups/updateServerGroup.ts';
import Button from '@/elements/Button.tsx';
import ServerSelect from '@/elements/input/ServerSelect.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { serverSchema } from '@/lib/schemas/server/server.ts';
import { userServerGroupSchema } from '@/lib/schemas/user.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useUserStore } from '@/stores/user.ts';

type Props = ModalProps & {
  serverGroup: z.infer<typeof userServerGroupSchema>;
  onServerAdded?: () => void;
};

export default function GroupAddServerModal({ serverGroup, onServerAdded, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const updateStateServerGroup = useUserStore((state) => state.updateServerGroup);

  const [selectedServer, setSelectedServer] = useState<z.infer<typeof serverSchema> | null>(null);
  const [loading, setLoading] = useState(false);

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
        props.onClose();
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
      {...props}
    >
      <ServerSelect
        withAsterisk
        label={t('common.form.server', {})}
        exclude={serverGroup.serverOrder}
        value={selectedServer?.uuid || ''}
        selectedItem={selectedServer}
        onChange={(_, server) => setSelectedServer(server)}
      />

      <ModalFooter>
        <Button
          onClick={doAdd}
          loading={loading}
          disabled={!selectedServer || serverGroup.serverOrder.includes(selectedServer.uuid)}
        >
          {t('common.button.add', {})}
        </Button>
        <Button variant='default' onClick={props.onClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
