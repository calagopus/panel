import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import updateDatabaseInstance from '@/api/server/databases/instances/updateDatabaseInstance.ts';
import Button from '@/elements/Button.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  serverDatabaseInstanceEditSchema,
  serverDatabaseInstanceSchema,
} from '@/lib/schemas/server/databaseInstances.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  instance: z.infer<typeof serverDatabaseInstanceSchema>;
};

export default function DatabaseInstanceEditModal({ instance, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const queryClient = useQueryClient();

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof serverDatabaseInstanceEditSchema>
  >({
    initialValues: {
      name: instance.name,
      locked: instance.isLocked,
    },
    validate: zod4Resolver(serverDatabaseInstanceEditSchema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      await updateDatabaseInstance(server.uuid, instance.uuid, values);
      addToast(t('pages.server.databases.instance.modal.editDatabaseInstance.toast.updated', {}), 'success');
      queryClient.invalidateQueries({ queryKey: queryKeys.server(server.uuid).databases.instances.all() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.server(server.uuid).databases.instances.detail(instance.uuid),
      });
    },
  });

  return (
    <FormModal
      title={t('pages.server.databases.instance.modal.editDatabaseInstance.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <TextInput withAsterisk label={t('common.form.name', {})} {...form.getInputProps('name')} />

        <Switch
          label={t('common.form.locked', {})}
          name='locked'
          {...form.getInputProps('locked', { type: 'checkbox' })}
        />

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={!form.isValid()}>
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
