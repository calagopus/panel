import { ModalProps, Stack } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import updateDatabase from '@/api/server/databases/updateDatabase.ts';
import Button from '@/elements/Button.tsx';
import Switch from '@/elements/input/Switch.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
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

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof serverDatabaseEditSchema>>({
    initialValues: {
      locked: database.isLocked,
    },
    validate: zod4Resolver(serverDatabaseEditSchema),
    onClose,
    onSubmit: async (values) => {
      await updateDatabase(server.uuid, database.uuid, values);
      database.isLocked = values.locked;
      addToast(t('pages.server.databases.modal.editDatabase.toast.updated', {}), 'success');
    },
  });

  return (
    <FormModal
      title={t('pages.server.databases.modal.editDatabase.title', {})}
      onClose={handleClose}
      onSubmit={handleSubmit}
      isDirty={isDirty}
      loading={loading}
      opened={opened}
    >
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
    </FormModal>
  );
}
