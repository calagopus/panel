import { ModalProps } from '@mantine/core';
import { z } from 'zod';
import recreateDatabaseInstanceDatabase from '@/api/server/databases/instances/recreateDatabaseInstanceDatabase.ts';
import Button from '@/elements/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import {
  serverDatabaseInstanceDatabaseSchema,
  serverDatabaseInstanceSchema,
} from '@/lib/schemas/server/databaseInstances.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  instance: z.infer<typeof serverDatabaseInstanceSchema>;
  database: z.infer<typeof serverDatabaseInstanceDatabaseSchema>;
  onRecreated: () => void;
};

export default function DatabaseInstanceDatabaseRecreateModal({ instance, database, onRecreated, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm({
    initialValues: { name: '' },
    validate: { name: (value) => (value !== database.name ? 'Name does not match' : null) },
    onClose: props.onClose,
    onSubmit: async () => {
      await recreateDatabaseInstanceDatabase(server.uuid, instance.uuid, database.uuid);
      addToast(t('pages.server.databases.instance.databases.toast.recreated', {}), 'success');
      onRecreated();
    },
  });

  return (
    <FormModal
      title={t('pages.server.databases.instance.databases.modal.recreateDatabase.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <Text>
          {t('pages.server.databases.instance.databases.modal.recreateDatabase.content', { name: database.name }).md()}
        </Text>

        <TextInput
          withAsterisk
          label={t('pages.server.databases.form.databaseName', {})}
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
