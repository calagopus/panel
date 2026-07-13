import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import createDatabaseInstanceUser from '@/api/server/databases/instances/createDatabaseInstanceUser.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  serverDatabaseInstanceDatabaseSchema,
  serverDatabaseInstanceSchema,
  serverDatabaseInstanceUserCreateSchema,
} from '@/lib/schemas/server/databaseInstances.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  instance: z.infer<typeof serverDatabaseInstanceSchema>;
  databases: z.infer<typeof serverDatabaseInstanceDatabaseSchema>[];
};

export default function DatabaseInstanceUserCreateModal({ instance, databases, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const queryClient = useQueryClient();

  const requiresDatabase = instance.type !== 'redis';

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof serverDatabaseInstanceUserCreateSchema>
  >({
    initialValues: { username: '', databaseUuid: null },
    validate: zod4Resolver(
      requiresDatabase
        ? serverDatabaseInstanceUserCreateSchema.refine((values) => !!values.databaseUuid, {
            path: ['databaseUuid'],
            message: t('pages.server.databases.instance.users.modal.createUser.form.databaseRequired', {}),
          })
        : serverDatabaseInstanceUserCreateSchema,
    ),
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

        {requiresDatabase && (
          <Select
            withAsterisk
            label={t('pages.server.databases.instance.users.modal.createUser.form.database', {})}
            description={t('pages.server.databases.instance.users.modal.createUser.form.databaseHint', {})}
            data={databases.map((database) => ({ value: database.uuid, label: database.name }))}
            nothingFoundMessage={t('pages.server.databases.instance.databases.noDatabases', {})}
            searchable
            {...form.getInputProps('databaseUuid')}
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
