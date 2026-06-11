import { ModalProps } from '@mantine/core';
import { z } from 'zod';
import clearServerState from '@/api/admin/servers/clearServerState.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';

export default function ServerClearStateModal({
  server,
  opened,
  onClose,
}: ModalProps & { server: z.infer<typeof adminServerSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { updateServer } = useAdminStore();

  const doClearState = async () => {
    await clearServerState(server.uuid)
      .then(() => {
        addToast(t('pages.admin.servers.tabs.management.page.clearState.toast.cleared', {}), 'success');
        onClose();
        updateServer({ ...server, status: null });
        server.status = null;
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <>
      <ConfirmationModal
        opened={opened}
        onClose={() => onClose()}
        title={t('pages.admin.servers.tabs.management.page.clearState.modal.title', {})}
        confirm={t('pages.admin.servers.tabs.management.page.clearState.button', {})}
        onConfirmed={doClearState}
      >
        {t('pages.admin.servers.tabs.management.page.clearState.modal.content', { name: server.name }).md()}
      </ConfirmationModal>
    </>
  );
}
