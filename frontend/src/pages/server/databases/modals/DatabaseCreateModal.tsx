import { ModalProps, Stack } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import createDatabase from '@/api/server/databases/createDatabase.ts';
import getDatabaseHosts from '@/api/server/databases/getDatabaseHosts.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { databaseTypeLabelMapping } from '@/lib/enums.ts';
import { databaseHostSchema } from '@/lib/schemas/generic.ts';
import { serverDatabaseCreateSchema } from '@/lib/schemas/server/databases.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function DatabaseCreateModal({ opened, onClose }: ModalProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server, addDatabase } = useServerStore();

  const [databaseHosts, setDatabaseHosts] = useState<z.infer<typeof databaseHostSchema>[]>([]);
  const [loading, setLoading] = useState(false);

  const { form, onClose: handleClose } = useModalForm<z.infer<typeof serverDatabaseCreateSchema>>(
    {
      initialValues: { name: '', databaseHostUuid: '' },
      validateInputOnBlur: true,
      validate: zod4Resolver(serverDatabaseCreateSchema),
    },
    onClose,
  );

  useEffect(() => {
    getDatabaseHosts(server.uuid).then((data) => setDatabaseHosts(data));
  }, []);

  const doCreate = () => {
    setLoading(true);

    createDatabase(server.uuid, form.values)
      .then((database) => {
        addToast(t('pages.server.databases.modal.createDatabase.toast.created', {}), 'success');
        handleClose();
        addDatabase(database);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.server.databases.modal.createDatabase.title', {})} onClose={handleClose} opened={opened}>
      <form onSubmit={form.onSubmit(() => doCreate())}>
        <Stack>
          <TextInput
            withAsterisk
            label={t('pages.server.databases.form.databaseName', {})}
            placeholder={t('pages.server.databases.form.databaseName', {})}
            {...form.getInputProps('name')}
          />

          <Select
            withAsterisk
            label={t('pages.server.databases.modal.createDatabase.form.databaseHost', {})}
            placeholder={t('pages.server.databases.modal.createDatabase.form.databaseHost', {})}
            searchable
            nothingFoundMessage={t('pages.server.databases.modal.createDatabase.form.noHostsFound', {})}
            data={Object.values(
              databaseHosts.reduce(
                (acc, { uuid, name, type }) => (
                  (acc[type] ??= { group: databaseTypeLabelMapping[type], items: [] }).items.push({
                    value: uuid,
                    label: name,
                  }),
                  acc
                ),
                {} as GroupedDatabaseHosts,
              ),
            )}
            {...form.getInputProps('databaseHostUuid')}
          />

          <ModalFooter>
            <Button type='submit' loading={loading} disabled={!form.isValid()}>
              {t('common.button.create', {})}
            </Button>
            <Button variant='default' onClick={handleClose}>
              {t('common.button.close', {})}
            </Button>
          </ModalFooter>
        </Stack>
      </form>
    </Modal>
  );
}
