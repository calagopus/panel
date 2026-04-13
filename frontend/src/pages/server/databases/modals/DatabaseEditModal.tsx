import { ModalProps, Stack } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import updateDatabase from '@/api/server/databases/updateDatabase.ts';
import Button from '@/elements/Button.tsx';
import Switch from '@/elements/input/Switch.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { serverDatabaseEditSchema, serverDatabaseSchema } from '@/lib/schemas/server/databases.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  database: z.infer<typeof serverDatabaseSchema>;
};

export default function DatabaseEditModal({ database, opened, onClose }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);

  const [loading, setLoading] = useState(false);

  const { form, onClose: handleClose } = useModalForm<z.infer<typeof serverDatabaseEditSchema>>(
    {
      initialValues: {
        locked: database.isLocked,
      },
      validateInputOnBlur: true,
      validate: zod4Resolver(serverDatabaseEditSchema),
    },
    onClose,
  );

  const doUpdate = () => {
    setLoading(true);

    updateDatabase(server.uuid, database.uuid, form.values)
      .then(() => {
        database.isLocked = form.values.locked;
        handleClose();
        addToast(t('pages.server.databases.modal.editDatabase.toast.updated', {}), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.server.databases.modal.editDatabase.title', {})} onClose={handleClose} opened={opened}>
      <form onSubmit={form.onSubmit(() => doUpdate())}>
        <Stack>
          <Switch
            label={t('pages.server.databases.modal.editDatabase.form.locked', {})}
            name='locked'
            {...form.getInputProps('locked', { type: 'checkbox' })}
          />

          <ModalFooter>
            <Button type='submit' loading={loading}>
              {t('common.button.save', {})}
            </Button>
            <Button variant='default' onClick={handleClose}>
              {t('common.button.close', {})}
            </Button>
          </ModalFooter>
        </Stack>
      </form>
    </Modal>
  );
}
