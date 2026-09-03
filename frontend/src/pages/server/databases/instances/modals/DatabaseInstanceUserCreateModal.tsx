import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import createDatabaseInstanceUser from '@/api/server/databases/instances/createDatabaseInstanceUser.ts';
import Button from '@/elements/buttons/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Text from '@/elements/typography/Text.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  serverDatabaseInstanceDatabaseSchema,
  serverDatabaseInstanceSchema,
  serverDatabaseInstanceUserCreateSchema,
} from '@/lib/schemas/server/databaseInstances.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import DatabaseInstanceUserDatabasesInput from '../management/DatabaseInstanceUserDatabasesInput.tsx';

type Props = ModalProps & {
  instance: z.infer<typeof serverDatabaseInstanceSchema>;
  databases: z.infer<typeof serverDatabaseInstanceDatabaseSchema>[];
};

export default function DatabaseInstanceUserCreateModal({ instance, databases, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const queryClient = useQueryClient();

  const hasDatabases = instance.type !== 'redis';

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof serverDatabaseInstanceUserCreateSchema>
  >({
    initialValues: { username: '', databases: [] },
    validate: zod4Resolver(serverDatabaseInstanceUserCreateSchema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      await createDatabaseInstanceUser(server.uuid, instance.uuid, values);
      addToast(t('pages.server.databases.instance.users.toast.created', {}), 'success');
      queryClient.invalidateQueries({
        queryKey: queryKeys.server(server.uuid).databases.instances.users(instance.uuid),
      });
    },
  });

  return (
    <FormModal
      title={t('pages.server.databases.instance.users.modal.createUser.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <Text c='dimmed' size='sm'>
          {t('pages.server.databases.instance.users.modal.createUser.content', {}).md()}
        </Text>

        <TextInput withAsterisk label={t('common.form.username', {})} {...form.getInputProps('username')} />

        {hasDatabases && (
          <DatabaseInstanceUserDatabasesInput
            label={t('pages.server.databases.instance.users.form.databases', {})}
            databases={databases}
            value={form.getValues().databases}
            onChange={(value) => form.setFieldValue('databases', value)}
          />
        )}

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={!form.isValid()}>
            {t('common.button.create', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
