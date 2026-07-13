import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import deleteDatabase from '@/api/server/databases/deleteDatabase.ts';
import Button from '@/elements/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverDatabaseSchema } from '@/lib/schemas/server/databases.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  database: z.infer<typeof serverDatabaseSchema>;
};

export default function DatabaseDeleteModal({ database, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const queryClient = useQueryClient();

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm({
    initialValues: { name: '' },
    validate: { name: (value) => (value !== database.name ? 'Name does not match' : null) },
    onClose: props.onClose,
    onSubmit: async () => {
      await deleteDatabase(server.uuid, database.uuid);
      addToast(t('pages.server.databases.modal.deleteDatabase.toast.deleted', {}), 'success');
      queryClient.invalidateQueries({ queryKey: queryKeys.server(server.uuid).databases.all() });
    },
  });

  return (
    <FormModal
      title={t('pages.server.databases.modal.deleteDatabase.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <Text>{t('pages.server.databases.modal.deleteDatabase.content', { name: database.name }).md()}</Text>

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
