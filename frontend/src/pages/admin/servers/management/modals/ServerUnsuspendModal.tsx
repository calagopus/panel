import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import updateServer from '@/api/admin/servers/updateServer.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function ServerUnsuspendModal({
  server,
  ...props
}: ModalProps & { server: z.infer<typeof adminServerSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const doSuspend = async () => {
    await updateServer(server.uuid, {
      suspended: false,
    })
      .then(() => {
        addToast(t('pages.admin.servers.tabs.management.page.unsuspend.toast.unsuspended', {}), 'success');
        props.onClose();
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.servers.detail(server.uuid) });
        server.isSuspended = false;
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <>
      <ConfirmationModal
        {...props}
        onClose={() => props.onClose()}
        title={t('pages.admin.servers.tabs.management.page.unsuspend.modal.title', {})}
        confirm={t('pages.admin.servers.tabs.management.page.unsuspend.button', {})}
        confirmColor='green'
        onConfirmed={doSuspend}
      >
        {t('pages.admin.servers.tabs.management.page.unsuspend.modal.content', { name: server.name }).md()}
      </ConfirmationModal>
    </>
  );
}
