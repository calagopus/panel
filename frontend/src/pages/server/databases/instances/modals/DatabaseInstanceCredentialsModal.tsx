import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import rotateDatabaseInstanceUserPassword from '@/api/server/databases/instances/rotateDatabaseInstanceUserPassword.ts';
import Button from '@/elements/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  serverDatabaseInstanceSchema,
  serverDatabaseInstanceUserSchema,
} from '@/lib/schemas/server/databaseInstances.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  instance: z.infer<typeof serverDatabaseInstanceSchema>;
  user: z.infer<typeof serverDatabaseInstanceUserSchema>;
};

export default function DatabaseInstanceCredentialsModal({ instance, user, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const host = instance.host ? `${instance.host}${instance.port ? `:${instance.port}` : ''}` : null;

  const onRotatePassword = () => {
    setLoading(true);

    rotateDatabaseInstanceUserPassword(server.uuid, instance.uuid, user.uuid)
      .then(() => {
        addToast(t('pages.server.databases.instance.databases.toast.passwordRotated', {}), 'success');
        queryClient.invalidateQueries({
          queryKey: queryKeys.server(server.uuid).databases.instances.users(instance.uuid),
        });
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.server.databases.instance.modal.credentials.title', {})} {...props}>
      <Stack>
        {host && <TextInput label={t('common.table.columns.address', {})} value={host} readOnly />}
        <TextInput label={t('common.form.username', {})} value={user.username} readOnly />
        <TextInput label={t('common.form.password', {})} value={user.password} readOnly />

        <ModalFooter>
          <Button color='red' onClick={onRotatePassword} loading={loading} disabled={instance.isLocked}>
            {t('pages.server.databases.button.rotatePassword', {})}
          </Button>
          <Button variant='default' onClick={props.onClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
