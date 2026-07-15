import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import createDatabase from '@/api/server/databases/createDatabase.ts';
import getDatabaseHosts from '@/api/server/databases/getDatabaseHosts.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { databaseTypeLabelMapping } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { databaseHostSchema } from '@/lib/schemas/generic.ts';
import { serverDatabaseCreateSchema } from '@/lib/schemas/server/databases.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function DatabaseCreateModal({ ...props }: ModalProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server } = useServerStore();
  const queryClient = useQueryClient();

  const [databaseHosts, setDatabaseHosts] = useState<z.infer<typeof databaseHostSchema>[]>([]);

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof serverDatabaseCreateSchema>
  >({
    initialValues: { name: '', databaseHostUuid: '' },
    validate: zod4Resolver(serverDatabaseCreateSchema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      await createDatabase(server.uuid, values);
      addToast(t('pages.server.databases.modal.createDatabase.toast.created', {}), 'success');
      queryClient.invalidateQueries({ queryKey: queryKeys.server(server.uuid).databases.all() });
    },
  });

  useEffect(() => {
    getDatabaseHosts(server.uuid).then((data) => setDatabaseHosts(data));
  }, []);

  const selectedHost = databaseHosts.find((host) => host.uuid === form.getValues().databaseHostUuid);

  return (
    <FormModal
      title={t('pages.server.databases.modal.createDatabase.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <TextInput
          withAsterisk
          label={t('pages.server.databases.form.databaseName', {})}
          {...form.getInputProps('name')}
        />

        <Select
          withAsterisk
          label={t('common.form.databaseHost', {})}
          searchable
          nothingFoundMessage={t('pages.server.databases.modal.createDatabase.form.noHostsFound', {})}
          data={Object.values(
            databaseHosts.reduce(
              (acc, { uuid, name, type, maintenanceEnabled }) => (
                (acc[type] ??= { group: databaseTypeLabelMapping[type], items: [] }).items.push({
                  value: uuid,
                  label: maintenanceEnabled
                    ? `${name} (${t('pages.server.databases.modal.createDatabase.form.hostInMaintenance', {})})`
                    : name,
                  disabled: maintenanceEnabled,
                }),
                acc
              ),
              {} as GroupedDatabaseHosts,
            ),
          )}
          {...form.getInputProps('databaseHostUuid')}
        />

        <ModalFooter>
          <Button
            type='submit'
            loading={loading}
            disabled={!form.isValid() || Boolean(selectedHost?.maintenanceEnabled)}
          >
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
