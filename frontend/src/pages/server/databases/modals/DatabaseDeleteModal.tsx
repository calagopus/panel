import { ModalProps, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteDatabase from '@/api/server/databases/deleteDatabase.ts';
import Button from '@/elements/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { serverDatabaseSchema } from '@/lib/schemas/server/databases.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  database: z.infer<typeof serverDatabaseSchema>;
};

export default function DatabaseDeleteModal({ database, opened, onClose }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const { removeDatabase } = useServerStore();

  const { form, onClose: handleClose } = useModalForm(
    {
      name: '',
    },
    onClose,
  );

  const [loading, setLoading] = useState(false);

  const doDelete = () => {
    setLoading(true);

    deleteDatabase(server.uuid, database.uuid)
      .then(() => {
        addToast(t('pages.server.databases.modal.deleteDatabase.toast.deleted', {}), 'success');
        handleClose();
        removeDatabase(database);
      })
      .catch((error) => {
        console.error(error);
        addToast(httpErrorToHuman(error), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.server.databases.modal.deleteDatabase.title', {})} onClose={handleClose} opened={opened}>
      <Stack>
        <Text>{t('pages.server.databases.modal.deleteDatabase.content', { name: database.name }).md()}</Text>

        <TextInput
          withAsterisk
          label={t('pages.server.databases.form.databaseName', {})}
          placeholder={t('pages.server.databases.form.databaseName', {})}
          {...form.getInputProps('name')}
        />

        <ModalFooter>
          <Button color='red' onClick={doDelete} loading={loading} disabled={database.name !== form.getValues().name}>
            {t('common.button.delete', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
