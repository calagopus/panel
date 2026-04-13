import { ModalProps, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import recreateDatabase from '@/api/server/databases/recreateDatabase.ts';
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
  setSizeLoading: (loading: boolean) => void;
};

export default function DatabaseRecreateModal({ database, setSizeLoading, opened, onClose }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);

  const { form, onClose: handleClose } = useModalForm(
    {
      name: '',
    },
    onClose,
  );
  const [loading, setLoading] = useState(false);

  const doRecreate = () => {
    setLoading(true);

    recreateDatabase(server.uuid, database.uuid)
      .then(() => {
        addToast(t('pages.server.databases.modal.recreateDatabase.toast.recreated', {}), 'success');
        setSizeLoading(true);
        handleClose();
      })
      .catch((error) => {
        console.error(error);
        addToast(httpErrorToHuman(error), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.server.databases.modal.recreateDatabase.title', {})} onClose={handleClose} opened={opened}>
      <Stack>
        <Text>{t('pages.server.databases.modal.recreateDatabase.content', { name: database.name }).md()}</Text>

        <TextInput
          withAsterisk
          label={t('pages.server.databases.form.databaseName', {})}
          placeholder={t('pages.server.databases.form.databaseName', {})}
          {...form.getInputProps('name')}
        />

        <ModalFooter>
          <Button color='red' onClick={doRecreate} loading={loading} disabled={database.name !== form.getValues().name}>
            {t('common.button.recreate', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
