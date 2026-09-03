import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import createDatabaseInstanceDatabase from '@/api/server/databases/instances/createDatabaseInstanceDatabase.ts';
import createDatabaseInstanceUser from '@/api/server/databases/instances/createDatabaseInstanceUser.ts';
import Button from '@/elements/buttons/Button.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import ConditionalTooltip from '@/elements/overlays/ConditionalTooltip.tsx';
import Text from '@/elements/typography/Text.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  serverDatabaseInstanceDatabaseCreateSchema,
  serverDatabaseInstanceDatabaseSchema,
  serverDatabaseInstanceSchema,
  serverDatabaseInstanceUserSchema,
} from '@/lib/schemas/server/databaseInstances.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  instance: z.infer<typeof serverDatabaseInstanceSchema>;
  userCount: number;
  onUserCreated: (
    user: z.infer<typeof serverDatabaseInstanceUserSchema>,
    database: z.infer<typeof serverDatabaseInstanceDatabaseSchema>,
  ) => void;
};

export default function DatabaseInstanceDatabaseCreateModal({ instance, userCount, onUserCreated, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const maxUserCount = useGlobalStore((state) => state.settings.server.maxDatabaseInstanceUserCount);
  const queryClient = useQueryClient();

  const canCreateUser = useServerCan('database-instances.users');
  const userLimitReached = userCount >= maxUserCount;

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof serverDatabaseInstanceDatabaseCreateSchema> & { createUser: boolean }
  >({
    initialValues: { name: '', createUser: true },
    validate: zod4Resolver(serverDatabaseInstanceDatabaseCreateSchema),
    onClose: props.onClose,
    onSubmit: async ({ name, createUser }) => {
      const database = await createDatabaseInstanceDatabase(server.uuid, instance.uuid, { name });
      addToast(t('pages.server.databases.instance.databases.toast.created', {}), 'success');
      queryClient.invalidateQueries({
        queryKey: queryKeys.server(server.uuid).databases.instances.databases(instance.uuid),
      });

      if (!createUser || !canCreateUser || userLimitReached) {
        return;
      }

      try {
        const user = await createDatabaseInstanceUser(server.uuid, instance.uuid, {
          username: database.name,
          databases: [{ databaseUuid: database.uuid, permission: 'read_write' }],
        });

        addToast(t('pages.server.databases.instance.users.toast.created', {}), 'success');
        queryClient.invalidateQueries({
          queryKey: queryKeys.server(server.uuid).databases.instances.users(instance.uuid),
        });

        onUserCreated(user, database);
      } catch (error) {
        addToast(httpErrorToHuman(error), 'error');
      }
    },
  });

  return (
    <FormModal
      title={t('pages.server.databases.instance.databases.modal.createDatabase.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <Text c='dimmed' size='sm'>
          {t('pages.server.databases.instance.databases.modal.createDatabase.content', {}).md()}
        </Text>

        <TextInput withAsterisk label={t('common.form.name', {})} {...form.getInputProps('name')} />

        {canCreateUser && (
          <ConditionalTooltip
            enabled={userLimitReached}
            label={t('pages.server.databases.instance.users.tooltip.limitReached', { max: maxUserCount })}
          >
            <Switch
              label={t('pages.server.databases.instance.databases.modal.createDatabase.form.createUser', {})}
              description={t('pages.server.databases.instance.databases.modal.createDatabase.form.createUserHint', {})}
              name='createUser'
              disabled={userLimitReached}
              {...form.getInputProps('createUser', { type: 'checkbox' })}
              checked={!userLimitReached && form.getValues().createUser}
            />
          </ConditionalTooltip>
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
