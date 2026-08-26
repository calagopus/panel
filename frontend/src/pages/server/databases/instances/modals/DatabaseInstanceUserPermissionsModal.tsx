import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect } from 'react';
import { z } from 'zod';
import updateDatabaseInstanceUserDatabases from '@/api/server/databases/instances/updateDatabaseInstanceUserDatabases.ts';
import Button from '@/elements/Button.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  serverDatabaseInstanceDatabaseSchema,
  serverDatabaseInstanceSchema,
  serverDatabaseInstanceUserDatabasesUpdateSchema,
  serverDatabaseInstanceUserSchema,
} from '@/lib/schemas/server/databaseInstances.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import DatabaseInstanceUserDatabasesInput from '../management/DatabaseInstanceUserDatabasesInput.tsx';

type Props = ModalProps & {
  instance: z.infer<typeof serverDatabaseInstanceSchema>;
  user: z.infer<typeof serverDatabaseInstanceUserSchema>;
  databases: z.infer<typeof serverDatabaseInstanceDatabaseSchema>[];
};

export default function DatabaseInstanceUserPermissionsModal({ instance, user, databases, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const queryClient = useQueryClient();

  const currentGrants = databases.flatMap((database) => {
    const permission = user.databases.find((entry) => entry.databaseUuid === database.uuid)?.permission;

    return permission && permission !== 'none' ? [{ databaseUuid: database.uuid, permission }] : [];
  });

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof serverDatabaseInstanceUserDatabasesUpdateSchema>
  >({
    initialValues: { databases: currentGrants },
    validate: zod4Resolver(serverDatabaseInstanceUserDatabasesUpdateSchema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      await updateDatabaseInstanceUserDatabases(server.uuid, instance.uuid, user.uuid, values);
      addToast(t('pages.server.databases.instance.users.toast.permissionsUpdated', {}), 'success');
      queryClient.invalidateQueries({
        queryKey: queryKeys.server(server.uuid).databases.instances.users(instance.uuid),
      });
    },
  });

  useEffect(() => {
    if (props.opened) {
      const values = { databases: currentGrants };

      form.setValues(values);
      form.resetDirty(values);
    }
  }, [props.opened]);

  return (
    <FormModal
      title={t('pages.server.databases.instance.users.modal.permissions.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <Text c='dimmed' size='sm'>
          {t('pages.server.databases.instance.users.modal.permissions.content', {
            username: user.username,
          }).md()}
        </Text>

        <DatabaseInstanceUserDatabasesInput
          databases={databases}
          value={form.getValues().databases}
          onChange={(value) => form.setFieldValue('databases', value)}
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
