import { ModalProps } from '@mantine/core';
import { z } from 'zod';
import updateServerGroup from '@/api/me/servers/groups/updateServerGroup.ts';
import ResourceSelectModal from '@/elements/modals/ResourceSelectModal.tsx';
import { serverSchema } from '@/lib/schemas/server/server.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useUserStore } from '@/stores/user.ts';

type Props = ModalProps & {
  server: z.infer<typeof serverSchema>;
};

export default function ServerAddGroupModal({ server, ...props }: Props) {
  const { t } = useTranslations();
  const serverGroups = useUserStore((state) => state.serverGroups);
  const updateStateServerGroup = useUserStore((state) => state.updateServerGroup);

  return (
    <ResourceSelectModal
      {...props}
      title={t('pages.account.home.tabs.allServers.page.modal.addToServerGroup.title', { server: server.name })}
      label={t('pages.account.home.tabs.allServers.page.modal.addToServerGroup.form.serverGroup', {})}
      data={serverGroups
        .filter((group) => !group.serverOrder.includes(server.uuid))
        .map((group) => ({ label: group.name, value: group.uuid }))}
      onConfirm={(groupUuid) => {
        const group = serverGroups.find((g) => g.uuid === groupUuid);

        if (!group) {
          return Promise.reject(new Error('Server group not found.'));
        }

        const serverOrder = [...group.serverOrder, server.uuid];

        return updateServerGroup(group.uuid, { serverOrder }).then(() => {
          updateStateServerGroup(group.uuid, { serverOrder });
        });
      }}
    />
  );
}
