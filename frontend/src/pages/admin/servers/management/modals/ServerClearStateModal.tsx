import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import clearServerState from '@/api/admin/servers/clearServerState.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function ServerClearStateModal({
  server,
  ...props
}: ModalProps & { server: z.infer<typeof adminServerSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const doClearState = async () => {
    await clearServerState(server.uuid)
      .then(() => {
        addToast(t('pages.admin.servers.tabs.management.page.clearState.toast.cleared', {}), 'success');
        props.onClose();
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.servers.detail(server.uuid) });
        server.status = null;
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
        title={t('pages.admin.servers.tabs.management.page.clearState.modal.title', {})}
        confirm={t('pages.admin.servers.tabs.management.page.clearState.button', {})}
        onConfirmed={doClearState}
      >
        {t('pages.admin.servers.tabs.management.page.clearState.modal.content', { name: server.name }).md()}
      </ConfirmationModal>
    </>
  );
}
