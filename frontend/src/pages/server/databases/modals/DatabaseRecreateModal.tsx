import { ModalProps, Stack, Text } from '@mantine/core';
import { z } from 'zod';
import recreateDatabase from '@/api/server/databases/recreateDatabase.ts';
import Button from '@/elements/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { serverDatabaseSchema } from '@/lib/schemas/server/databases.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  database: z.infer<typeof serverDatabaseSchema>;
  setSizeLoading: (loading: boolean) => void;
};

export default function DatabaseRecreateModal({ database, setSizeLoading, opened, onClose }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm({
    initialValues: { name: '' },
    validate: { name: (value) => (value !== database.name ? 'Name does not match' : null) },
    onClose,
    onSubmit: async () => {
      await recreateDatabase(server.uuid, database.uuid);
      addToast(t('pages.server.databases.modal.recreateDatabase.toast.recreated', {}), 'success');
      setSizeLoading(true);
    },
  });

  return (
    <FormModal
      title={t('pages.server.databases.modal.recreateDatabase.title', {})}
      onClose={handleClose}
      onSubmit={handleSubmit}
      isDirty={isDirty}
      loading={loading}
      opened={opened}
    >
      <Stack>
        <Text>{t('pages.server.databases.modal.recreateDatabase.content', { name: database.name }).md()}</Text>

        <TextInput
          withAsterisk
          label={t('pages.server.databases.form.databaseName', {})}
          placeholder={t('pages.server.databases.form.databaseName', {})}
          {...form.getInputProps('name')}
        />

        <ModalFooter>
          <Button color='red' type='submit' loading={loading} disabled={!form.isValid()}>
            {t('common.button.recreate', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
