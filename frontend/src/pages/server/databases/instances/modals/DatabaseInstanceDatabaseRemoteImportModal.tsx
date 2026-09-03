import { ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import importDatabaseInstanceDatabaseRemote from '@/api/server/databases/instances/importDatabaseInstanceDatabaseRemote.ts';
import Button from '@/elements/buttons/Button.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Text from '@/elements/typography/Text.tsx';
import {
  serverDatabaseInstanceDatabaseSchema,
  serverDatabaseInstanceRemoteImportSchema,
  serverDatabaseInstanceSchema,
} from '@/lib/schemas/server/databaseInstances.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  instance: z.infer<typeof serverDatabaseInstanceSchema>;
  database: z.infer<typeof serverDatabaseInstanceDatabaseSchema>;
};

export default function DatabaseInstanceDatabaseRemoteImportModal({ instance, database, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof serverDatabaseInstanceRemoteImportSchema>
  >({
    initialValues: { url: '', sourceDb: null, wipe: false },
    validate: zod4Resolver(serverDatabaseInstanceRemoteImportSchema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      await importDatabaseInstanceDatabaseRemote(server.uuid, instance.uuid, database.uuid, values);
      addToast(t('pages.server.databases.instance.databases.toast.remoteImportStarted', {}), 'success');
    },
  });

  return (
    <FormModal
      title={t('pages.server.databases.instance.databases.modal.remoteImportDatabase.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <Text c='dimmed' size='sm'>
          {t('pages.server.databases.instance.databases.modal.remoteImportDatabase.content', {
            database: database.name,
          }).md()}
        </Text>

        <TextInput
          withAsterisk
          label={t('pages.server.databases.instance.databases.modal.remoteImportDatabase.form.url', {})}
          description={t(
            'pages.server.databases.instance.databases.modal.remoteImportDatabase.form.urlDescription',
            {},
          )}
          {...form.getInputProps('url')}
        />

        <TextInput
          label={t('pages.server.databases.instance.databases.modal.remoteImportDatabase.form.sourceDb', {})}
          description={t(
            'pages.server.databases.instance.databases.modal.remoteImportDatabase.form.sourceDbDescription',
            {},
          )}
          value={form.values.sourceDb ?? ''}
          error={form.errors.sourceDb}
          onChange={(e) => form.setFieldValue('sourceDb', e.target.value || null)}
        />

        <Switch
          label={t('pages.server.databases.instance.databases.modal.importDatabase.form.wipe', {})}
          {...form.getInputProps('wipe', { type: 'checkbox' })}
        />

        <ModalFooter>
          <Button type='submit' color={form.values.wipe ? 'red' : undefined} loading={loading}>
            {t('common.button.import', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
