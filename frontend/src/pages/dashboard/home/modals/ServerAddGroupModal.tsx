import { ModalProps } from '@mantine/core';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import updateServerGroup from '@/api/me/servers/groups/updateServerGroup.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { serverSchema } from '@/lib/schemas/server/server.ts';
import { userServerGroupSchema } from '@/lib/schemas/user.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useUserStore } from '@/stores/user.ts';

type Props = ModalProps & {
  server: z.infer<typeof serverSchema>;
};

export default function ServerAddGroupModal({ server, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const serverGroups = useUserStore((state) => state.serverGroups);
  const updateStateServerGroup = useUserStore((state) => state.updateServerGroup);

  const [selectedServerGroup, setSelectedServerGroup] = useState<z.infer<typeof userServerGroupSchema> | null>(null);
  const [loading, setLoading] = useState(false);

  const doAdd = () => {
    if (!selectedServerGroup || selectedServerGroup.serverOrder.includes(server.uuid)) {
      return;
    }

    setLoading(true);

    updateServerGroup(selectedServerGroup.uuid, { serverOrder: [...selectedServerGroup.serverOrder, server.uuid] })
      .then(() => {
        updateStateServerGroup(selectedServerGroup.uuid, {
          serverOrder: [...selectedServerGroup.serverOrder, server.uuid],
        });

        props.onClose();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal
      title={t('pages.account.home.tabs.allServers.page.modal.addToServerGroup.title', { server: server.name })}
      {...props}
    >
      <Select
        label={t('pages.account.home.tabs.allServers.page.modal.addToServerGroup.form.serverGroup', {})}
        value={selectedServerGroup?.uuid || ''}
        searchable
        onChange={(value) => setSelectedServerGroup(serverGroups.find((g) => g.uuid === value) ?? null)}
        data={serverGroups
          .filter((g) => !g.serverOrder.includes(server.uuid))
          .map((g) => ({
            label: g.name,
            value: g.uuid,
          }))}
      />

      <ModalFooter>
        <Button
          onClick={doAdd}
          loading={loading}
          disabled={!selectedServerGroup || selectedServerGroup.serverOrder.includes(server.uuid)}
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
