import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import clearServerState from '@/api/admin/servers/clearServerState.ts';
import updateServer from '@/api/admin/servers/updateServer.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { AdminServer } from '@/lib/schemas/admin/servers.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export type ServerConfirmAction = 'suspend' | 'unsuspend' | 'clear-state';

const ACTION_CONFIG = {
  suspend: {
    mutate: (serverUuid: string) => updateServer(serverUuid, { suspended: true }),
    toastKey: 'pages.admin.servers.tabs.management.page.suspend.toast.suspended',
    titleKey: 'pages.admin.servers.tabs.management.page.suspend.modal.title',
    confirmKey: 'pages.admin.servers.tabs.management.page.suspend.button',
    contentKey: 'pages.admin.servers.tabs.management.page.suspend.modal.content',
    confirmColor: 'red',
  },
  unsuspend: {
    mutate: (serverUuid: string) => updateServer(serverUuid, { suspended: false }),
    toastKey: 'pages.admin.servers.tabs.management.page.unsuspend.toast.unsuspended',
    titleKey: 'pages.admin.servers.tabs.management.page.unsuspend.modal.title',
    confirmKey: 'pages.admin.servers.tabs.management.page.unsuspend.button',
    contentKey: 'pages.admin.servers.tabs.management.page.unsuspend.modal.content',
    confirmColor: 'green',
  },
  'clear-state': {
    mutate: (serverUuid: string) => clearServerState(serverUuid),
    toastKey: 'pages.admin.servers.tabs.management.page.clearState.toast.cleared',
    titleKey: 'pages.admin.servers.tabs.management.page.clearState.modal.title',
    confirmKey: 'pages.admin.servers.tabs.management.page.clearState.button',
    contentKey: 'pages.admin.servers.tabs.management.page.clearState.modal.content',
    confirmColor: 'red',
  },
} as const;

export default function ServerConfirmActionModal({
  server,
  action,
  ...props
}: ModalProps & { server: AdminServer; action: ServerConfirmAction }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const config = ACTION_CONFIG[action];

  const doConfirm = async () => {
    await config
      .mutate(server.uuid)
      .then(() => {
        addToast(t(config.toastKey, {}), 'success');
        props.onClose();
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.servers.all() });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <ConfirmationModal
      {...props}
      onClose={() => props.onClose()}
      title={t(config.titleKey, {})}
      confirm={t(config.confirmKey, {})}
      confirmColor={config.confirmColor}
      onConfirmed={doConfirm}
    >
      {t(config.contentKey, { name: server.name }).md()}
    </ConfirmationModal>
  );
}
