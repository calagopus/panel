import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect } from 'react';
import { z } from 'zod';
import updateDatabase from '@/api/server/databases/updateDatabase.ts';
import Button from '@/elements/buttons/Button.tsx';
import Switch from '@/elements/input/Switch.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverDatabaseEditSchema, serverDatabaseSchema } from '@/lib/schemas/server/databases.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  database: z.infer<typeof serverDatabaseSchema>;
};

export default function DatabaseEditModal({ database, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const server = useServerStore((state) => state.server);

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof serverDatabaseEditSchema>>({
    initialValues: {
      locked: database.isLocked,
    },
    validate: zod4Resolver(serverDatabaseEditSchema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      await updateDatabase(server.uuid, database.uuid, values);
      queryClient.invalidateQueries({ queryKey: queryKeys.server(server.uuid).databases.all() });
      addToast(t('pages.server.databases.modal.editDatabase.toast.updated', {}), 'success');
    },
  });

  useEffect(() => {
    if (props.opened) {
      const values = { locked: database.isLocked };

      form.setValues(values);
      form.resetDirty(values);
    }
  }, [props.opened]);

  return (
    <FormModal
      title={t('pages.server.databases.modal.editDatabase.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <Switch
          label={t('common.form.locked', {})}
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
