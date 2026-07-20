import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import applyDatabaseInstanceUpdate from '@/api/server/databases/instances/applyDatabaseInstanceUpdate.ts';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverDatabaseInstanceSchema } from '@/lib/schemas/server/databaseInstances.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  instance: z.infer<typeof serverDatabaseInstanceSchema>;
};

export default function DatabaseInstanceApplyUpdateModal({ instance, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const queryClient = useQueryClient();

  const onConfirmed = () =>
    applyDatabaseInstanceUpdate(server.uuid, instance.uuid)
      .then(() => {
        addToast(t('pages.server.databases.instance.modal.applyDatabaseInstanceUpdate.toast.applied', {}), 'success');
        queryClient.invalidateQueries({ queryKey: queryKeys.server(server.uuid).databases.instances.all() });
        queryClient.invalidateQueries({
          queryKey: queryKeys.server(server.uuid).databases.instances.detail(instance.uuid),
        });
        props.onClose();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });

  return (
    <ConfirmationModal
      {...props}
      title={t('pages.server.databases.instance.modal.applyDatabaseInstanceUpdate.title', {})}
      confirm={t('common.button.continue', {})}
      confirmColor='blue'
      onConfirmed={onConfirmed}
    >
      {t('pages.server.databases.instance.modal.applyDatabaseInstanceUpdate.content', {
        name: instance.name,
      }).md()}
    </ConfirmationModal>
  );
}
