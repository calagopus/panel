import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import deleteDatabaseInstance from '@/api/server/databases/instances/deleteDatabaseInstance.ts';
import Button from '@/elements/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverDatabaseInstanceSchema } from '@/lib/schemas/server/databaseInstances.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  instance: z.infer<typeof serverDatabaseInstanceSchema>;
  onDeleted?: () => void;
};

export default function DatabaseInstanceDeleteModal({ instance, onDeleted, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const queryClient = useQueryClient();

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm({
    initialValues: { name: '' },
    validate: { name: (value) => (value !== instance.name ? 'Name does not match' : null) },
    onClose: props.onClose,
    onSubmit: async () => {
      await deleteDatabaseInstance(server.uuid, instance.uuid);
      addToast(t('pages.server.databases.instance.modal.deleteDatabaseInstance.toast.deleted', {}), 'success');
      queryClient.invalidateQueries({ queryKey: queryKeys.server(server.uuid).databases.instances.all() });
      onDeleted?.();
    },
  });

  return (
    <FormModal
      title={t('pages.server.databases.instance.modal.deleteDatabaseInstance.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <Text>
          {t('pages.server.databases.instance.modal.deleteDatabaseInstance.content', { name: instance.name }).md()}
        </Text>

        <TextInput
          withAsterisk
          label={t('pages.server.databases.form.databaseName', {})}
          {...form.getInputProps('name')}
        />

        <ModalFooter>
          <Button color='red' type='submit' loading={loading} disabled={!form.isValid()}>
            {t('common.button.delete', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
