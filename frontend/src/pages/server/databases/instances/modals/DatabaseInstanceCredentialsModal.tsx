import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import rotateDatabaseInstanceUserPassword from '@/api/server/databases/instances/rotateDatabaseInstanceUserPassword.ts';
import Button from '@/elements/buttons/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { getJdbcConnectionString } from '@/lib/domain/database.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  serverDatabaseInstanceDatabaseSchema,
  serverDatabaseInstanceSchema,
  serverDatabaseInstanceUserSchema,
} from '@/lib/schemas/server/databaseInstances.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  instance: z.infer<typeof serverDatabaseInstanceSchema>;
  user: z.infer<typeof serverDatabaseInstanceUserSchema>;
  databases: z.infer<typeof serverDatabaseInstanceDatabaseSchema>[];
  offline: boolean;
};

export default function DatabaseInstanceCredentialsModal({ instance, user, databases, offline, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [selectedDatabase, setSelectedDatabase] = useState<string | null>(databases[0]?.uuid ?? null);

  const aclOffline = offline && instance.type !== 'redis';

  const database = databases.find((entry) => entry.uuid === selectedDatabase) ?? databases[0] ?? null;

  const host = instance.host ? `${instance.host}${instance.port ? `:${instance.port}` : ''}` : null;
  const jdbcConnectionString = host
    ? getJdbcConnectionString({
        type: instance.type,
        username: user.username,
        password: user.password,
        host,
        database: database?.name ?? null,
      })
    : null;

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
        {databases.length > 1 && (
          <Select
            label={t('pages.server.databases.instance.modal.credentials.form.database', {})}
            description={t('pages.server.databases.instance.modal.credentials.form.databaseHint', {})}
            data={databases.map((database) => ({ value: database.uuid, label: database.name }))}
            value={database?.uuid ?? null}
            onChange={setSelectedDatabase}
            searchable
          />
        )}
        {jdbcConnectionString && (
          <TextInput
            label={t('pages.server.databases.instance.modal.credentials.form.jdbcConnectionString', {})}
            value={jdbcConnectionString}
            readOnly
          />
        )}

        <ModalFooter>
          <Button color='red' onClick={onRotatePassword} loading={loading} disabled={instance.isLocked || aclOffline}>
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
